import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface AuthSession {
  token: string;
  exp: number | null;
  savedAt: string;
}

const SESSION_DIR = path.join(os.homedir(), ".6flow");
const SESSION_FILE = path.join(SESSION_DIR, "tui-auth.json");

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

export function decodeJwtExp(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export function isSessionValid(session: AuthSession | null): session is AuthSession {
  if (!session || !session.token || typeof session.exp !== "number") {
    return false;
  }

  // 5-second skew buffer.
  return session.exp * 1000 > Date.now() + 5000;
}

export async function loadAuthSession(): Promise<AuthSession | null> {
  try {
    const raw = await fs.readFile(SESSION_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (typeof parsed.token !== "string") return null;

    return {
      token: parsed.token,
      exp: typeof parsed.exp === "number" ? parsed.exp : decodeJwtExp(parsed.token),
      savedAt:
        typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function saveAuthSession(token: string): Promise<AuthSession> {
  const session: AuthSession = {
    token,
    exp: decodeJwtExp(token),
    savedAt: new Date().toISOString(),
  };

  await fs.mkdir(SESSION_DIR, { recursive: true });
  await fs.writeFile(SESSION_FILE, JSON.stringify(session, null, 2), {
    mode: 0o600,
  });
  await fs.chmod(SESSION_FILE, 0o600);

  return session;
}

export async function clearAuthSession(): Promise<void> {
  try {
    await fs.rm(SESSION_FILE, { force: true });
  } catch {
    // No-op.
  }
}
