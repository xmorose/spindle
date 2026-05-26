export interface Config {
  port: number;
  ingestSecret: string;
  statsDbPath: string;
  navidromeDbPath: string;
  sessionGapMinutes: number;
  defaultUser: string;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const ingestSecret = env.INGEST_SECRET;
  if (!ingestSecret) throw new Error("INGEST_SECRET is required");
  const navidromeDbPath = env.NAVIDROME_DB_PATH;
  if (!navidromeDbPath) throw new Error("NAVIDROME_DB_PATH is required");

  return {
    port: Number(env.PORT ?? 3590),
    ingestSecret,
    statsDbPath: env.STATS_DB_PATH ?? "./data/stats.db",
    navidromeDbPath,
    sessionGapMinutes: Number(env.SESSION_GAP_MINUTES ?? 30),
    defaultUser: env.DEFAULT_USER ?? "morose",
  };
}
