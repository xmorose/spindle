import type { FastifyInstance } from "fastify";
import type { NavidromeReader } from "../db/navidrome-db.js";

export function registerAlbumTracks(app: FastifyInstance, deps: { reader: NavidromeReader }): void {
  app.get("/api/album/:id/tracks", async (req) => {
    const { id } = req.params as { id: string };
    return deps.reader.albumTracks(id);
  });
}
