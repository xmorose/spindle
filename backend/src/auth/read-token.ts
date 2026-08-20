import { timingSafeEqual } from "node:crypto";

const EXACT_PATHS = new Set([
  "/api/totals",
  "/api/timeseries",
  "/api/heatmap",
  "/api/sessions",
  "/api/recent",
  "/api/search",
  "/api/users",
]);

const PATH_PREFIXES = ["/api/tops/", "/api/entity/", "/api/cover/"];

const ALBUM_TRACKS = /^\/api\/album\/[^/]+\/tracks$/;

export function isReadPath(path: string): boolean {
  if (EXACT_PATHS.has(path)) return true;
  if (PATH_PREFIXES.some((p) => path.startsWith(p))) return true;
  return ALBUM_TRACKS.test(path);
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1]! : null;
}

export function tokenMatches(presented: string | null, expected: string): boolean {
  if (!presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
