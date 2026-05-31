# Spindle — single image: backend (Fastify) serves /api and the built Vue SPA.
# Build context is the repo root.

# 1. Build the frontend
FROM node:20-slim AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# 2. Build the backend
FROM node:20-slim AS api
WORKDIR /api
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# 3. Runtime
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
# The backend serves the SPA from here (see WEB_DIR handling in config.ts/app.ts).
ENV WEB_DIR=/app/web
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=api /api/dist ./dist
COPY --from=web /web/dist ./web
EXPOSE 3590
# Env (INGEST_SECRET, NAVIDROME_DB_PATH, SESSION_SECRET, SPINDLE_PASSWORD_HASH,
# NAVIDROME_URL/USER/PASSWORD, TRUST_PROXY, AUTH_COOKIE_SECURE, ...) is injected
# by the container runtime (compose env / -e), not baked into the image.
CMD ["node", "dist/server.js"]
