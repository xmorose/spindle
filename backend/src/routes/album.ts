import type { FastifyInstance } from "fastify";
import type { NavidromeReader } from "../db/navidrome-db.js";

export function registerAlbumTracks(app: FastifyInstance, deps: { reader: NavidromeReader }): void {
  // Gated by the /api/* auth hook (owner-only). Real album tracklist, in disc/track order.
  app.get("/api/album/:id/tracks", async (req) => {
    const { id } = req.params as { id: string };
    return deps.reader.albumTracks(id);
  });
}
