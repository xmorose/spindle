import type { Database } from "better-sqlite3";
import type { EventStore } from "./events/store.js";
import type { NavidromeReader } from "./db/navidrome-db.js";

export function importBaseline(
  db: Database,
  store: EventStore,
  reader: NavidromeReader,
): number {
  if (store.hasBaseline()) return 0;
  const rows = reader.baselinePlayCounts();
  const stmt = db.prepare(
    "INSERT INTO play_events (played_at,user,nd_track_id,source) VALUES (0,?,?,'baseline')",
  );
  let inserted = 0;
  const tx = db.transaction(() => {
    for (const r of rows) {
      for (let i = 0; i < r.play_count; i++) {
        stmt.run(r.user, r.nd_track_id);
        inserted++;
      }
    }
  });
  tx();
  return inserted;
}
