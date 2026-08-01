import { createHash } from "node:crypto";
import type { Database as DB } from "better-sqlite3";

const B62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const HEX32 = /^[0-9a-fA-F]{32}$/;
const LIMIT = 1n << 128n;

function encode(bytes: Buffer): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (n > 0n) {
    out = B62[Number(n % 62n)] + out;
    n /= 62n;
  }
  return out.padStart(22, "0");
}

function parseBase62(s: string): bigint | null {
  let n = 0n;
  for (const ch of s) {
    const d = B62.indexOf(ch);
    if (d < 0) return null;
    n = n * 62n + BigInt(d);
  }
  return n;
}

export function canonicalId(s: string): string {
  if (s.length === 22) {
    const v = parseBase62(s);
    if (v === null || v < LIMIT) return s;
    return encode(createHash("md5").update(s).digest());
  }
  if (s.length === 32) {
    return HEX32.test(s) ? encode(Buffer.from(s, "hex")) : s;
  }
  if (s.length === 36) {
    if (s[8] !== "-" || s[13] !== "-" || s[18] !== "-" || s[23] !== "-") return s;
    const hex = s.slice(0, 8) + s.slice(9, 13) + s.slice(14, 18) + s.slice(19, 23) + s.slice(24);
    return HEX32.test(hex) ? encode(Buffer.from(hex, "hex")) : s;
  }
  return s;
}

export interface HealResult {
  plays: number;
  shares: number;
  unverified: number;
}

export interface IdSource {
  existingIds(ids: string[]): Set<string>;
}

export async function healLegacyIds(db: DB, source: IdSource, backupPath: string | null): Promise<HealResult | null> {
  const rows = db.prepare("SELECT DISTINCT nd_track_id AS id FROM play_events").all() as { id: string }[];
  const shareIds = new Set<string>();
  const shareRows = db.prepare("SELECT token,track_ids FROM shares").all() as { token: string; track_ids: string }[];
  for (const s of shareRows) {
    try {
      const parsed = JSON.parse(s.track_ids) as string[];
      if (Array.isArray(parsed)) for (const id of parsed) shareIds.add(id);
    } catch {}
  }

  const candidates = new Map<string, string>();
  for (const id of [...rows.map((r) => r.id), ...shareIds]) {
    const next = canonicalId(id);
    if (next !== id) candidates.set(id, next);
  }
  if (candidates.size === 0) return null;

  const present = source.existingIds([...new Set(candidates.values())]);
  const map = new Map([...candidates].filter(([, next]) => present.has(next)));
  const unverified = candidates.size - map.size;
  if (map.size === 0) {
    console.warn(
      `[spindle] id migration skipped: none of the ${candidates.size} converted ids exist in the navidrome library, so the conversion looks wrong for this version. nothing was changed`,
    );
    return null;
  }
  const shareUpdates: { token: string; trackIds: string }[] = [];
  for (const s of shareRows) {
    let ids: string[];
    try {
      ids = JSON.parse(s.track_ids) as string[];
    } catch {
      continue;
    }
    if (!Array.isArray(ids)) continue;
    const next = ids.map((id) => map.get(id) ?? id);
    if (next.some((v, i) => v !== ids[i])) shareUpdates.push({ token: s.token, trackIds: JSON.stringify(next) });
  }

  if (backupPath) {
    try {
      await db.backup(backupPath);
    } catch (err) {
      console.error(`[spindle] id migration skipped: could not write backup to ${backupPath}`, err);
      return null;
    }
  }

  const updPlay = db.prepare("UPDATE play_events SET nd_track_id=? WHERE nd_track_id=?");
  const updShare = db.prepare("UPDATE shares SET track_ids=? WHERE token=?");
  let plays = 0;
  db.transaction(() => {
    for (const [oldId, newId] of map) plays += updPlay.run(newId, oldId).changes;
    for (const s of shareUpdates) updShare.run(s.trackIds, s.token);
  })();

  return { plays, shares: shareUpdates.length, unverified };
}
