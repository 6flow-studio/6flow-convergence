import { fetchMutation, fetchQuery } from "convex/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { Id } from "../../../../../../../convex/_generated/dataModel";
import { api } from "../../../../../../../convex/_generated/api";

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;

  return token.trim();
}

function isUnauthorizedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("unauth") ||
    message.includes("not authenticated") ||
    message.includes("invalid token")
  );
}

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.toLowerCase().includes("not found");
}

interface SecretReference {
  name: string;
}

interface WorkflowGlobalConfig {
  isTestnet: boolean;
  defaultChainSelector: string;
  secrets: SecretReference[];
  rpcs: Array<{ chainName: string; url: string }>;
}

function parseGlobalConfig(raw: string | undefined): WorkflowGlobalConfig {
  if (!raw) {
    return {
      isTestnet: true,
      defaultChainSelector: "ethereum-testnet-sepolia",
      secrets: [],
      rpcs: [],
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<WorkflowGlobalConfig>;
    const secrets = Array.isArray(parsed.secrets)
      ? parsed.secrets
          .filter((s): s is SecretReference => Boolean(s && typeof s.name === "string"))
          .map((s) => ({ name: s.name.trim() }))
          .filter((s) => s.name.length > 0)
      : [];
    const rpcs = Array.isArray(parsed.rpcs)
      ? parsed.rpcs.filter(
          (r): r is { chainName: string; url: string } =>
            Boolean(
              r &&
                typeof r.chainName === "string" &&
                typeof r.url === "string"
            )
        )
      : [];
    return {
      isTestnet: typeof parsed.isTestnet === "boolean" ? parsed.isTestnet : true,
      defaultChainSelector:
        typeof parsed.defaultChainSelector === "string" &&
        parsed.defaultChainSelector.trim().length > 0
          ? parsed.defaultChainSelector
          : "ethereum-testnet-sepolia",
      secrets,
      rpcs,
    };
  } catch {
    return {
      isTestnet: true,
      defaultChainSelector: "ethereum-testnet-sepolia",
      secrets: [],
      rpcs: [],
    };
  }
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = await Promise.resolve(context.params);
  const id = resolvedParams?.id?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "Workflow id is required" }, { status: 400 });
  }

  let body: { action?: string; secretName?: string };
  try {
    body = (await request.json()) as { action?: string; secretName?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = (body.action ?? "").trim().toLowerCase();
  const secretName = (body.secretName ?? "").trim();
  if (action !== "add" && action !== "remove") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }
  if (!secretName) {
    return NextResponse.json({ error: "secretName is required" }, { status: 400 });
  }

  try {
    const workflow = await fetchQuery(
      api.workflows.load,
      { id: id as Id<"workflows"> },
      { token }
    );
    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const globalConfig = parseGlobalConfig(workflow.globalConfig);
    const secretSet = new Set(globalConfig.secrets.map((s) => s.name));
    if (action === "add") {
      secretSet.add(secretName);
    } else {
      secretSet.delete(secretName);
    }

    globalConfig.secrets = Array.from(secretSet)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ name }));

    await fetchMutation(
      api.workflows.save,
      {
        id: workflow._id,
        name: workflow.name,
        description: workflow.description,
        nodes: workflow.nodes,
        edges: workflow.edges,
        globalConfig: JSON.stringify(globalConfig),
      },
      { token }
    );

    return NextResponse.json(
      { ok: true, action, secretName, secretCount: globalConfig.secrets.length },
      { status: 200 }
    );
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error("[tui/workflows/:id/secrets] failed to update secret", error);
    return NextResponse.json(
      { error: "Failed to update workflow secrets", detail },
      { status: 500 }
    );
  }
}
