import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import Database from "better-sqlite3";
import { buildIndex, classify } from "./import/spotify.js";
import type { NavTrack } from "./import/spotify.js";
import { openStatsDb } from "./db/stats-db.js";
import { EventStore } from "./events/store.js";

function parseArgs(argv: string[]): {
  historyDir: string;
  commit: boolean;
  threshold: number;
  user: string;
  out: string;
  navidrome: string | null;
  stats: string | null;
} {
  const args = argv.slice(2);
  const historyDir = args.find((a) => !a.startsWith("--")) ?? "";
  const flag = (name: string, def: string): string => {
    const f = args.find((a) => a.startsWith(`--${name}=`));
    return f ? f.slice(`--${name}=`.length) : def;
  };
  return {
    historyDir,
    commit: args.includes("--commit"),
    threshold: Number(flag("threshold", "30000")),
    user: flag("user", "morose"),
    out: flag("out", "./import-report"),
    navidrome: flag("navidrome", "") || null,
    stats: flag("stats", "") || null,
  };
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function pct(part: number, total: number): string {
  if (total === 0) return "0.0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

async function main() {
  const cfg = parseArgs(process.argv);

  if (!cfg.historyDir) {
    console.error("Usage: import-spotify <historyDir> [--commit] [--threshold=30000] [--user=morose] [--out=./import-report] [--navidrome=<path>] [--stats=<path>]");
    process.exit(1);
  }

  const navidromePath = cfg.navidrome ?? process.env["NAVIDROME_DB_PATH"] ?? null;
  if (!navidromePath) {
    console.error("Error: Navidrome DB path required. Use --navidrome=<path> or set NAVIDROME_DB_PATH env var.");
    process.exit(1);
  }

  const statsPath = cfg.stats ?? process.env["STATS_DB_PATH"] ?? null;
  if (cfg.commit && !statsPath) {
    console.error("Error: Stats DB path required for --commit. Use --stats=<path> or set STATS_DB_PATH env var.");
    process.exit(1);
  }

  const historyDir = resolve(cfg.historyDir);
  const files = readdirSync(historyDir).filter(
    (f) => f.includes("Streaming_History_Audio") && f.endsWith(".json"),
  );

  if (files.length === 0) {
    console.error(`No Streaming_History_Audio*.json files found in ${historyDir}`);
    process.exit(1);
  }

  type RawRecord = {
    ts?: string;
    ms_played?: number;
    master_metadata_track_name?: string | null;
    master_metadata_album_artist_name?: string | null;
    master_metadata_album_album_name?: string | null;
    spotify_track_uri?: string | null;
  };

  const plays = files.flatMap((f) => {
    const raw = JSON.parse(readFileSync(join(historyDir, f), "utf8")) as RawRecord[];
    return raw.map((r) => ({
      ts: r.ts ?? "",
      ms_played: r.ms_played ?? 0,
      track: r.master_metadata_track_name || null,
      artist: r.master_metadata_album_artist_name || null,
      album: r.master_metadata_album_album_name || null,
      uri: r.spotify_track_uri || null,
    }));
  });

  const navDb = new Database(navidromePath, { readonly: true, fileMustExist: true });
  const tracks = navDb.prepare("SELECT id, title, artist, duration FROM media_file").all() as NavTrack[];
  navDb.close();

  const index = buildIndex(tracks);
  const report = classify(plays, index, cfg.threshold);

  const threshSec = Math.floor(cfg.threshold / 1000);
  const spanStr =
    report.firstTs !== null && report.lastTs !== null
      ? `${fmtDate(report.firstTs)} → ${fmtDate(report.lastTs)}`
      : "n/a";

  const lines: string[] = [
    `Spotify import — ${cfg.commit ? "COMMIT" : "DRY RUN"}`,
    `  Source files:        ${files.length}`,
    `  Total records:       ${report.totalRecords}`,
    `  Non-music (skipped): ${report.nonMusic}     (podcasts / episodes / audiobooks)`,
    `  Too short (<${threshSec}s):    ${report.tooShort}    (skips / previews)`,
    `  Counted plays:       ${report.counted}`,
    `    Matched to library:  ${report.matched}  (${pct(report.matched, report.counted)} of counted)`,
    `      exact (artist+title): ${report.matchedExact}`,
    `      by title only:        ${report.matchedByTitle}   (artist tag differed; title was unique — see report.md)`,
    `    Not in library:      ${report.unmatched}  (${pct(report.unmatched, report.counted)})   ← these won't import`,
    `  Matched plays span:  ${spanStr}`,
    `  Listening imported:  ${fmtDuration(report.matchedSeconds)}`,
  ];

  let insertedLine = "";
  let inserted = 0;
  let duplicates = 0;

  if (cfg.commit && statsPath) {
    const statsDb = openStatsDb(statsPath);
    const store = new EventStore(statsDb);
    inserted = store.insertImport(report.events, cfg.user);
    duplicates = report.events.length - inserted;
    insertedLine = `  Inserted: ${inserted}  / duplicates skipped: ${duplicates}`;
    lines.push(insertedLine);
    statsDb.close();
  } else {
    lines.push("  DRY RUN — no changes written. Re-run with --commit to import.");
  }

  const outDir = resolve(cfg.out);
  mkdirSync(outDir, { recursive: true });
  lines.push(`  Report: ${join(outDir, "report.md")}`);

  const topN = report.unmatchedAgg.slice(0, 25);
  if (topN.length > 0) {
    lines.push("Top not-in-library (by plays):");
    for (const a of topN) lines.push(`  ${String(a.plays).padStart(6)}  ${a.artist} — ${a.title}`);
  }
  const recap = lines.join("\n");
  console.log(recap);

  const num = (x: number) => x.toLocaleString("en-US");
  const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
  const mdTable = (rows: { plays: number; artist: string; title: string }[], c1: string, c2: string): string => {
    if (!rows.length) return "_none_";
    const out = [`| Plays | ${c1} | ${c2} |`, "| --: | --- | --- |"];
    for (const a of rows) out.push(`| ${num(a.plays)} | ${esc(a.artist)} | ${esc(a.title)} |`);
    return out.join("\n");
  };
  const md: string[] = [
    `# Spotify import — ${cfg.commit ? "committed" : "dry run"}`,
    "",
    "| Metric | Value |",
    "| --- | --: |",
    `| Source files | ${files.length} |`,
    `| Total records | ${num(report.totalRecords)} |`,
    `| Non-music (podcasts, etc.) | ${num(report.nonMusic)} |`,
    `| Skips / previews (< ${threshSec}s) | ${num(report.tooShort)} |`,
    `| **Counted plays** | **${num(report.counted)}** |`,
    `| Matched — exact (artist + title) | ${num(report.matchedExact)} |`,
    `| Matched — by title only | ${num(report.matchedByTitle)} |`,
    `| **Matched total** | **${num(report.matched)}** (${pct(report.matched, report.counted)}) |`,
    `| Not in library | ${num(report.unmatched)} (${pct(report.unmatched, report.counted)}) |`,
    `| Span | ${spanStr} |`,
    `| Listening imported | ${fmtDuration(report.matchedSeconds)} |`,
  ];
  if (cfg.commit) md.push(`| Inserted | ${num(inserted)} (skipped ${num(duplicates)} duplicates) |`);
  md.push(
    "",
    `## Matched by title only — ${num(report.byTitleAgg.length)} tracks`,
    "Artist tag differed between Spotify and your library; matched because the title was unique. Worth a glance.",
    "",
    mdTable(report.byTitleAgg, "Spotify artist", "Title"),
    "",
    `## Not imported — ${num(report.unmatchedAgg.length)} tracks not in your Navidrome library`,
    "",
    mdTable(report.unmatchedAgg, "Artist", "Title"),
    "",
    `## Imported — ${num(report.matchedAgg.length)} tracks`,
    "",
    mdTable(report.matchedAgg, "Artist", "Title"),
    "",
  );
  writeFileSync(join(outDir, "report.md"), md.join("\n"), "utf8");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
