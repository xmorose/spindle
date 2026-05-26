import Database from "better-sqlite3";
import type { Database as DB } from "better-sqlite3";

export interface TrackMeta {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  album: string;
  albumId: string;
  duration: number;
  genre: string;
  hasCoverArt: boolean;
}

export interface BaselineRow {
  user: string;
  nd_track_id: string;
  play_count: number;
}

export class NavidromeReader {
  private readonly db: DB;

  constructor(source: string | DB) {
    this.db =
      typeof source === "string"
        ? new Database(source, { readonly: true, fileMustExist: true })
        : source;
  }

  tracksById(ids: string[]): Map<string, TrackMeta> {
    const result = new Map<string, TrackMeta>();
    if (ids.length === 0) return result;
    const placeholders = ids.map(() => "?").join(",");
    const rows = this.db
      .prepare(
        `SELECT id,title,artist,artist_id,album,album_id,duration,genre,has_cover_art
         FROM media_file WHERE id IN (${placeholders})`,
      )
      .all(...ids) as any[];
    for (const r of rows) {
      result.set(r.id, {
        id: r.id,
        title: r.title,
        artist: r.artist,
        artistId: r.artist_id,
        album: r.album,
        albumId: r.album_id,
        duration: r.duration,
        genre: r.genre ?? "",
        hasCoverArt: !!r.has_cover_art,
      });
    }
    return result;
  }

  baselinePlayCounts(): BaselineRow[] {
    return this.db
      .prepare(
        `SELECT u.user_name AS user, a.item_id AS nd_track_id, a.play_count AS play_count
         FROM annotation a
         JOIN user u ON u.id = a.user_id
         WHERE a.item_type='media_file' AND a.play_count > 0`,
      )
      .all() as BaselineRow[];
  }

  static empty(): NavidromeReader {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE IF NOT EXISTS media_file (
        id TEXT PRIMARY KEY, title TEXT, album TEXT, artist TEXT,
        artist_id TEXT, album_artist TEXT, album_id TEXT,
        has_cover_art INTEGER DEFAULT 0, duration REAL DEFAULT 0,
        genre TEXT DEFAULT '', year INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS annotation (
        user_id TEXT, item_id TEXT, item_type TEXT,
        play_count INTEGER DEFAULT 0, play_date TEXT
      );
      CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY, user_name TEXT);
    `);
    return new NavidromeReader(db);
  }
}
