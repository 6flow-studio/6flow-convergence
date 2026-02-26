import { fetchQuery } from "convex/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";

interface TuiWorkflowDto {
  id: string;
  name: string;
  updatedAt: number;
  nodeCount: number;
  status: "ready" | "draft";
  compilerVersion: string;
}

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;

  return token.trim();
}

function parseNodeCount(nodesJson: string): number {
  try {
    const parsed = JSON.parse(nodesJson);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
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

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const workflows = await fetchQuery(api.workflows.list, {}, { token });

    const normalized: TuiWorkflowDto[] = workflows.map((workflow) => ({
      id: workflow._id,
      name: workflow.name,
      updatedAt: workflow.updatedAt,
      nodeCount: parseNodeCount(workflow.nodes),
      status: workflow.compiledArtifactStorageId ? "ready" : "draft",
      compilerVersion: workflow.compiledArtifactCompilerVersion ?? "",
    }));

    return NextResponse.json({ workflows: normalized }, { status: 200 });
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("[tui/workflows] failed to fetch workflows", error);
    return NextResponse.json(
      { error: "Failed to load workflows" },
      { status: 500 }
    );
  }
}
