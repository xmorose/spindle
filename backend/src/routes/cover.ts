import type { FastifyInstance } from "fastify";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { CoverConfig } from "../config.js";
import { subsonicCoverUrl } from "../cover/subsonic.js";

interface Params { id: string; }
interface Query { size?: string; }

export function registerCover(app: FastifyInstance, cfg: CoverConfig): void {
  app.get("/api/cover/:id", async (req, reply) => {
    const { id } = req.params as Params;
    const size = Math.min(Number((req.query as Query).size ?? 300) || 300, 1000);
    const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const file = join(cfg.cacheDir, `${safe}_${size}`);
    const typeFile = `${file}.type`;

    if (existsSync(file)) {
      const type = existsSync(typeFile) ? await readFile(typeFile, "utf8") : "image/jpeg";
      return reply.header("content-type", type).header("cache-control", "public, max-age=604800").send(await readFile(file));
    }

    let res: Response;
    try {
      res = await fetch(subsonicCoverUrl(cfg, id, size));
    } catch {
      return reply.code(502).send({ error: "cover fetch failed" });
    }
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || type.includes("json") || !type.startsWith("image/")) {
      return reply.code(404).send({ error: "no cover" });
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(cfg.cacheDir, { recursive: true });
    await writeFile(typeFile, type);
    await writeFile(file, buf);
    return reply.header("content-type", type).header("cache-control", "public, max-age=604800").send(buf);
  });
}
