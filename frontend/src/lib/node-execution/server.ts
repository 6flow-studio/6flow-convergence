import type {
  AINode,
  HttpRequestNode,
  SecretReference,
  Workflow,
} from "@6flow/shared/model/node";
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
      case "ai":
        return await executeAiNode(node, workflow);
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

async function executeAiNode(
  node: AINode,
  workflow: Workflow,
): Promise<RawExecutionResult> {
  const config = node.data.config;
  const apiKey = resolveSecretValue(
    config.apiKeySecret,
    workflow.globalConfig.secrets,
  );
  const provider = config.provider.trim().toLowerCase();
  const baseUrl = String(resolveTemplateValue(config.baseUrl, workflow));
  const model = String(resolveTemplateValue(config.model, workflow));
  const systemPrompt = String(resolveTemplateValue(config.systemPrompt, workflow));
  const userPrompt = String(resolveTemplateValue(config.userPrompt, workflow));

  const { headers, body } = buildAiRequest(provider, {
    model,
    systemPrompt,
    userPrompt,
    apiKey,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  });

  const response = await fetchWithTimeout(
    baseUrl,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    },
    config.timeout,
  );

  const rawResponse = await response.json();
  if (!response.ok) {
    throw new NodeExecutionError(
      "ai_request_failed",
      `AI request failed with status ${response.status}.`,
      400,
    );
  }

  const warnings: string[] = [];
  let normalized: unknown = rawResponse;

  if ((config.responseFormat ?? "text") === "json") {
    const textContent = extractAiText(provider, rawResponse);
    if (!textContent) {
      warnings.push(
        "Could not extract text content from the AI response; showing raw provider response instead.",
      );
    } else {
      try {
        normalized = JSON.parse(textContent);
      } catch (error) {
        throw new NodeExecutionError(
          "invalid_ai_json",
          `AI response could not be parsed as JSON: ${toMessage(error)}`,
          400,
        );
      }
    }
  } else {
    const textContent = extractAiText(provider, rawResponse);
    if (textContent) {
      normalized = textContent;
    } else {
      warnings.push(
        "Could not extract text content from the AI response; showing raw provider response instead.",
      );
    }
  }

  return {
    raw: rawResponse,
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

function buildAiRequest(
  provider: string,
  input: {
    model: string;
    systemPrompt: string;
    userPrompt: string;
    apiKey: string;
    temperature?: number;
    maxTokens?: number;
  },
): { headers: Headers; body: Record<string, unknown> } {
  const headers = new Headers({
    "Content-Type": "application/json",
  });

  if (provider === "google") {
    headers.set("x-goog-api-key", input.apiKey);
    return {
      headers,
      body: {
        system_instruction: {
          parts: [{ text: input.systemPrompt }],
        },
        contents: [{ role: "user", parts: [{ text: input.userPrompt }] }],
        ...(input.temperature != null || input.maxTokens != null
          ? {
              generationConfig: {
                ...(input.temperature != null
                  ? { temperature: input.temperature }
                  : {}),
                ...(input.maxTokens != null
                  ? { maxOutputTokens: input.maxTokens }
                  : {}),
              },
            }
          : {}),
      },
    };
  }

  if (provider === "anthropic") {
    headers.set("x-api-key", input.apiKey);
    headers.set("anthropic-version", "2023-06-01");
    return {
      headers,
      body: {
        model: input.model,
        system: input.systemPrompt,
        messages: [{ role: "user", content: input.userPrompt }],
        ...(input.temperature != null ? { temperature: input.temperature } : {}),
        ...(input.maxTokens != null ? { max_tokens: input.maxTokens } : {}),
      },
    };
  }

  headers.set("Authorization", `Bearer ${input.apiKey}`);
  return {
    headers,
    body: {
      model: input.model,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ],
      ...(input.temperature != null ? { temperature: input.temperature } : {}),
      ...(input.maxTokens != null ? { max_tokens: input.maxTokens } : {}),
    },
  };
}

function extractAiText(provider: string, rawResponse: unknown): string | null {
  if (!rawResponse || typeof rawResponse !== "object") {
    return null;
  }

  const record = rawResponse as Record<string, unknown>;
  if (provider === "anthropic") {
    const content = Array.isArray(record.content) ? record.content : [];
    const textParts = content
      .map((part) =>
        part && typeof part === "object" ? (part as Record<string, unknown>).text : "",
      )
      .filter((part): part is string => typeof part === "string");
    return textParts.length > 0 ? textParts.join("\n") : null;
  }

  if (provider === "google") {
    const candidates = Array.isArray(record.candidates) ? record.candidates : [];
    const parts = candidates
      .flatMap((candidate) => {
        if (!candidate || typeof candidate !== "object") {
          return [];
        }
        const content = (candidate as Record<string, unknown>).content;
        if (!content || typeof content !== "object") {
          return [];
        }
        const innerParts = (content as Record<string, unknown>).parts;
        return Array.isArray(innerParts) ? innerParts : [];
      })
      .map((part) =>
        part && typeof part === "object" ? (part as Record<string, unknown>).text : "",
      )
      .filter((part): part is string => typeof part === "string");
    return parts.length > 0 ? parts.join("\n") : null;
  }

  const choices = Array.isArray(record.choices) ? record.choices : [];
  const content = choices[0] && typeof choices[0] === "object"
    ? (choices[0] as Record<string, unknown>).message
    : null;
  if (!content || typeof content !== "object") {
    return null;
  }
  const messageContent = (content as Record<string, unknown>).content;
  if (typeof messageContent === "string") {
    return messageContent;
  }
  if (!Array.isArray(messageContent)) {
    return null;
  }

  const parts = messageContent
    .map((part) =>
      part && typeof part === "object" ? (part as Record<string, unknown>).text : "",
    )
    .filter((part): part is string => typeof part === "string");
  return parts.length > 0 ? parts.join("\n") : null;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
