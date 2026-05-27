import type { FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import { z } from "zod";
import type { AuthConfig } from "../config.js";
import { verifyPassword } from "./password.js";
import { signSession, verifySession } from "./session.js";
import { LoginRateLimiter } from "./rate-limit.js";

export const SESSION_COOKIE = "spindle_session";
const loginSchema = z.object({ password: z.string().min(1) });

const OPEN_PATHS = new Set(["/health", "/ingest", "/api/auth/login", "/api/auth/logout", "/api/auth/me"]);

export function registerAuth(app: FastifyInstance, cfg: AuthConfig, now: () => number): void {
  app.register(cookie);
  const limiter = new LoginRateLimiter(5, 15 * 60 * 1000);

  app.addHook("onRequest", async (req, reply) => {
    const path = req.url.split("?")[0];
    if (OPEN_PATHS.has(path)) return;
    if (!path.startsWith("/api/")) return;
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token || !verifySession(token, cfg.sessionSecret, now())) {
      return reply.code(401).send({ error: "unauthorized" });
    }
  });

  app.post("/api/auth/login", async (req, reply) => {
    const decision = limiter.check(req.ip, Date.now());
    if (!decision.allowed) {
      return reply
        .code(429)
        .header("retry-after", Math.ceil(decision.retryAfterMs / 1000))
        .send({ error: "too many attempts" });
    }
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success || !verifyPassword(parsed.data.password, cfg.passwordHash)) {
      limiter.recordFailure(req.ip, Date.now());
      return reply.code(401).send({ error: "invalid credentials" });
    }
    limiter.reset(req.ip);
    const exp = now() + cfg.sessionDays * 86400;
    reply.setCookie(SESSION_COOKIE, signSession({ exp }, cfg.sessionSecret), {
      httpOnly: true,
      secure: cfg.cookieSecure,
      sameSite: "strict",
      path: "/",
      maxAge: cfg.sessionDays * 86400,
    });
    return { authenticated: true };
  });

  app.post("/api/auth/logout", async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { authenticated: false };
  });

  app.get("/api/auth/me", async (req) => {
    const token = req.cookies?.[SESSION_COOKIE];
    return { authenticated: !!token && verifySession(token, cfg.sessionSecret, now()) };
  });
}
