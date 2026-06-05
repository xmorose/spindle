import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { CoverConfig } from "../config.js";
import { subsonicScrobbleUrl } from "../cover/subsonic.js";

const schema = z.object({
  id: z.string().min(1),
  submission: z.boolean().optional(),
  time: z.number().int().positive().optional(),
});

// Authed (gated by the /api/* auth hook): record a play in Navidrome. Spindle's own player
// streams bytes via the proxy, which does not scrobble — so the play would never reach
// Spindle's stats. This forwards a scrobble to Navidrome, which the ingest plugin then
// feeds back into Spindle, keeping Navidrome the single source of truth.
export function registerScrobble(app: FastifyInstance, cfg: CoverConfig): void {
  app.post("/api/scrobble", async (req, reply) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid scrobble" });
    const { id, submission = true, time } = parsed.data;
    try {
      const res = await fetch(subsonicScrobbleUrl(cfg, id, submission, time));
      if (!res.ok) return reply.code(502).send({ error: "scrobble failed" });
    } catch {
      return reply.code(502).send({ error: "scrobble failed" });
    }
    return reply.code(202).send({ ok: true });
  });
}
