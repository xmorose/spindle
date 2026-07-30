import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import Database from "better-sqlite3";

function arg(args: string[], name: string, def: string): string {
  const f = args.find((a) => a.startsWith(`--${name}=`));
  return f ? f.slice(`--${name}=`.length) : def;
}

const args = process.argv.slice(2);
const navPath = arg(args, "navidrome", "") || process.env["NAVIDROME_DB_PATH"] || "";
const outPath = resolve(arg(args, "out", "./data/id-snapshot.json"));
if (!navPath) {
  console.error("Usage: migrate-ids-snapshot [--navidrome=<path>] [--out=./data/id-snapshot.json]");
  console.error("Navidrome DB path required (--navidrome=… or NAVIDROME_DB_PATH)");
  process.exit(1);
}

const db = new Database(navPath, { readonly: true, fileMustExist: true });
const rows = db.prepare("SELECT id,path FROM media_file").all() as { id: string; path: string }[];
db.close();

const legacy = rows.filter((r) => /^[0-9a-f]{32}$/i.test(r.id)).length;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({ takenAt: Math.floor(Date.now() / 1000), tracks: rows }, null, 0));

console.log(`snapshot: ${rows.length} tracks (${legacy} legacy 32-hex) -> ${outPath}`);
if (legacy === 0) console.log("no legacy ids found — this Navidrome may already be migrated");
