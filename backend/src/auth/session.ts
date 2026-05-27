import { createHmac, timingSafeEqual } from "node:crypto";

export interface SessionPayload {
  exp: number;
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function signSession(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function verifySession(token: string, secret: string, nowSec: number): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [body, mac] = parts;
    if (!body || !mac) return false;
    const expected = Buffer.from(sign(body, secret), "base64url");
    const actual = Buffer.from(mac, "base64url");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    return typeof payload.exp === "number" && payload.exp > nowSec;
  } catch {
    return false;
  }
}
