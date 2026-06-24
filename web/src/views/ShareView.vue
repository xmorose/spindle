<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { fetchPublicShare, publicStreamUrl, publicCoverUrl } from "@/api/client";
import { useSharePlayer } from "@/composables/useSharePlayer";
import { useCoverAccent } from "@/composables/useCoverAccent";
import { cleanArtist, formatClock } from "@/lib/format";
import VinylRecord from "@/components/VinylRecord.vue";
import type { PublicShare } from "@/api/types";

const route = useRoute();
const token = String(route.params.token);

// The server renders /s/:token with the share inlined as window.__SHARE__, so we can paint
// immediately instead of flashing a spinner while we fetch. Falls back to fetching when
// loaded outside that page (e.g. dev, or client-side navigation).
const preloaded = (window as unknown as { __SHARE__?: PublicShare }).__SHARE__ ?? null;
const data = ref<PublicShare | null>(preloaded);
const loading = ref(!preloaded);
const expired = ref(false);

const tracks = computed(() => data.value?.tracks ?? []);
const player = useSharePlayer(
  () => tracks.value,
  (id) => publicStreamUrl(token, id),
);

useCoverAccent(
  () => (player.current.value?.hasCover ? player.current.value.id : null),
  (id) => publicCoverUrl(token, id, 64),
);

const heading = computed(() => {
  const d = data.value;
  if (!d) return "";
  if (d.label) return d.label;
  return tracks.value.length === 1 ? tracks.value[0].title : `${tracks.value.length} Songs`;
});
const subheading = computed(() => {
  const d = data.value;
  if (!d || !tracks.value.length) return "";
  if (d.kind === "queue") return "Mixtape";
  return cleanArtist(tracks.value[0].artist);
});
const coverSrc = computed(() =>
  player.current.value?.hasCover ? publicCoverUrl(token, player.current.value.id, 600) : null,
);

const hoursLeft = computed(() => {
  if (!data.value) return 0;
  return Math.max(0, Math.ceil((data.value.expiresAt * 1000 - Date.now()) / 3_600_000));
});

const seekPct = computed(() => (player.duration.value ? Math.min(100, (player.currentTime.value / player.duration.value) * 100) : 0));
const bar = ref<HTMLElement | null>(null);
function seekTo(e: PointerEvent) {
  if (!bar.value || !player.duration.value) return;
  const r = bar.value.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  player.seek(ratio * player.duration.value);
}

onMounted(async () => {
  if (data.value) return;
  try {
    data.value = await fetchPublicShare(token);
  } catch {
    expired.value = true;
  } finally {
    loading.value = false;
  }
});
onUnmounted(() => player.dispose());
</script>

<template>
  <div class="grid min-h-dvh place-items-center bg-bg px-5 py-10 text-text">
    <div v-if="loading" class="h-9 w-9 animate-spin rounded-full border-2 border-line border-t-[var(--accent)]" />

    <div v-else-if="expired || !data" class="text-center">
      <div class="text-2xl font-black">This link has expired</div>
      <p class="mt-2 text-sm text-faint">Shared links expire after 24 hours.</p>
    </div>

    <div v-else class="flex w-full max-w-md flex-col items-center">
      <VinylRecord
        :id="player.current.value?.id ?? null"
        :name="heading"
        :src-override="coverSrc"
        :playing="player.playing.value"
        class="h-56 w-56"
      />

      <div class="mt-7 w-full text-center">
        <h1 class="truncate text-2xl font-black tracking-tight">{{ player.current.value?.title ?? heading }}</h1>
        <div class="truncate text-sm text-muted">{{ cleanArtist(player.current.value?.artist ?? subheading) }}</div>
      </div>

      <div class="mt-6 flex w-full items-center gap-3">
        <span class="tabular w-10 text-right text-xs text-faint">{{ formatClock(player.currentTime.value) }}</span>
        <div
          ref="bar"
          class="group relative h-6 flex-1 cursor-pointer touch-none select-none rounded"
          @pointerdown="seekTo"
        >
          <div class="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-line">
            <div class="h-full rounded-full" :style="{ width: seekPct + '%', background: 'var(--accent)' }"></div>
          </div>
        </div>
        <span class="tabular w-10 text-xs text-faint">{{ formatClock(player.duration.value) }}</span>
      </div>

      <div class="mt-5 flex items-center gap-6">
        <button v-if="tracks.length > 1" class="rounded-full p-1.5 text-muted transition-colors hover:text-text" @click="player.prev()" aria-label="Previous">
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor" aria-hidden="true"><path d="M6 6h2v12H6zM20 6L9 12l11 6V6z" /></svg>
        </button>
        <button
          class="grid h-14 w-14 place-items-center rounded-full text-[color:var(--color-bg)] transition-transform duration-150 hover:scale-105 active:scale-95"
          :style="{ background: 'var(--accent)' }" @click="player.toggle()" :aria-label="player.playing.value ? 'Pause' : 'Play'"
        >
          <svg v-if="player.playing.value" viewBox="0 0 24 24" class="h-7 w-7" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          <svg v-else viewBox="0 0 24 24" class="h-7 w-7 translate-x-px" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
        </button>
        <button v-if="tracks.length > 1" class="rounded-full p-1.5 text-muted transition-colors hover:text-text" @click="player.next()" aria-label="Next">
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor" aria-hidden="true"><path d="M16 6h2v12h-2zM4 6l11 6L4 18V6z" /></svg>
        </button>
      </div>

      <div v-if="tracks.length > 1" class="mt-8 w-full">
        <button
          v-for="(t, i) in tracks" :key="t.id"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-2"
          :class="i === player.index.value ? 'bg-[var(--accent-soft)]' : ''"
          @click="player.select(i)"
        >
          <span class="tabular w-5 text-right text-xs text-faint">{{ i + 1 }}</span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-[13.5px] font-semibold" :style="i === player.index.value ? { color: 'var(--accent)' } : undefined">{{ t.title }}</div>
            <div class="truncate text-[11.5px] text-faint">{{ cleanArtist(t.artist) }}</div>
          </div>
          <span class="tabular text-[11px] text-faint">{{ formatClock(t.duration) }}</span>
        </button>
      </div>

      <div class="mt-10 flex flex-col items-center gap-1">
        <span class="text-[11px] text-faint">Expires in {{ hoursLeft }}h</span>
        <span class="text-xs font-black tracking-tight text-muted">Spindle</span>
      </div>
    </div>
  </div>
</template>
