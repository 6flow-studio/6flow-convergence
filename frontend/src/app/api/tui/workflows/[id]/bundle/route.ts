import { fetchQuery } from "convex/nextjs";
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

export async function GET(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = await Promise.resolve(context.params);
  let id = resolvedParams?.id?.trim() ?? "";
  if (!id) {
    const segments = request.nextUrl.pathname.split("/").filter(Boolean);
    // /api/tui/workflows/:id/bundle
    if (segments.length >= 5 && segments[0] === "api" && segments[1] === "tui" && segments[2] === "workflows") {
      id = segments[3] ?? "";
    }
  }

  if (!id) {
    return NextResponse.json({ error: "Workflow id is required" }, { status: 400 });
  }

  try {
    const artifact = await fetchQuery(
      api.workflows.getCompiledArtifactForTui,
      { id: id as Id<"workflows"> },
      { token }
    );

    if (!artifact) {
      return NextResponse.json(
        { error: "Compiled artifact not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        downloadUrl: artifact.downloadUrl,
        fileName: artifact.fileName,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (isUnauthorizedError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    console.error("[tui/workflows/:id/bundle] failed to fetch artifact", error);
    return NextResponse.json(
      { error: "Failed to download compiled bundle", detail: errorMessage },
      { status: 500 }
    );
  }
}
