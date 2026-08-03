import { readFileSync, writeFileSync } from "node:fs";
import Database from "better-sqlite3";
import { buildIndex, classify } from "./import/spotify.js";
import { openStatsDb } from "./db/stats-db.js";
import { EventStore } from "./events/store.js";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";


function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function loadLastFm(file: string) {
  const lines = readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter(Boolean);

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);

    const row = Object.fromEntries(
      headers.map((h, i) => [h, values[i] ?? ""])
    );

    return {
      ts: new Date(Number(row.uts) * 1000).toISOString(),
      ms_played: 240000,
      track: row.track || null,
      artist: row.artist || null,
      album: row.album || null,
      uri: null,
    };
  });
}

function parseArgs(argv: string[]) {
  return {
    csv: argv[2],
    commit: argv.includes("--commit"),
    missingFile: argv.includes("--missing-file"),
    user: process.env.DEFAULT_USER ?? "",
    navidrome: process.env.NAVIDROME_DB_PATH ?? "",
    stats: process.env.STATS_DB_PATH ?? "",
  };
}


async function askMissingFile(): Promise<boolean> {
  const rl = createInterface({ input, output });

  const answer = await rl.question(
    "Output missing tracks CSV? (y/N): "
  );

  rl.close();

  return answer.toLowerCase() === "y";
}


function startMonitor(label: string) {
  const started = Date.now();

  return setInterval(() => {
    const seconds = Math.floor((Date.now() - started) / 1000);
    console.log(`${label} running... ${seconds}s`);
  }, 10000);
}

async function main() {
  const cfg = parseArgs(process.argv);

  if (!cfg.csv) {
    console.error(
      "Usage: import-lastfm <file.csv> [--commit] [--missing-file]"
    );
    process.exit(1);
  }

  if (!cfg.user) {
    console.error("Error: DEFAULT_USER env var required.");
    process.exit(1);
  }

  if (!cfg.navidrome) {
    console.error("Error: NAVIDROME_DB_PATH env var required.");
    process.exit(1);
  }

  if (cfg.commit && !cfg.stats) {
    console.error("Error: STATS_DB_PATH env var required for --commit.");
    process.exit(1);
  }

  console.log("Loading Last.fm CSV...");

  const plays = loadLastFm(cfg.csv);

  console.log(`Loaded ${plays.length} Last.fm plays`);

  console.log("Opening Navidrome database...");

  const navDb = new Database(cfg.navidrome, {
    readonly: true,
    fileMustExist: true,
  });

  const tracks = navDb
    .prepare(
      "SELECT id, title, artist, duration FROM media_file"
    )
    .all() as NavTrack[];

  navDb.close();

  console.log(`Loaded ${tracks.length} Navidrome tracks`);

  console.log("Building track index...");

  const indexStart = Date.now();

  const index = buildIndex(tracks);

  console.log(
    `Index built in ${((Date.now() - indexStart) / 1000).toFixed(1)}s`
  );

  console.log("Matching Last.fm plays...");

  const monitor = startMonitor("Matching");

  const report = classify(
    plays,
    index,
    30000
  );
  clearInterval(monitor);

  console.log("");
  console.log("Import summary:");
  console.log(`  Counted: ${report.counted}`);
  console.log(`  Matched: ${report.matched}`);
  console.log(`  Exact: ${report.matchedExact}`);
  console.log(`  Title only: ${report.matchedByTitle}`);
  console.log(`  Missing: ${report.unmatched}`);

  if (report.unmatchedAgg.length > 0) {
    const outputMissingFile =
    cfg.missingFile || await askMissingFile();

    if (outputMissingFile) {
      const escape = (s: string) =>
      `"${(s ?? "").replace(/"/g, '""')}"`;

      const unmatched = new Set(
        report.unmatchedAgg.map(
          (t) => `${t.artist}\u0000${t.title}`
        )
      );

      const missingRows = plays.filter(
        (p) =>
        p.artist &&
        p.track &&
        unmatched.has(`${p.artist}\u0000${p.track}`)
      );

      const csv = [
        "date,artist,title,album",
        ...missingRows.map((p) =>
        [
          escape(p.ts),
                           escape(p.artist!),
                           escape(p.track!),
                           escape(p.album ?? ""),
        ].join(",")
        ),
      ].join("\n");

      const outputPath = await askMissingFilePath();

      writeFileSync(
        outputPath,
        csv,
        "utf8"
      );

      console.log(
        `Wrote ${missingRows.length} missing plays to ${outputPath}`
      );
    }
  }

1
  if (!cfg.commit) {
    console.log("");
    console.log(
      "DRY RUN - rerun with --commit to import"
    );
    return;
  }

  console.log("Writing events...");

  const statsDb = openStatsDb(cfg.stats);

  const store = new EventStore(statsDb);

  const inserted = store.insertImport(
    report.events,
    cfg.user
  );

  console.log(
    `Inserted ${inserted}, skipped ${report.events.length - inserted} duplicates`
  );

  statsDb.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


async function askMissingFilePath(): Promise<string> {
  const rl = createInterface({ input, output });

  const answer = await rl.question(
    "Output path for missing tracks CSV [/app/data/missing-tracks.csv]: "
  );

  rl.close();

  return answer.trim() || "/app/data/last.fm/missing-tracks.csv";
}
