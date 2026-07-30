import { readFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";

function arg(args: string[], name: string, def: string): string {
  const f = args.find((a) => a.startsWith(`--${name}=`));
  return f ? f.slice(`--${name}=`.length) : def;
}

const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function encode128(hex: string): string {
  let n = BigInt(`0x${hex}`);
  const base = 62n;
  let out = "";
  while (n > 0n) {
    out = B62[Number(n % base)] + out;
    n /= base;
  }
  return out.padStart(22, B62[0]);
}

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const navPath = arg(args, "navidrome", "") || process.env["NAVIDROME_DB_PATH"] || "";
const statsPath = resolve(arg(args, "stats", "") || process.env["STATS_DB_PATH"] || "./data/stats.db");
const snapPath = resolve(arg(args, "snapshot", "./data/id-snapshot.json"));
if (!navPath) {
  console.error("Usage: migrate-ids-remap [--navidrome=<path>] [--stats=<path>] [--snapshot=<path>] [--apply]");
  console.error("Navidrome DB path required (--navidrome=… or NAVIDROME_DB_PATH)");
  process.exit(1);
}

const snap = JSON.parse(readFileSync(snapPath, "utf8")) as { tracks: { id: string; path: string }[] };
const nav = new Database(navPath, { readonly: true, fileMustExist: true });
const now = nav.prepare("SELECT id,path FROM media_file").all() as { id: string; path: string }[];
nav.close();

const newByPath = new Map(now.map((r) => [r.path, r.id]));
const map = new Map<string, string>();
let unmatched = 0;
let checked = 0;
let disagreed = 0;
for (const t of snap.tracks) {
  const next = newByPath.get(t.path);
  if (!next) { unmatched++; continue; }
  if (next === t.id) continue;
  map.set(t.id, next);
  if (/^[0-9a-f]{32}$/i.test(t.id)) {
    checked++;
    if (encode128(t.id) !== next) disagreed++;
  }
}

console.log(`snapshot ${snap.tracks.length} tracks | remapped ${map.size} | unchanged ${snap.tracks.length - map.size - unmatched} | path-unmatched ${unmatched}`);
console.log(`base62 cross-check: ${checked - disagreed}/${checked} agree${disagreed ? ` (${disagreed} disagree — path join wins)` : ""}`);
if (unmatched) console.log("path-unmatched tracks keep their old ids; their plays will not resolve until rescanned");

const stats = new Database(statsPath, { fileMustExist: true });
const affected = stats.prepare("SELECT COUNT(*) AS n FROM play_events").get() as { n: number };
const shareRows = stats.prepare("SELECT token,track_ids FROM shares").all() as { token: string; track_ids: string }[];

if (!apply) {
  console.log(`dry run: would rewrite up to ${affected.n} play_events rows and ${shareRows.length} share rows`);
  console.log("re-run with --apply to write");
  stats.close();
  process.exit(0);
}

const backup = `${statsPath}.pre-id-migration.bak`;
copyFileSync(statsPath, backup);
console.log(`backup -> ${backup}`);

const upd = stats.prepare("UPDATE play_events SET nd_track_id=? WHERE nd_track_id=?");
const updShare = stats.prepare("UPDATE shares SET track_ids=? WHERE token=?");
let plays = 0;
let shares = 0;
const tx = stats.transaction(() => {
  for (const [oldId, newId] of map) plays += upd.run(newId, oldId).changes;
  for (const s of shareRows) {
    const ids = JSON.parse(s.track_ids) as string[];
    if (!ids.some((id) => map.has(id))) continue;
    updShare.run(JSON.stringify(ids.map((id) => map.get(id) ?? id)), s.token);
    shares++;
  }
});
tx();
stats.close();

console.log(`rewrote ${plays} play_events rows, ${shares} shares`);
