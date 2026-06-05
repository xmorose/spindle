import { createHash, randomBytes } from "node:crypto";
import type { CoverConfig } from "../config.js";

export function subsonicCoverUrl(cfg: CoverConfig, id: string, size?: number, salt = randomBytes(8).toString("hex")): string {
  const token = createHash("md5").update(cfg.navidromePassword + salt).digest("hex");
  const params = new URLSearchParams({ u: cfg.navidromeUser, t: token, s: salt, v: "1.16.1", c: "spindle", f: "json", id });
  if (size) params.set("size", String(size));
  return `${cfg.navidromeUrl}/rest/getCoverArt.view?${params.toString()}`;
}

export function subsonicStreamUrl(cfg: CoverConfig, id: string, salt = randomBytes(8).toString("hex")): string {
  const token = createHash("md5").update(cfg.navidromePassword + salt).digest("hex");
  const params = new URLSearchParams({ u: cfg.navidromeUser, t: token, s: salt, v: "1.16.1", c: "spindle", id });
  return `${cfg.navidromeUrl}/rest/stream.view?${params.toString()}`;
}

// Tell Navidrome a track was played. submission=true records the play (scrobble);
// submission=false is a lightweight "now playing" notification. `time` (ms since epoch)
// marks when playback started, for submissions.
export function subsonicScrobbleUrl(
  cfg: CoverConfig,
  id: string,
  submission: boolean,
  time?: number,
  salt = randomBytes(8).toString("hex"),
): string {
  const token = createHash("md5").update(cfg.navidromePassword + salt).digest("hex");
  const params = new URLSearchParams({
    u: cfg.navidromeUser, t: token, s: salt, v: "1.16.1", c: "spindle", f: "json",
    id, submission: String(submission),
  });
  if (time !== undefined) params.set("time", String(time));
  return `${cfg.navidromeUrl}/rest/scrobble.view?${params.toString()}`;
}
