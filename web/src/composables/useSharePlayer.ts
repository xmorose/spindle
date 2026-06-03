import { ref, computed } from "vue";
import type { PublicShareTrack } from "@/api/types";

export function useSharePlayer(
  tracks: () => PublicShareTrack[],
  streamFor: (trackId: string) => string,
) {
  const audio = typeof Audio !== "undefined" ? new Audio() : null;
  const index = ref(0);
  const playing = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const current = computed<PublicShareTrack | null>(() => tracks()[index.value] ?? null);

  if (audio) {
    audio.ontimeupdate = () => { currentTime.value = audio.currentTime; };
    audio.ondurationchange = () => { duration.value = Number.isFinite(audio.duration) ? audio.duration : 0; };
    audio.onplay = () => { playing.value = true; };
    audio.onpause = () => { playing.value = false; };
    audio.onended = () => { next(); };
  }

  function load(autoplay = true) {
    if (!audio || !current.value) return;
    audio.src = streamFor(current.value.id);
    currentTime.value = 0;
    if (autoplay) { const p = audio.play(); if (p?.catch) p.catch(() => {}); }
  }
  function select(i: number) { if (i >= 0 && i < tracks().length) { index.value = i; load(); } }
  function toggle() {
    if (!audio || !current.value) return;
    if (!audio.src) { load(); return; }
    if (audio.paused) { const p = audio.play(); if (p?.catch) p.catch(() => {}); } else audio.pause();
  }
  function next() {
    if (index.value < tracks().length - 1) { index.value++; load(); }
    else playing.value = false;
  }
  function prev() {
    if (audio && audio.currentTime > 3) { audio.currentTime = 0; return; }
    if (index.value > 0) { index.value--; load(); }
  }
  function seek(t: number) { if (audio) { audio.currentTime = t; currentTime.value = t; } }
  function dispose() { if (audio) { audio.pause(); audio.removeAttribute("src"); } }

  return { index, playing, currentTime, duration, current, select, toggle, next, prev, seek, dispose };
}
