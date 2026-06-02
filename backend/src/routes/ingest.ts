import type { FastifyInstance } from "fastify";
import { timingSafeEqual } from "node:crypto";
import type { EventStore } from "../events/store.js";
import type { MemoCache } from "../cache.js";
import { ingestSchema } from "../events/ingest-schema.js";

interface Opts { store: EventStore; cache: MemoCache; secret: string; defaultUser: string; }

function secretMatches(received: unknown, expected: string): boolean {
  if (typeof received !== "string") return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function registerIngest(app: FastifyInstance, opts: Opts): void {
  app.post("/ingest", async (req, reply) => {
    if (!secretMatches(req.headers["x-spindle-secret"], opts.secret)) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const parsed = ingestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body", details: parsed.error.issues });
    }
    const user = parsed.data.user.trim() || opts.defaultUser;
    const inserted = opts.store.insertLive({ ...parsed.data, user });
    if (inserted) opts.cache.invalidateAll();
    return reply.code(202).send({ inserted });
  });
}
