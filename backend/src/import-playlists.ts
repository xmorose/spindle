import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import Database from "better-sqlite3";
import { buildIndex, matchPlaylist } from "./import/spotify.js";
import type { NavTrack } from "./import/spotify.js";

interface RawPlaylist { name?: string; items?: ({ track?: { trackName?: string; artistName?: string } | null } | null)[]; }

function arg(args: string[], name: string, def: string): string {
  const f = args.find((a) => a.startsWith(`--${name}=`));
  return f ? f.slice(`--${name}=`.length) : def;
}
function sanitize(name: string): string {
  const s = (name || "playlist").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim();
  return (s || "playlist").slice(0, 120);
}
function mdEsc(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
if (!dir) {
  console.error("Usage: import-playlists <dir-with-Playlist*.json> [--out=./playlists] [--navidrome=<path>] [--min=1]");
  process.exit(1);
}
const outDir = resolve(arg(args, "out", "./playlists"));
const navPath = arg(args, "navidrome", "") || process.env["NAVIDROME_DB_PATH"] || "";
const min = Number(arg(args, "min", "1"));
if (!navPath) { console.error("Navidrome DB path required (--navidrome=… or NAVIDROME_DB_PATH)"); process.exit(1); }

const srcDir = resolve(dir);
const files = readdirSync(srcDir).filter((f) => /playlist\d*\.json$/i.test(f));
const playlists: RawPlaylist[] = files.flatMap((f) => {
  const j = JSON.parse(readFileSync(join(srcDir, f), "utf8")) as { playlists?: RawPlaylist[] };
  return Array.isArray(j.playlists) ? j.playlists : [];
});

const db = new Database(navPath, { readonly: true, fileMustExist: true });
const tracks = db.prepare("SELECT id,title,artist,duration,path FROM media_file").all() as NavTrack[];
db.close();
const index = buildIndex(tracks);

mkdirSync(outDir, { recursive: true });

let written = 0, totalMatched = 0, totalTracks = 0;
const summaryRows: string[] = [];
const detailSections: string[] = [];

for (const pl of playlists) {
  const name = pl.name ?? "(unnamed)";
  const items = (pl.items ?? [])
    .map((i) => ({ artist: i?.track?.artistName ?? "", title: i?.track?.trackName ?? "" }))
    .filter((i) => i.artist && i.title);
  if (!items.length) continue;
  const r = matchPlaylist(items, index);
  totalMatched += r.matched; totalTracks += r.total;

  if (r.matched >= min) {
    writeFileSync(join(outDir, `${sanitize(name)}.m3u8`), "#EXTM3U\n" + r.matchedPaths.join("\n") + "\n", "utf8");
    written++;
  }

  summaryRows.push(`| ${mdEsc(name)} | ${r.matched} | ${r.total} |`);
  const section = [`## ${mdEsc(name)} — matched ${r.matched} / ${r.total}`];
  if (r.unmatched.length) {
    section.push("", `Missing (${r.unmatched.length}) — not in your Navidrome library:`, "");
    for (const u of r.unmatched) section.push(`- ${mdEsc(u.artist)} — ${mdEsc(u.title)}`);
  } else {
    section.push("", "_All tracks matched._");
  }
  detailSections.push(section.join("\n"));
}

const md = [
  "# Spotify playlists → Navidrome",
  "",
  `Playlists: ${playlists.length}  ·  tracks matched: ${totalMatched} / ${totalTracks}  ·  .m3u8 written: ${written}`,
  "",
  "| Playlist | Matched | Total |",
  "| --- | --: | --: |",
  ...summaryRows,
  "",
  ...detailSections,
  "",
].join("\n");
writeFileSync(join(outDir, "playlists-report.md"), md, "utf8");

console.log("Spotify playlists → Navidrome .m3u8");
console.log(`  Playlists found:      ${playlists.length}`);
console.log(`  .m3u8 written (>=${min}): ${written}`);
console.log(`  Tracks matched:       ${totalMatched} / ${totalTracks}`);
console.log(`  Output dir:           ${outDir}  (playlists-report.md has per-playlist missing tracks)`);
console.log("Per playlist (matched / total):");
for (const pl of playlists) {
  const items = (pl.items ?? []).map((i) => ({ a: i?.track?.artistName, t: i?.track?.trackName })).filter((i) => i.a && i.t);
  if (!items.length) continue;
  const r = matchPlaylist(items.map((i) => ({ artist: i.a as string, title: i.t as string })), index);
  console.log(`  ${String(r.matched).padStart(4)}/${String(r.total).padEnd(5)} ${pl.name ?? "(unnamed)"}`);
}
