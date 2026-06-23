# Spindle

Listening stats for your own Navidrome server. Think Last.fm or Spotify Wrapped, except the data is yours and it lives right next to your music.

I self-host Navidrome and always missed having real stats. Last.fm scrobbling sort of works, but the site feels ancient and my history isn't really mine. So I built this. It watches what you play, keeps the history in its own little SQLite database, and turns it into top artists/albums/tracks, when you actually listen (an hour-of-day clock and a weekday heatmap), your listening sessions, an all-time view, and a year in review. The whole interface recolors itself from the cover art of whatever you've been playing, which I'm probably too proud of.

It's single-user and sits behind a password, so it's fine to put on a real domain.

## Screenshots

<p align="center">
  <img src="docs/screenshots/home.png" alt="Home dashboard" width="100%"><br>
  <sub>Home: headline numbers, top artist, listening over time, and the hour-of-day clock</sub>
</p>

<table>
  <tr>
    <td width="50%" align="center"><img src="docs/screenshots/wrapped.png" alt="Year in review"><br><sub>Your year in review</sub></td>
    <td width="50%" align="center"><img src="docs/screenshots/artists.png" alt="Library browse"><br><sub>Browsing the library (artist view)</sub></td>
  </tr>
</table>

The accent recolors itself from the cover art, so each of these is a different shade.

## What you get

- A home dashboard with your headline numbers, top artist, and current favourite song
- Tops: artists / albums / tracks, sort by plays or by time, with a filter
- Browse the whole library and click into any artist, album, or track for its own page (rank, first/last play, a history chart, related tracks)
- Pulse: a weekday by hour heatmap and a record-shaped listening clock
- Recent: a plain feed of what you played, grouped by day
- An all-time view and a Spotify-Wrapped style year page
- A built-in player, so you can actually play things without leaving the page. Queue, shuffle, repeat, volume, media keys, all streamed straight from Navidrome
- Search across your whole library

## How it works

Three small pieces:

- a Navidrome scrobble plugin ([`plugin/`](plugin/)) that POSTs every play to the backend
- the backend (Fastify + SQLite) that stores those plays and computes the stats on the fly. It reads your `navidrome.db` read-only for track/artist/album info and cover-art ids, and proxies the actual images and audio from Navidrome
- the frontend (Vue 3 + Vite + Tailwind). The charts are all hand-rolled SVG, no chart library

Every play has a source. `baseline` is your existing Navidrome play counts, imported once so day one isn't a blank page (counts only, no real timestamps). `live` is new scrobbles coming in. `import` is your Spotify history (below). Anything time-based skips `baseline`, since those plays don't have a real timestamp to put on a clock.

The ingest side is just a `POST /ingest` with a shared secret, so if you don't want the plugin you can point anything that knows your scrobbles at it.

## Running it

It's one Docker image: the frontend gets built and served together with the API. The easy path is a `docker compose` service sitting next to your Navidrome container, with your `navidrome.db` mounted (Spindle only ever reads it) and a shared secret between the plugin and the backend.

From a clone of this repo:

```bash
cp docker-compose.example.yml docker-compose.yml   # then edit the two CHANGE-ME lines
cp backend/.env.example spindle.env                # then fill in the secrets
docker compose up -d --build
```

The full walkthrough (env vars, reverse proxy, Let's Encrypt) is in [docs/DEPLOY.md](docs/DEPLOY.md). The short version of what you need:

- your Navidrome data dir mounted (Spindle opens the db read-only at the connection level) for metadata + cover art
- `DEFAULT_USER` set to your Navidrome username — the dashboard only shows that user's plays
- the scrobble plugin installed in Navidrome, pointed at the backend with a matching `INGEST_SECRET`
- a login password (there's a `hash-password` script to generate the hash)
- `NAVIDROME_URL` / user / password if you want cover art and the in-app player

Local dev is just `npm install` + `npm run dev` in `backend/` and `web/` (Vite proxies `/api` to the backend). You'll need Node 20+ and a copy of a `navidrome.db`.

## Bringing your history with you

Two ways to not start from scratch:

- the baseline import runs on first boot and pulls your existing Navidrome play counts
- if you have a Spotify **Extended Streaming History** export, the backend's `import-spotify` script matches it against your library by artist + title (it deals with `feat.`, remixes, `- Remastered` tails, and the usual tagging mess), then inserts the matched plays with their real timestamps. It writes a report of what matched and what didn't, and it's fully reversible. There's a playlist importer too that turns your Spotify playlists into Navidrome `.m3u8` files.

For me that backfilled about 76k real plays going back years, which is what makes the year view and the clocks actually interesting.

## Stack

Backend is Node, Fastify, better-sqlite3, and zod. Frontend is Vue 3, Vite, Tailwind v4, Pinia, TypeScript. The plugin is Rust compiled to WASM. It all builds into one Docker image and runs behind nginx on my server.

## Heads up

This is a personal project built around my own setup, so it assumes one user and a Navidrome instance you control. It runs great for me, but I'm not selling it as a polished product. If you self-host Navidrome and want your own stats, go for it, and PRs are welcome if you build something neat on top of it.
