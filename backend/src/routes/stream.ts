import type { FastifyInstance } from "fastify";
import type { CoverConfig } from "../config.js";
import { proxyStream } from "../cover/proxy.js";

interface Params { id: string; }

export function registerStream(app: FastifyInstance, cfg: CoverConfig): void {
  app.get("/api/stream/:id", async (req, reply) => {
    const { id } = req.params as Params;
    return proxyStream(cfg, id, req.headers["range"] as string | undefined, reply);
  });
}
