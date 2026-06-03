import { randomBytes } from "node:crypto";
import type { Database } from "better-sqlite3";

export type ShareKind = "track" | "album" | "queue";
export const SHARE_TTL_SECONDS = 86_400; // 24h
export const MAX_SHARE_TRACKS = 200;

export interface ShareRow {
  token: string;
  kind: ShareKind;
  trackIds: string[];
  label: string | null;
  createdAt: number;
  expiresAt: number;
}

interface RawRow {
  token: string;
  kind: string;
  track_ids: string;
  label: string | null;
  created_at: number;
  expires_at: number;
}

export class ShareStore {
  constructor(private readonly db: Database) {}

  create(kind: ShareKind, trackIds: string[], label: string | null, now: number): ShareRow {
    const ids = trackIds.slice(0, MAX_SHARE_TRACKS);
    const token = randomBytes(16).toString("base64url");
    const createdAt = now;
    const expiresAt = now + SHARE_TTL_SECONDS;
    this.db
      .prepare("INSERT INTO shares (token,kind,track_ids,label,created_at,expires_at) VALUES (?,?,?,?,?,?)")
      .run(token, kind, JSON.stringify(ids), label, createdAt, expiresAt);
    return { token, kind, trackIds: ids, label, createdAt, expiresAt };
  }

  get(token: string, now: number): ShareRow | null {
    const row = this.db
      .prepare("SELECT token,kind,track_ids,label,created_at,expires_at FROM shares WHERE token=?")
      .get(token) as RawRow | undefined;
    if (!row || row.expires_at <= now) return null;
    return {
      token: row.token,
      kind: row.kind as ShareKind,
      trackIds: JSON.parse(row.track_ids) as string[],
      label: row.label,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }

  cleanupExpired(now: number): void {
    this.db.prepare("DELETE FROM shares WHERE expires_at <= ?").run(now);
  }
}
