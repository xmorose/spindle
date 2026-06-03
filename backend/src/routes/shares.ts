import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Database } from "better-sqlite3";
import type { CoverConfig } from "../config.js";
import type { NavidromeReader } from "../db/navidrome-db.js";
import { ShareStore, MAX_SHARE_TRACKS, type ShareKind } from "../shares/store.js";
import { proxyStream, proxyCover } from "../cover/proxy.js";

interface Deps {
  statsDb: Database;
  reader: NavidromeReader;
  cover?: CoverConfig;
  now: () => number;
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
    if (!row) return reply.code(404).send({ error: "not found" });
    const meta = deps.reader.tracksById(row.trackIds);
    const tracks = row.trackIds
      .map((id) => meta.get(id))
      .filter((t): t is NonNullable<typeof t> => !!t)
      .map((t) => ({
        id: t.id, title: t.title, artist: t.artist, album: t.album,
        duration: t.duration, hasCover: t.hasCoverArt,
      }));
    if (tracks.length === 0) return reply.code(404).send({ error: "not found" });
    return { kind: row.kind, label: row.label, expiresAt: row.expiresAt, tracks };
  });

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
