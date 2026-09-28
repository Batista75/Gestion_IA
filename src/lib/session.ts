import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "gestion_session";
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export type Session = { id: string; mark: string; role: string };

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret && secret.length >= 16) return secret;
  return "gestion-ia-session-locale";
}

export function signSession(input: { id: string; mark: string; role?: string }): string {
  const body = Buffer.from(
    JSON.stringify({ id: input.id, mark: input.mark, role: input.role ?? "", exp: Date.now() + MAX_AGE_MS }),
  ).toString("base64url");
  const mac = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function readSessionToken(token: string | undefined): Session | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac("sha256", sessionSecret()).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      id?: unknown;
      mark?: unknown;
      role?: unknown;
      exp?: unknown;
    };
    if (typeof parsed.id !== "string" || typeof parsed.mark !== "string" || typeof parsed.exp !== "number") {
      return null;
    }
    if (!parsed.id || !parsed.mark || parsed.exp < Date.now()) return null;
    return { id: parsed.id, mark: parsed.mark, role: typeof parsed.role === "string" ? parsed.role : "" };
  } catch {
    return null;
  }
}

export function sessionMaxAgeSeconds(): number {
  return MAX_AGE_MS / 1000;
}
