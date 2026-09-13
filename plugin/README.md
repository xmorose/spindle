# Spindle Collector

The Navidrome side of Spindle. It's a scrobble plugin (Rust, compiled to WebAssembly) that forwards every play to the Spindle backend, which is how anything you listen to actually shows up in the stats.

It implements Navidrome's Scrobbler capability: on each completed scrobble it POSTs `{ played_at, user, nd_track_id }` to `<backend_url>/ingest` with an `X-Spindle-Secret` header. Now-playing pings are ignored, only real plays. Because it hooks Navidrome's scrobbler, it catches plays from any client that scrobbles to your server (the web player, Symfonium, DSub, etc.), not just the Navidrome web UI.

## Config

Set in the Navidrome web UI under Settings → Plugins → Spindle Collector:

- `backend_url` — base URL of your Spindle backend, e.g. `http://spindle-backend:3590`
- `shared_secret` — must match the backend's `INGEST_SECRET`

## Building

Collector 0.1.1 uses Navidrome's host HTTP service. Collector 0.1.0 uses Extism's built-in HTTP, which Navidrome 0.64.0 disabled, so upgrading the backend Docker image alone will not restore scrobbling. Replace the collector plugin as described below.

The manifest's `requiredHosts: ["*"]` permits a configurable backend, including Docker and LAN addresses. If you restrict it on Navidrome 0.64.0, include the backend's IP or CIDR for private addresses; a hostname alone is insufficient.

It builds against Navidrome's Rust plugin SDK (`nd-pdk`), which isn't published to crates.io. It lives inside the Navidrome repo at `plugins/pdk/rust/nd-pdk`, and `Cargo.toml` here points at it with the relative path Navidrome expects (`../../pdk/rust/nd-pdk`). Easiest is to build from inside a Navidrome checkout:

```bash
git clone --branch v0.64.0 --depth 1 https://github.com/navidrome/navidrome
cp -r spindle/plugin navidrome/plugins/examples/spindle-collector
cd navidrome/plugins/examples/spindle-collector

rustup target add wasm32-wasip1
cargo build --release --target wasm32-wasip1
```

That gives you `target/wasm32-wasip1/release/spindle_collector.wasm`.

## Installing

A Navidrome plugin is an `.ndp` file, which is just a zip of the manifest plus the wasm:

```bash
cp target/wasm32-wasip1/release/spindle_collector.wasm plugin.wasm
zip -j spindle-collector.ndp manifest.json plugin.wasm
```

Drop `spindle-collector.ndp` into the folder set as `Folder` under `[Plugins]` in your `navidrome.toml`, make sure plugins are enabled, and restart Navidrome. Then set `backend_url` and `shared_secret` in the UI and you're collecting plays.

When upgrading, replace the existing collector `.ndp` rather than installing a second copy, then restart Navidrome and confirm the plugin is enabled and assigned to your users. Play a track and check the Spindle backend for a new `[ingest]` log entry.
