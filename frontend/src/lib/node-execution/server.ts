import type { HttpRequestNode, SecretReference, Workflow } from "@6flow/shared/model/node";
import { resolveTemplateValue, NodeExecutionReferenceError } from "./resolve";
import { NodeExecutionError } from "./errors";
import { executeEvmReadNode, executeEvmWriteNode } from "./evm";

interface RawExecutionResult {
  raw: unknown;
  normalized: unknown;
  warnings: string[];
}

export async function executeNodePreview(
  workflow: Workflow,
  nodeId: string,
): Promise<RawExecutionResult> {
  const node = workflow.nodes.find((entry) => entry.id === nodeId);
  if (!node) {
    throw new NodeExecutionError(
      "node_not_found",
      `Node '${nodeId}' was not found in the workflow.`,
      404,
    );
  }

  try {
    switch (node.type) {
      case "httpRequest":
        return await executeHttpRequestNode(node, workflow);
      case "evmRead":
        return await executeEvmReadNode(node, workflow);
      case "evmWrite":
        return await executeEvmWriteNode(node, workflow);
      default:
        throw new NodeExecutionError(
          "unsupported_node_type",
          `Execution preview is not supported for '${node.type}' nodes yet.`,
          400,
        );
    }
  } catch (error) {
    if (error instanceof NodeExecutionError) {
      throw error;
    }
    if (error instanceof NodeExecutionReferenceError) {
      throw new NodeExecutionError("reference_resolution_failed", error.message, 400);
    }
    if (error instanceof Error) {
      throw new NodeExecutionError("execution_failed", error.message, 500);
    }
    throw new NodeExecutionError(
      "execution_failed",
      "Node execution preview failed with an unknown error.",
      500,
    );
  }
}

async function executeHttpRequestNode(
  node: HttpRequestNode,
  workflow: Workflow,
): Promise<RawExecutionResult> {
  const config = node.data.config;
  if (!config.url.trim()) {
    throw new NodeExecutionError("invalid_http_config", "HTTP request URL is required.");
  }

  const resolvedUrl = String(resolveTemplateValue(config.url, workflow));
  const url = new URL(resolvedUrl);
  const headers = new Headers();
  const warnings: string[] = [];

  for (const [key, value] of Object.entries(config.headers ?? {})) {
    headers.set(key, String(resolveTemplateValue(value, workflow)));
  }

  for (const [key, value] of Object.entries(config.queryParameters ?? {})) {
    url.searchParams.set(key, String(resolveTemplateValue(value, workflow)));
  }

  if (config.authentication?.type === "bearerToken") {
    const tokenValue = resolveSecretValue(
      config.authentication.tokenSecret,
      workflow.globalConfig.secrets,
    );
    headers.set("Authorization", `Bearer ${tokenValue}`);
  }

  let body: BodyInit | undefined;
  if (config.body && ["POST", "PUT", "PATCH"].includes(config.method)) {
    const resolvedBody = resolveTemplateValue(config.body.data, workflow);
    switch (config.body.contentType) {
      case "json": {
        body =
          typeof resolvedBody === "string"
            ? resolvedBody
            : JSON.stringify(resolvedBody);
        if (!headers.has("Content-Type")) {
          headers.set("Content-Type", "application/json");
        }
        break;
      }
      case "formUrlEncoded": {
        body = String(resolvedBody);
        if (!headers.has("Content-Type")) {
          headers.set("Content-Type", "application/x-www-form-urlencoded");
        }
        break;
      }
      default: {
        body =
          typeof resolvedBody === "string"
            ? resolvedBody
            : JSON.stringify(resolvedBody);
      }
    }
  }

  if (config.ignoreSSL) {
    warnings.push("ignoreSSL is not supported by frontend execution preview.");
  }

  const response = await fetchWithTimeout(url.toString(), {
    method: config.method,
    headers,
    body,
    redirect: config.followRedirects === false ? "manual" : "follow",
  }, config.timeout);

  const responseHeaders = Object.fromEntries(response.headers.entries());
  let rawBody: string;
  let normalized: unknown;

  switch (config.responseFormat ?? "json") {
    case "text": {
      rawBody = await response.text();
      normalized = rawBody;
      break;
    }
    case "binary": {
      const bytes = Buffer.from(await response.arrayBuffer());
      rawBody = bytes.toString("base64");
      normalized = rawBody;
      break;
    }
    default: {
      rawBody = await response.text();
      try {
        normalized = JSON.parse(rawBody);
      } catch (error) {
        throw new NodeExecutionError(
          "invalid_json_response",
          `HTTP response could not be parsed as JSON: ${toMessage(error)}`,
        );
      }
    }
  }

  const expectedStatusCodes = config.expectedStatusCodes?.length
    ? config.expectedStatusCodes
    : [200];
  if (!expectedStatusCodes.includes(response.status)) {
    throw new NodeExecutionError(
      "unexpected_http_status",
      `HTTP request returned ${response.status}; expected ${expectedStatusCodes.join(", ")}.`,
      400,
    );
  }

  return {
    raw: {
      statusCode: response.status,
      headers: responseHeaders,
      body: rawBody,
    },
    normalized,
    warnings,
  };
}

function resolveSecretValue(
  secretName: string,
  secrets: SecretReference[],
): string {
  const secret = secrets.find((entry) => entry.name === secretName);
  if (!secret) {
    throw new NodeExecutionError(
      "secret_not_declared",
      `Secret '${secretName}' is not declared in workflow settings.`,
    );
  }

  const envValue = process.env[secret.envVariable];
  if (!envValue) {
    throw new NodeExecutionError(
      "secret_provider_unavailable",
      `Environment variable '${secret.envVariable}' is not set for secret '${secretName}'.`,
      400,
    );
  }

  return envValue;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs?: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = timeoutMs && timeoutMs > 0 ? timeoutMs : 15_000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new NodeExecutionError(
        "execution_timeout",
        `Node execution preview timed out after ${timeout}ms.`,
        408,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
