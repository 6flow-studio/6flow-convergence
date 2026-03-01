import { NextResponse } from "next/server";
import { executeNodePreview } from "@/lib/node-execution/server";
import { NodeExecutionError } from "@/lib/node-execution/errors";
import { inferDataSchema, sanitizeExecutionValue } from "@/lib/node-execution/schema";
import type {
  ExecuteNodeErrorResponse,
  ExecuteNodeRequest,
  ExecuteNodeResponse,
} from "@/lib/node-execution/shared";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExecuteNodeRequest;
    if (!body?.workflow || typeof body.nodeId !== "string") {
      return NextResponse.json<ExecuteNodeErrorResponse>(
        {
          error: "Request must include a workflow and nodeId.",
          code: "invalid_request",
        },
        { status: 400 },
      );
    }

    const executed = await executeNodePreview(body.workflow, body.nodeId);
    const sanitizedRaw = sanitizeExecutionValue(executed.raw);
    const sanitizedNormalized = sanitizeExecutionValue(executed.normalized);

    const response: ExecuteNodeResponse = {
      preview: {
        raw: sanitizedRaw.value,
        normalized: sanitizedNormalized.value,
        warnings: executed.warnings,
        truncated: sanitizedRaw.truncated || sanitizedNormalized.truncated,
      },
      schema: inferDataSchema(sanitizedNormalized.value),
      executedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof NodeExecutionError) {
      return NextResponse.json<ExecuteNodeErrorResponse>(
        {
          error: error.message,
          code: error.code,
        },
        { status: error.status },
      );
    }

    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json<ExecuteNodeErrorResponse>(
      {
        error: "Node execution preview failed.",
        code: "execution_failed",
        detail,
      },
      { status: 500 },
    );
  }
}
