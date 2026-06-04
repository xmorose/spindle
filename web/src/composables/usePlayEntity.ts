import { ref } from "vue";
import { api } from "@/api/client";
import { usePlayerStore, type PlayerTrack } from "@/stores/player";
import { createShareLink } from "@/composables/useShare";

function toPlayerTracks(
  tracks: { id: string; title: string; artist: string; hasCover?: boolean; hasCoverArt?: boolean }[],
): PlayerTrack[] {
  return tracks.map((t) => ({
    id: t.id, title: t.title, artist: t.artist,
    coverId: (t.hasCover ?? t.hasCoverArt) ? t.id : null,
  }));
}

/** Play/share an album or artist by id (fetches its tracks on demand). */
export function usePlayEntity() {
  const player = usePlayerStore();
  const busyId = ref<string | null>(null);

  async function run(id: string, fn: () => Promise<void>): Promise<void> {
    busyId.value = id;
    try { await fn(); } catch { /* network/empty — no-op */ } finally { busyId.value = null; }
  }

  function playAlbum(id: string): Promise<void> {
    return run(id, async () => {
      const tracks = await api.albumTracks(id);
      player.playQueue(toPlayerTracks(tracks), 0);
    });
  }
  function shareAlbum(id: string, label?: string): Promise<void> {
    return run(id, async () => {
      const tracks = await api.albumTracks(id);
      await createShareLink({ kind: "album", trackIds: tracks.map((t) => t.id), label });
    });
  }
  function playArtist(id: string): Promise<void> {
    return run(id, async () => {
      const detail = await api.entity("artist", id, { range: "all" });
      player.playQueue(toPlayerTracks(detail.related), 0);
    });
  }

  return { playAlbum, shareAlbum, playArtist, busyId };
}
