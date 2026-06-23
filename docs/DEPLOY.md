# Deploying Spindle

Spindle ships as a single Docker image: the root `Dockerfile` builds the Vue SPA and runs the Fastify API, which serves both `/api` and the static SPA. Put it behind a reverse proxy with TLS, next to your Navidrome container.

## Image

The build is multi-stage (web build, then the backend with the built SPA copied in). The backend serves the SPA from `WEB_DIR`.

```bash
docker build -t spindle-backend:latest .
```

## Compose

A ready-to-edit version of the file below ships as [`docker-compose.example.yml`](../docker-compose.example.yml) — copy it to `docker-compose.yml` and change the two marked lines. Run it on the same Docker network as Navidrome so the plugin can reach it by service name, and bind-mount Navidrome's data directory read-only for `navidrome.db`.

```yaml
services:
  spindle-backend:
    image: spindle-backend:latest
    container_name: spindle-backend      # service name == container name so the
    build: .                             # plugin's http://spindle-backend:3590 resolves
    env_file: ./spindle.env
    environment:
      WEB_DIR: /app/web
      STATS_DB_PATH: /app/data/stats.db
      NAVIDROME_DB_PATH: /nddata/navidrome.db
      COVER_CACHE_DIR: /app/data/covers
    volumes:
      - spindle-data:/app/data                       # stats.db + cover cache
      - /path/to/navidrome/data:/nddata               # navidrome.db (opened read-only at the connection level)
    ports:
      - "127.0.0.1:3590:3590"            # publish to localhost; the proxy terminates TLS
    networks: [navidrome_default]
    restart: unless-stopped

networks:
  navidrome_default:
    external: true
volumes:
  spindle-data:
```

## Environment (`spindle.env`, mode 600, never committed)

```
INGEST_SECRET=<shared with the Navidrome plugin>
SESSION_SECRET=<random 32+ bytes>
SPINDLE_PASSWORD_HASH=<from `npm run hash-password`>
DEFAULT_USER=<your Navidrome username>
TRUST_PROXY=true
AUTH_COOKIE_SECURE=true
# cover art + audio streaming
NAVIDROME_URL=http://navidrome:4533
NAVIDROME_USER=<your Navidrome username>
NAVIDROME_PASSWORD=<password>
```

Notes:

- **Hash format is colon-separated** (`scrypt:salt:hash`, not `$`-separated) on purpose. docker-compose interpolates `env_file` values and would mangle a `$`. Keep it `$`-free.
- **`TRUST_PROXY=true`** makes `req.ip` the real client (the login rate limiter keys on it). Only set it when actually behind a proxy; on a direct bind it would let clients spoof `X-Forwarded-For`.
- **`AUTH_COOKIE_SECURE=true`** requires HTTPS (the proxy provides it).
- Omit `SPINDLE_PASSWORD_HASH` to run without the login gate (local only, never on a public bind).
- **`DEFAULT_USER` must match your Navidrome login name.** The dashboard only queries this user, so a wrong or unset value shows an empty dashboard with no error.
- **Mount Navidrome's data dir read-write.** Spindle opens the database read-only at the connection level, but SQLite needs to manage the WAL sidecar files, so a `:ro` filesystem mount can fail to open or return stale data.

## Reverse proxy + TLS

Point a host reverse proxy at `127.0.0.1:3590` and terminate TLS there. With nginx + certbot:

```nginx
server {
  server_name spindle.example.com;
  location / { proxy_pass http://127.0.0.1:3590; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; proxy_set_header X-Forwarded-Proto $scheme; }
}
```

Then `certbot --nginx -d spindle.example.com` for the certificate and auto-renewal.

## Redeploy

If the source on the server is not a git clone, ship a snapshot of the committed tree, extract it over the existing directory (so it does not delete the env file), and rebuild:

```bash
# locally
git archive --format=tar.gz -o spindle.tar.gz HEAD
scp spindle.tar.gz user@host:/srv/spindle/

# on the host
cd /srv/spindle
tar -xzf spindle.tar.gz        # do NOT rm -rf first: spindle.env lives here and is not in git
docker compose up -d --build
```

## First run

On boot the backend imports baseline play counts from Navidrome's `annotation` table (historical totals with no timestamps). Live scrobbles flow in from the plugin afterward. To backfill real, timestamped history, run the Spotify importer (see the main README).
