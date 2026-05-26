export interface AuthConfig {
  passwordHash: string;
  sessionSecret: string;
  cookieSecure: boolean;
  sessionDays: number;
}

export interface CoverConfig {
  navidromeUrl: string;
  navidromeUser: string;
  navidromePassword: string;
  cacheDir: string;
}

export interface Config {
  port: number;
  ingestSecret: string;
  statsDbPath: string;
  navidromeDbPath: string;
  sessionGapMinutes: number;
  defaultUser: string;
  auth?: AuthConfig;
  cover?: CoverConfig;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const ingestSecret = env.INGEST_SECRET;
  if (!ingestSecret) throw new Error("INGEST_SECRET is required");
  const navidromeDbPath = env.NAVIDROME_DB_PATH;
  if (!navidromeDbPath) throw new Error("NAVIDROME_DB_PATH is required");

  const sessionDays = env.SESSION_DAYS !== undefined ? Number(env.SESSION_DAYS) : 30;
  if (!Number.isFinite(sessionDays) || sessionDays <= 0) throw new Error("SESSION_DAYS must be a positive number");

  let auth: AuthConfig | undefined;
  const passwordHash = env.SPINDLE_PASSWORD_HASH;
  if (passwordHash && env.AUTH_ENABLED !== "false") {
    const sessionSecret = env.SESSION_SECRET;
    if (!sessionSecret) throw new Error("SESSION_SECRET is required when SPINDLE_PASSWORD_HASH is set");
    auth = {
      passwordHash,
      sessionSecret,
      cookieSecure: (env.AUTH_COOKIE_SECURE ?? "true") !== "false",
      sessionDays,
    };
  }

  let cover: CoverConfig | undefined;
  if (env.NAVIDROME_URL && env.NAVIDROME_USER && env.NAVIDROME_PASSWORD) {
    cover = {
      navidromeUrl: env.NAVIDROME_URL.replace(/\/+$/, ""),
      navidromeUser: env.NAVIDROME_USER,
      navidromePassword: env.NAVIDROME_PASSWORD,
      cacheDir: env.COVER_CACHE_DIR ?? "./data/covers",
    };
  }

  return {
    port: Number(env.PORT ?? 3590),
    ingestSecret,
    statsDbPath: env.STATS_DB_PATH ?? "./data/stats.db",
    navidromeDbPath,
    sessionGapMinutes: Number(env.SESSION_GAP_MINUTES ?? 30),
    defaultUser: env.DEFAULT_USER ?? "morose",
    auth,
    cover,
  };
}
