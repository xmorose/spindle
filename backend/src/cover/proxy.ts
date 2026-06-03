import type { FastifyReply } from "fastify";
import { Readable } from "node:stream";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { CoverConfig } from "../config.js";
import { subsonicCoverUrl, subsonicStreamUrl } from "./subsonic.js";

export async function proxyStream(
  cfg: CoverConfig,
  id: string,
  range: string | undefined,
  reply: FastifyReply,
): Promise<FastifyReply> {
  let upstream: Response;
  try {
    upstream = await fetch(subsonicStreamUrl(cfg, id), { headers: range ? { range: String(range) } : {} });
  } catch {
    return reply.code(502).send({ error: "stream fetch failed" });
  }
  if (!upstream.ok && upstream.status !== 206) {
    return reply.code(upstream.status === 404 ? 404 : 502).send({ error: "stream error" });
  }
  const ctype = upstream.headers.get("content-type") ?? "audio/mpeg";
  if (ctype.includes("json")) return reply.code(404).send({ error: "not streamable" });
  reply.code(upstream.status);
  for (const h of ["content-type", "content-length", "accept-ranges", "content-range"]) {
    const v = upstream.headers.get(h);
    if (v) reply.header(h, v);
  }
  reply.header("cache-control", "no-store");
  return reply.send(upstream.body ? Readable.fromWeb(upstream.body as any) : Buffer.alloc(0));
}

export async function proxyCover(
  cfg: CoverConfig,
  id: string,
  size: number,
  reply: FastifyReply,
): Promise<FastifyReply> {
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
}
