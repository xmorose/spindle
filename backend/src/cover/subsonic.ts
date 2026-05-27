import { createHash, randomBytes } from "node:crypto";
import type { CoverConfig } from "../config.js";

export function subsonicCoverUrl(cfg: CoverConfig, id: string, size?: number, salt = randomBytes(8).toString("hex")): string {
  const token = createHash("md5").update(cfg.navidromePassword + salt).digest("hex");
  const params = new URLSearchParams({ u: cfg.navidromeUser, t: token, s: salt, v: "1.16.1", c: "spindle", f: "json", id });
  if (size) params.set("size", String(size));
  return `${cfg.navidromeUrl}/rest/getCoverArt.view?${params.toString()}`;
}
