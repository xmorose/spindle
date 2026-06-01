import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { streamUrl } from "@/api/client";

export interface PlayerTrack { id: string; title: string; artist: string; coverId: string | null; }

let audio: HTMLAudioElement | null = null;
function el(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!audio) audio = new Audio();
  return audio;
}

export const usePlayerStore = defineStore("player", () => {
  const queue = ref<PlayerTrack[]>([]);
  const index = ref(0);
  const playing = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const volume = ref(1);
  const current = computed<PlayerTrack | null>(() => queue.value[index.value] ?? null);

  let attached = false;
  function attach(a: HTMLAudioElement) {
    a.ontimeupdate = () => { currentTime.value = a.currentTime; };
    a.ondurationchange = () => { duration.value = Number.isFinite(a.duration) ? a.duration : 0; };
    a.onplay = () => { playing.value = true; };
    a.onpause = () => { playing.value = false; };
    a.onended = () => next();
  }
  function load(autoplay = true) {
    const a = el(); if (!a || !current.value) return;
    if (!attached) { attach(a); attached = true; }
    a.src = streamUrl(current.value.id);
    a.volume = volume.value;
    currentTime.value = 0;
    if (autoplay) { try { const p = a.play(); if (p && typeof p.catch === "function") p.catch(() => {}); } catch {  } }
  }
  function playQueue(tracks: PlayerTrack[], start = 0) {
    if (!tracks.length) return;
    queue.value = tracks;
    index.value = Math.max(0, Math.min(start, tracks.length - 1));
    load();
  }
  function playNow(track: PlayerTrack) { playQueue([track], 0); }
  function toggle() {
    const a = el(); if (!a || !current.value) return;
    if (a.paused) { try { const p = a.play(); if (p?.catch) p.catch(() => {}); } catch {  } } else a.pause();
  }
  function next() { if (index.value < queue.value.length - 1) { index.value++; load(); } else { playing.value = false; } }
  function prev() { const a = el(); if (a && a.currentTime > 3) { a.currentTime = 0; return; } if (index.value > 0) { index.value--; load(); } }
  function seek(t: number) { const a = el(); if (a) { a.currentTime = t; currentTime.value = t; } }
  function setVolume(v: number) { volume.value = v; const a = el(); if (a) a.volume = v; }

  return { queue, index, playing, currentTime, duration, volume, current, playQueue, playNow, toggle, next, prev, seek, setVolume };
});
