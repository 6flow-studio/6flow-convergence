import { randomBytes } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { URL } from "node:url";

interface BrowserLoginOptions {
  webBaseUrl: string;
  timeoutMs?: number;
  onLog?: (message: string) => void;
}

interface BrowserLoginResult {
  token: string;
}

interface CallbackBody {
  token?: unknown;
  nonce?: unknown;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function readJsonBody(request: IncomingMessage): Promise<CallbackBody> {
  return new Promise((resolve, reject) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk.toString();
      if (raw.length > 32_000) {
        reject(new Error("Request body too large"));
      }
    });

    request.on("end", () => {
      try {
        resolve(JSON.parse(raw) as CallbackBody);
      } catch {
        reject(new Error("Invalid JSON payload"));
      }
    });

    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.end(JSON.stringify(body));
}

function tryOpenBrowser(url: string): boolean {
  try {
    if (process.platform === "darwin") {
      const child = spawn("open", [url], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      return true;
    }

    if (process.platform === "win32") {
      const child = spawn("cmd", ["/c", "start", "", url], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      return true;
    }

    const child = spawn("xdg-open", [url], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

export async function runBrowserLoginFlow(
  options: BrowserLoginOptions
): Promise<BrowserLoginResult> {
  const webBaseUrl = normalizeBaseUrl(options.webBaseUrl);
  const timeoutMs = options.timeoutMs ?? 180_000;
  const nonce = randomBytes(16).toString("hex");

  return await new Promise<BrowserLoginResult>((resolve, reject) => {
    const server = createServer(async (request, response) => {
      if (request.method === "OPTIONS") {
        response.statusCode = 204;
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");
        response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        response.end();
        return;
      }

      if (request.method !== "POST" || request.url !== "/callback") {
        sendJson(response, 404, { error: "Not found" });
        return;
      }

      try {
        const body = await readJsonBody(request);
        if (body.nonce !== nonce) {
          sendJson(response, 400, { error: "Invalid nonce" });
          return;
        }
        if (typeof body.token !== "string" || body.token.length === 0) {
          sendJson(response, 400, { error: "Token is required" });
          return;
        }

        sendJson(response, 200, { ok: true });
        settle(null, { token: body.token });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Invalid callback payload";
        sendJson(response, 400, { error: message });
      }
    });

    let settled = false;

    const settle = (error: Error | null, result?: BrowserLoginResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      server.close();
      if (error) {
        reject(error);
      } else if (result) {
        resolve(result);
      }
    };

    const timeoutId = setTimeout(() => {
      settle(new Error("Authentication timed out"));
    }, timeoutMs);

    server.on("error", (error) => {
      settle(error instanceof Error ? error : new Error("Callback server failed"));
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        settle(new Error("Failed to start callback server"));
        return;
      }

      const callback = new URL("http://127.0.0.1");
      callback.port = String(address.port);
      callback.pathname = "/callback";

      const browserUrl = `${webBaseUrl}/tui/link?callback=${encodeURIComponent(
        callback.toString()
      )}&nonce=${encodeURIComponent(nonce)}`;

      options.onLog?.("Waiting for browser authentication...");
      options.onLog?.(`Open this URL if browser does not open: ${browserUrl}`);
      if (!tryOpenBrowser(browserUrl)) {
        options.onLog?.("Could not auto-open browser. Please open the URL manually.");
      }
    });
  });
}
