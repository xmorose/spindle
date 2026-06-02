# Spindle

A self-hosted listening-stats dashboard for a [Navidrome](https://www.navidrome.org/) music server. Spindle records every scrobble, folds in your historical play counts and (optionally) your full Spotify streaming history, and renders it as a fast, art-first dashboard: top artists/albums/tracks, a record-shaped listening clock, a weekday/hour heatmap, sessions, an all-time view, a year-in-review, a chronological feed, and an in-app player.

It is a single-user app behind a password gate, designed to run as one small Docker container next to Navidrome.

## What it looks like

- **Warm vinyl-room dark theme** in OKLCH, with the accent color extracted at runtime from the active period's top cover art, so the page recolors to whatever you have been listening to.
- **Editorial big numbers**, cover-art-heavy layouts, and a signature **radial listening clock** (a vinyl record with a spindle hole at the center) for hour-of-day repartition.
- Hand-rolled SVG charts (no chart library), full-viewport fluid width.


## Architecture

```
Navidrome ──scrobble──▶ Rust/WASM plugin ──POST /ingest──▶ Spindle backend ──┐
                                                            (Fastify + SQLite) │
   navidrome.db (read-only) ◀───────────────────────────────────────────────┤
                                                                              │
                                              Vue 3 SPA  ◀── serves /api + SPA ┘
```

- **Plugin** (Rust compiled to WASM): a Navidrome scrobble plugin that POSTs each play to the backend's `/ingest` with a shared secret.
- **Backend** (`backend/`): [Fastify](https://fastify.dev/) + [better-sqlite3](https://github.com/WiseLibs/better-sqlite3). Owns `stats.db` (the `play_events` log) and reads `navidrome.db` read-only for track/album/artist metadata and cover-art ids. Computes all stats on demand with a small in-memory cache invalidated on ingest. Proxies cover art and audio streams from Navidrome's Subsonic API. Serves the built SPA in production.
- **Web** (`web/`): [Vue 3](https://vuejs.org/) + [Vite](https://vite.dev/) + [Tailwind CSS v4](https://tailwindcss.com/) + TypeScript + [Pinia](https://pinia.vuejs.org/). Typed API client, cookie-based auth, hand-rolled SVG charts.

### Play sources

Every row in `play_events` carries a `source`:

- `baseline` — historical play **counts** imported from Navidrome's own `annotation` table. These have no real timestamp, so they feed totals and top lists but not time-of-day / heatmap / session / first-and-last views.
- `live` — real scrobbles arriving from the plugin going forward.
- `import` — real, timestamped plays matched from a Spotify Extended Streaming History export (see below).

Time-based views query `source <> 'baseline'`; count-based views use everything.

## Features

- Home with a top-artist banner, four headline stats, listening-over-time, and a best song.
- Tops (artists / albums / tracks) with plays-vs-time sort, a search filter, and a result-count selector.
- Browse artists / albums / tracks, each with per-page search.
- Entity detail pages (artist / album / track) with rank, first/last play, a zoomable play-history chart, related tracks, and play / shuffle / add-to-queue.
- Pulse (heatmap + radial clock), Sessions, All-time, and a Spotify-Wrapped-style year view.
- Recent: a chronological feed grouped by day.
- Global search across the whole library.
- In-app player: queue, play-next / add-to-queue, shuffle, repeat, volume, a draggable seek bar, and media-key shortcuts. Audio is streamed through the backend from Navidrome.
- Accent color extracted from cover art at runtime.

## Local development

You need Node 20+ and a copy of a `navidrome.db`.

```bash
# backend
cd backend
cp .env.example .env   # then edit paths + auth (see below)
npm install
npm run dev            # http://127.0.0.1:3590

# web (separate terminal)
cd web
npm install
npm run dev            # http://localhost:5173, proxies /api -> :3590
```

Backend `.env` essentials:

```
INGEST_SECRET=dev-secret
NAVIDROME_DB_PATH=./data/navidrome.db
STATS_DB_PATH=./data/stats.db
# auth (omit SPINDLE_PASSWORD_HASH to run without a login gate in dev)
SPINDLE_PASSWORD_HASH=...   # see `npm run hash-password`
SESSION_SECRET=...
# cover art + streaming (optional in dev)
NAVIDROME_URL=http://127.0.0.1:4533
NAVIDROME_USER=you
NAVIDROME_PASSWORD=...
```

Generate a password hash with the auth CLI (`backend/src/auth/hash-cli.ts`). The hash format is colon-separated (`scrypt:salt:hash`) on purpose, so it survives docker-compose `env_file` interpolation.


## Importing Spotify history

Spindle can match your Spotify **Extended Streaming History** export to tracks in your Navidrome library and insert the matched plays with their real timestamps:

```bash
npm --prefix backend run import-spotify -- /path/to/history --commit \
  --navidrome=/path/to/navidrome.db --stats=/path/to/stats.db --user=you
```

It matches on normalized artist + title (handling `feat.`/`ft.`, collaborator suffixes, version tails, and multi-artist commas), writes a `report.md`, and is idempotent and reversible (`DELETE FROM play_events WHERE source='import'`). Playlists from the separate Spotify **Account-data** export can be migrated to Navidrome `.m3u8` files with `npm run import-playlists`.

## Deployment

One Docker image builds the SPA and runs the API, served behind a reverse proxy. See [docs/DEPLOY.md](docs/DEPLOY.md).

## License

Not yet licensed. Add a `LICENSE` file before publishing.
