import type { FastifyInstance } from "fastify";
import type { Database } from "better-sqlite3";
import type { NavidromeReader } from "../db/navidrome-db.js";
import type { MemoCache } from "../cache.js";
import { resolveTimeframe, type TimeframeQuery } from "../stats/timeframe.js";
import { entityDetail, type EntityKind } from "../stats/entity.js";

interface Opts { statsDb: Database; reader: NavidromeReader; cache: MemoCache; now: () => number; defaultUser: string; }
const KINDS: EntityKind[] = ["artist", "album", "track"];

export function registerEntity(app: FastifyInstance, o: Opts): void {
  app.get("/api/entity/:kind/:id", async (req, reply) => {
    const { kind, id } = req.params as { kind: string; id: string };
    if (!KINDS.includes(kind as EntityKind)) return reply.code(404).send({ error: "unknown entity kind" });
    const q = req.query as TimeframeQuery & { user?: string };
    const tf = resolveTimeframe(q, o.now());
    const user = q.user ?? o.defaultUser;
    const result = o.cache.get(JSON.stringify(["entity", kind, id, q, tf]), () =>
      entityDetail(o.statsDb, o.reader, kind as EntityKind, id, tf, user));
    if (!result) return reply.code(404).send({ error: "not found" });
    return result;
  });
}
