import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { streamUrl, coverUrl } from "@/api/client";

export type RepeatMode = "off" | "all" | "one";

function readLS(k: string): string | null {
  try { return typeof localStorage !== "undefined" ? localStorage.getItem(k) : null; } catch { return null; }
}
function writeLS(k: string, v: string) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(k, v); } catch {  }
}

export interface PlayerTrack { id: string; title: string; artist: string; coverId: string | null; artistId?: string | null; }

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
  const repeat = ref<RepeatMode>("off");
  const current = computed<PlayerTrack | null>(() => queue.value[index.value] ?? null);
  const muted = computed(() => volume.value === 0);

  const sv = readLS("spindle.volume");
  if (sv !== null && Number.isFinite(Number(sv))) volume.value = Math.max(0, Math.min(1, Number(sv)));
  const sr = readLS("spindle.repeat");
  if (sr === "off" || sr === "all" || sr === "one") repeat.value = sr;
  watch(volume, (v) => writeLS("spindle.volume", String(v)));
  watch(repeat, (v) => writeLS("spindle.repeat", v));

  let raf = 0;
  const canRaf = typeof requestAnimationFrame === "function";
  function startTick() {
    if (raf || !canRaf) return;
    const loop = () => {
      const a = el();
      if (a) currentTime.value = a.currentTime;
      raf = playing.value ? requestAnimationFrame(loop) : 0;
    };
    raf = requestAnimationFrame(loop);
  }
  function stopTick() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  let attached = false;
  function attach(a: HTMLAudioElement) {
    a.ontimeupdate = () => { currentTime.value = a.currentTime; };
    a.ondurationchange = () => { duration.value = Number.isFinite(a.duration) ? a.duration : 0; };
    a.onplay = () => { playing.value = true; startTick(); };
    a.onpause = () => { playing.value = false; stopTick(); };
    a.onended = () => {
      if (repeat.value === "one") { a.currentTime = 0; const p = a.play(); if (p?.catch) p.catch(() => {}); return; }
      next();
    };
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      const ms = navigator.mediaSession;
      ms.setActionHandler("play", () => toggle());
      ms.setActionHandler("pause", () => toggle());
      ms.setActionHandler("previoustrack", () => prev());
      ms.setActionHandler("nexttrack", () => next());
    }
  }
  function setMediaMetadata() {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (typeof MediaMetadata === "undefined") return;
    const c = current.value;
    if (!c) { navigator.mediaSession.metadata = null; return; }
    const artwork = c.coverId
      ? [96, 256, 512].map((s) => ({ src: coverUrl(c.coverId as string, s), sizes: `${s}x${s}` }))
      : [];
    navigator.mediaSession.metadata = new MediaMetadata({ title: c.title, artist: c.artist, artwork });
  }
  function load(autoplay = true) {
    const a = el(); if (!a || !current.value) return;
    if (!attached) { attach(a); attached = true; }
    a.src = streamUrl(current.value.id);
    setMediaMetadata();
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
  function next() {
    if (index.value < queue.value.length - 1) { index.value++; load(); }
    else if (repeat.value === "all" && queue.value.length) { index.value = 0; load(); }
    else { playing.value = false; }
  }
  function prev() { const a = el(); if (a && a.currentTime > 3) { a.currentTime = 0; return; } if (index.value > 0) { index.value--; load(); } }
  function seek(t: number) { const a = el(); if (a) { a.currentTime = t; currentTime.value = t; } }
  function setVolume(v: number) { volume.value = Math.max(0, Math.min(1, v)); const a = el(); if (a) a.volume = volume.value; }

  let preMuteVolume = 1;
  function toggleMute() {
    if (volume.value > 0) { preMuteVolume = volume.value; setVolume(0); }
    else setVolume(preMuteVolume > 0 ? preMuteVolume : 1);
  }
  function cycleRepeat() { repeat.value = repeat.value === "off" ? "all" : repeat.value === "all" ? "one" : "off"; }

  function jumpTo(i: number) { if (i >= 0 && i < queue.value.length && i !== index.value) { index.value = i; load(); } }
  function addToQueue(tracks: PlayerTrack[]) {
    if (!tracks.length) return;
    const wasEmpty = queue.value.length === 0;
    queue.value.push(...tracks);
    if (wasEmpty) { index.value = 0; load(); }
  }
  function playNext(tracks: PlayerTrack[]) {
    if (!tracks.length) return;
    if (queue.value.length === 0) { playQueue(tracks, 0); return; }
    queue.value.splice(index.value + 1, 0, ...tracks);
  }
  function removeAt(i: number) {
    if (i < 0 || i >= queue.value.length) return;
    const wasCurrent = i === index.value;
    queue.value.splice(i, 1);
    if (queue.value.length === 0) { stop(); return; }
    if (i < index.value) index.value--;
    else if (wasCurrent) { if (index.value > queue.value.length - 1) index.value = queue.value.length - 1; load(); }
  }
  function shuffleUpcoming() {
    const start = index.value + 1;
    const head = queue.value.slice(0, start);
    const tail = queue.value.slice(start);
    for (let i = tail.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tail[i], tail[j]] = [tail[j], tail[i]];
    }
    queue.value = [...head, ...tail];
  }
  function playShuffled(tracks: PlayerTrack[]) {
    if (!tracks.length) return;
    const arr = tracks.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    playQueue(arr, 0);
  }

  function stop() {
    const a = el(); if (a) { a.pause(); a.removeAttribute("src"); }
    queue.value = []; index.value = 0; playing.value = false; currentTime.value = 0; duration.value = 0;
  }

  return { queue, index, playing, currentTime, duration, volume, repeat, muted, current, playQueue, playNow, toggle, next, prev, seek, setVolume, toggleMute, cycleRepeat, jumpTo, addToQueue, playNext, removeAt, shuffleUpcoming, playShuffled, stop };
});
