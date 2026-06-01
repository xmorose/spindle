import type { FastifyInstance } from "fastify";
import { Readable } from "node:stream";
import type { CoverConfig } from "../config.js";
import { subsonicStreamUrl } from "../cover/subsonic.js";

interface Params { id: string; }

export function registerStream(app: FastifyInstance, cfg: CoverConfig): void {
  app.get("/api/stream/:id", async (req, reply) => {
    const { id } = req.params as Params;
    const range = req.headers["range"];
    let upstream: Response;
    try {
      upstream = await fetch(subsonicStreamUrl(cfg, id), { headers: range ? { range: String(range) } : {} });
    } catch {
      return reply.code(502).send({ error: "stream fetch failed" });
    }
    if (!upstream.ok && upstream.status !== 206) return reply.code(upstream.status === 404 ? 404 : 502).send({ error: "stream error" });
    const ctype = upstream.headers.get("content-type") ?? "audio/mpeg";
    if (ctype.includes("json")) return reply.code(404).send({ error: "not streamable" });
    reply.code(upstream.status);
    for (const h of ["content-type", "content-length", "accept-ranges", "content-range"]) {
      const v = upstream.headers.get(h);
      if (v) reply.header(h, v);
    }
    reply.header("cache-control", "no-store");
    return reply.send(upstream.body ? Readable.fromWeb(upstream.body as any) : Buffer.alloc(0));
  });
}
