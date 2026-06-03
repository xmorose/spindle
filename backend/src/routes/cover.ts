import type { FastifyInstance } from "fastify";
import type { CoverConfig } from "../config.js";
import { proxyCover } from "../cover/proxy.js";

interface Params { id: string; }
interface Query { size?: string; }

export function registerCover(app: FastifyInstance, cfg: CoverConfig): void {
  app.get("/api/cover/:id", async (req, reply) => {
    const { id } = req.params as Params;
    const size = Math.min(Number((req.query as Query).size ?? 300) || 300, 1000);
    return proxyCover(cfg, id, size, reply);
  });
}
