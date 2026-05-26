import type { FastifyInstance } from "fastify";
import type { Database } from "better-sqlite3";
import type { NavidromeReader } from "../db/navidrome-db.js";
import type { MemoCache } from "../cache.js";
import { resolveTimeframe, type TimeframeQuery } from "../stats/timeframe.js";
import { topArtists, topAlbums, topTracks, topGenres, type Sort } from "../stats/tops.js";
import { computeTotals } from "../stats/totals.js";
import { computeHeatmap } from "../stats/heatmap.js";
import { computeTimeseries, type Bucketing } from "../stats/timeseries.js";
import { longestSessions } from "../stats/sessions.js";

interface Opts {
  statsDb: Database;
  reader: NavidromeReader;
  cache: MemoCache;
  now: () => number;
  sessionGapSeconds: number;
  defaultUser: string;
}

interface Q extends TimeframeQuery {
  sort?: Sort;
  limit?: string;
  user?: string;
  bucket?: Bucketing;
}

export function registerStats(app: FastifyInstance, o: Opts): void {
  const key = (parts: unknown[]) => JSON.stringify(parts);

  function tf(q: Q) { return resolveTimeframe(q, o.now()); }
  function user(q: Q) { return q.user ?? o.defaultUser; }
  function sort(q: Q): Sort { return q.sort === "time" ? "time" : "plays"; }
  function limit(q: Q) { return Math.min(Number(q.limit ?? 50), 200); }

  app.get("/api/tops/artists", async (req) => {
    const q = req.query as Q;
    const t = tf(q);
    return o.cache.get(key(["artists", q, t]), () => topArtists(o.statsDb, o.reader, t, user(q), sort(q), limit(q)));
  });
  app.get("/api/tops/albums", async (req) => {
    const q = req.query as Q;
    const t = tf(q);
    return o.cache.get(key(["albums", q, t]), () => topAlbums(o.statsDb, o.reader, t, user(q), sort(q), limit(q)));
  });
  app.get("/api/tops/tracks", async (req) => {
    const q = req.query as Q;
    const t = tf(q);
    return o.cache.get(key(["tracks", q, t]), () => topTracks(o.statsDb, o.reader, t, user(q), sort(q), limit(q)));
  });
  app.get("/api/tops/genres", async (req) => {
    const q = req.query as Q;
    const t = tf(q);
    return o.cache.get(key(["genres", q, t]), () => topGenres(o.statsDb, o.reader, t, user(q), sort(q), limit(q)));
  });
  app.get("/api/totals", async (req) => {
    const q = req.query as Q;
    const t = tf(q);
    return o.cache.get(key(["totals", q, t]), () => computeTotals(o.statsDb, o.reader, t, user(q)));
  });
  app.get("/api/heatmap", async (req) => {
    const q = req.query as Q;
    const t = tf(q);
    return o.cache.get(key(["heatmap", q, t]), () => computeHeatmap(o.statsDb, t, user(q)));
  });
  app.get("/api/timeseries", async (req) => {
    const q = req.query as Q;
    const t = tf(q);
    const bucket: Bucketing = q.bucket === "week" || q.bucket === "month" ? q.bucket : "day";
    return o.cache.get(key(["timeseries", q, t, bucket]), () => computeTimeseries(o.statsDb, o.reader, t, user(q), bucket));
  });
  app.get("/api/sessions", async (req) => {
    const q = req.query as Q;
    const t = tf(q);
    return o.cache.get(key(["sessions", q, t]), () => longestSessions(o.statsDb, o.reader, t, user(q), o.sessionGapSeconds, limit(q)));
  });
}
