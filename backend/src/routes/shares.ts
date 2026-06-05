import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Database } from "better-sqlite3";
import type { CoverConfig } from "../config.js";
import type { NavidromeReader } from "../db/navidrome-db.js";
import { ShareStore, MAX_SHARE_TRACKS, type ShareKind, type ShareRow } from "../shares/store.js";
import { renderSharePage, renderExpiredPage, type ShareData } from "../shares/render.js";
import { proxyStream, proxyCover } from "../cover/proxy.js";

interface Deps {
  statsDb: Database;
  reader: NavidromeReader;
  cover?: CoverConfig;
  now: () => number;
  webDir?: string;
}

// Resolve a stored share to its public, track-metadata-enriched form. Returns null if no
// referenced track still exists. Shared by the JSON API and the server-rendered page.
function resolveShare(reader: NavidromeReader, row: ShareRow): ShareData | null {
  const meta = reader.tracksById(row.trackIds);
  const tracks = row.trackIds
    .map((id) => meta.get(id))
    .filter((t): t is NonNullable<typeof t> => !!t)
    .map((t) => ({
      id: t.id, title: t.title, artist: t.artist, album: t.album,
      duration: t.duration, hasCover: t.hasCoverArt,
    }));
  if (tracks.length === 0) return null;
  return { kind: row.kind, label: row.label, expiresAt: row.expiresAt, tracks };
}

const createSchema = z.object({
  kind: z.enum(["track", "album", "queue"]),
  trackIds: z.array(z.string().min(1)).min(1).max(MAX_SHARE_TRACKS),
  label: z.string().max(200).optional(),
});

export function registerShares(app: FastifyInstance, deps: Deps): void {
  const store = new ShareStore(deps.statsDb);

  // Authenticated (gated by the /api/* auth hook): create a share.
  app.post("/api/shares", async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid share" });
    store.cleanupExpired(deps.now());
    const { kind, trackIds, label } = parsed.data;
    const row = store.create(kind as ShareKind, trackIds, label ?? null, deps.now());
    return { token: row.token };
  });

  // Public (exempt from auth): share metadata.
  app.get("/api/public/share/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    const row = store.get(token, deps.now());
    const share = row ? resolveShare(deps.reader, row) : null;
    if (!share) return reply.code(404).send({ error: "not found" });
    return share;
  });

  // Public (exempt from auth): the server-rendered share page. Returns a complete, styled
  // HTML page with a native <audio> player baked in, so the link works in any browser or
  // in-app webview even if the SPA's JavaScript never loads. When JS does load, the Vue
  // app reads window.__SHARE__ and enhances in place. Only registered when serving the SPA.
  if (deps.webDir) {
    const webDir = deps.webDir;
    let shell: string | null | undefined;
    const getShell = (): string | null => {
      if (shell === undefined) {
        try { shell = readFileSync(join(webDir, "index.html"), "utf8"); }
        catch { shell = null; }
      }
      return shell;
    };

    app.get("/s/:token", async (req, reply) => {
      const { token } = req.params as { token: string };
      reply.header("cache-control", "no-store").type("text/html; charset=utf-8");
      const row = store.get(token, deps.now());
      const share = row ? resolveShare(deps.reader, row) : null;
      if (!share) return reply.send(renderExpiredPage());
      const host = (req.headers["host"] as string | undefined) ?? "";
      const origin = host ? `${req.protocol}://${host}` : "";
      return reply.send(renderSharePage(getShell(), share, token, origin, deps.now()));
    });
  }

  // Public (exempt from auth): stream a track, only if it belongs to the share.
  app.get("/api/public/share/:token/stream/:trackId", async (req, reply) => {
    if (!deps.cover) return reply.code(404).send({ error: "not found" });
    const { token, trackId } = req.params as { token: string; trackId: string };
    const row = store.get(token, deps.now());
    if (!row || !row.trackIds.includes(trackId)) return reply.code(404).send({ error: "not found" });
    return proxyStream(deps.cover, trackId, req.headers["range"] as string | undefined, reply);
  });

  // Public (exempt from auth): cover for a track, only if it belongs to the share.
  app.get("/api/public/share/:token/cover/:trackId", async (req, reply) => {
    if (!deps.cover) return reply.code(404).send({ error: "not found" });
    const { token, trackId } = req.params as { token: string; trackId: string };
    const size = Math.min(Number((req.query as { size?: string }).size ?? 300) || 300, 1000);
    const row = store.get(token, deps.now());
    if (!row || !row.trackIds.includes(trackId)) return reply.code(404).send({ error: "not found" });
    return proxyCover(deps.cover, trackId, size, reply);
  });
}
