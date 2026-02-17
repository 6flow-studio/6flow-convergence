export interface FrontendWorkflow {
  id: string;
  name: string;
  updatedAt: number;
  nodeCount: number;
  status: "ready" | "draft";
}

interface WorkflowsResponse {
  workflows?: FrontendWorkflow[];
  error?: string;
}

export class FrontendUnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "FrontendUnauthorizedError";
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

export async function fetchFrontendWorkflows(params: {
  baseUrl: string;
  token: string;
}): Promise<FrontendWorkflow[]> {
  const url = `${normalizeBaseUrl(params.baseUrl)}/api/tui/workflows`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.token}`,
      Accept: "application/json",
    },
  });

  let payload: WorkflowsResponse | null = null;
  try {
    payload = (await response.json()) as WorkflowsResponse;
  } catch {
    payload = null;
  }

  if (response.status === 401) {
    throw new FrontendUnauthorizedError(payload?.error ?? "Unauthorized");
  }

  if (!response.ok) {
    const message = payload?.error ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (!payload || !Array.isArray(payload.workflows)) {
    throw new Error("Invalid API response from /api/tui/workflows");
  }

  return payload.workflows;
}
