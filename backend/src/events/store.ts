import type { Database } from "better-sqlite3";

export interface LiveEvent {
  played_at: number;
  user: string;
  nd_track_id: string;
}

export class EventStore {
  constructor(private readonly db: Database) {}

  insertLive(e: LiveEvent): boolean {
    const exists = this.db
      .prepare(
        "SELECT 1 FROM play_events WHERE source='live' AND user=? AND nd_track_id=? AND played_at=? LIMIT 1",
      )
      .get(e.user, e.nd_track_id, e.played_at);
    if (exists) return false;
    this.db
      .prepare(
        "INSERT INTO play_events (played_at,user,nd_track_id,source) VALUES (?,?,?,'live')",
      )
      .run(e.played_at, e.user, e.nd_track_id);
    return true;
  }

  count(): number {
    return (this.db.prepare("SELECT COUNT(*) AS n FROM play_events").get() as { n: number }).n;
  }

  hasBaseline(): boolean {
    const row = this.db
      .prepare("SELECT 1 FROM play_events WHERE source='baseline' LIMIT 1")
      .get();
    return !!row;
  }
}
