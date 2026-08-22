<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { api } from "@/api/client";
import { storeToRefs } from "pinia";
import { useRangeStore } from "@/stores/range";
import { useUserStore } from "@/stores/user";
import { formatDuration, cleanArtist } from "@/lib/format";
import type { Sort } from "@/api/types";
import RankedList, { type RankedRow } from "@/components/RankedList.vue";
import ListActionBar from "@/components/ListActionBar.vue";
import SearchInput from "@/components/SearchInput.vue";
import CoverArt from "@/components/CoverArt.vue";
import SkeletonList from "@/components/ui/SkeletonList.vue";
import Skeleton from "@/components/ui/Skeleton.vue";
import { usePlayerStore, type PlayerTrack } from "@/stores/player";
import { usePlayEntity } from "@/composables/usePlayEntity";
import { useCoverAccent } from "@/composables/useCoverAccent";

type Kind = "artists" | "albums" | "tracks";
const kinds: Kind[] = ["artists", "albums", "tracks"];
const counts = [25, 50, 100, 200];
const kind = ref<Kind>("artists");
const sort = ref<Sort>("plays");
const limitN = ref(50);
const q = ref("");
const { params } = storeToRefs(useRangeStore());
const { user } = storeToRefs(useUserStore());

const rows = ref<RankedRow[]>([]);
const loading = ref(true);
const firstLoad = computed(() => loading.value && rows.value.length === 0);

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase();
  return s ? rows.value.filter((r) => r.title.toLowerCase().includes(s) || (r.subtitle ?? "").toLowerCase().includes(s)) : rows.value;
});

const podium = computed(() => (!q.value.trim() && filtered.value.length >= 3 ? filtered.value.slice(0, 3) : []));
const listRows = computed(() => (podium.value.length ? filtered.value.slice(3) : filtered.value));

function label(v: number, seconds: number) {
  return sort.value === "time" ? formatDuration(seconds) : String(v);
}

async function load() {
  loading.value = true;
  const p = { ...params.value, sort: sort.value, limit: limitN.value };
  let mapped: RankedRow[] = [];
  try {
    if (kind.value === "artists") {
      mapped = (await api.topArtists(p)).map((a) => ({ id: a.artistId, title: cleanArtist(a.name), value: sort.value === "time" ? a.seconds : a.plays, valueLabel: label(a.plays, a.seconds), coverId: a.coverArt, to: `/artists/${a.artistId}` }));
    } else if (kind.value === "albums") {
      mapped = (await api.topAlbums(p)).map((a) => ({ id: a.albumId, title: a.name, subtitle: cleanArtist(a.artist), value: sort.value === "time" ? a.seconds : a.plays, valueLabel: label(a.plays, a.seconds), coverId: a.albumId, to: `/albums/${a.albumId}`, artistId: a.artistId }));
    } else {
      mapped = (await api.topTracks(p)).map((t) => ({ id: t.id, title: t.title, subtitle: cleanArtist(t.artist), value: sort.value === "time" ? t.seconds : t.plays, valueLabel: label(t.plays, t.seconds), coverId: t.hasCoverArt ? t.id : null, to: `/tracks/${t.id}`, artistId: t.artistId }));
    }
    rows.value = mapped;
  } finally {
    loading.value = false;
  }
}

watch([kind, sort, params, limitN, user], load, { immediate: true });
useCoverAccent(() => rows.value[0]?.coverId ?? null);

const rowKind = computed<"track" | "album" | "artist">(() =>
  kind.value === "tracks" ? "track" : kind.value === "albums" ? "album" : "artist",
);
const trackList = computed<PlayerTrack[]>(() =>
  kind.value === "tracks" ? filtered.value.map((r) => ({ id: r.id, title: r.title, artist: r.subtitle ?? "", coverId: r.coverId ?? null })) : [],
);

const player = usePlayerStore();
const entity = usePlayEntity();
function playRow(row: RankedRow, i: number) {
  if (kind.value === "albums") { void entity.playAlbum(row.id); return; }
  if (kind.value === "artists") { void entity.playArtist(row.id); return; }
  player.playQueue(trackList.value, i);
}
const kindIndex = computed(() => kinds.indexOf(kind.value));
const emptyLabel = computed(() => (q.value.trim() ? `No ${kind.value} match that filter.` : "Nothing here yet."));
</script>

<template>
  <div class="pb-2 rise">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-3xl font-black tracking-tight">Tops</h1>
      <SearchInput v-model="q" class="max-w-xs" placeholder="Filter…" />
    </div>

    <div class="mb-7 flex flex-wrap items-center justify-between gap-3">
      <div class="relative inline-grid grid-cols-3 rounded-full border border-line bg-surface p-1 text-[13px] font-semibold">
        <span class="seg-thumb pointer-events-none absolute bottom-1 left-1 top-1 rounded-full"
          :style="{ width: 'calc((100% - 0.5rem) / 3)', transform: `translateX(${kindIndex * 100}%)`, background: 'var(--accent)' }" />
        <button v-for="k in kinds" :key="k" @click="kind = k"
          class="relative z-10 rounded-full px-4 py-1.5 transition-colors duration-200"
          :class="kind === k ? 'text-[oklch(0.22_0.03_55)]' : 'text-muted hover:text-text'">{{ k[0].toUpperCase() + k.slice(1) }}</button>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="flex gap-0.5 rounded-full border border-line bg-surface p-1">
          <button v-for="s in (['plays','time'] as Sort[])" :key="s" @click="sort = s"
            class="rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-200"
            :class="sort === s ? 'bg-surface-2 text-text' : 'text-faint hover:text-muted'">{{ s === 'plays' ? 'Plays' : 'Time' }}</button>
        </div>
        <div class="flex gap-0.5 rounded-full border border-line bg-surface p-1">
          <button v-for="c in counts" :key="c" @click="limitN = c"
            class="tabular rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-200"
            :class="limitN === c ? 'bg-surface-2 text-text' : 'text-faint hover:text-muted'">{{ c }}</button>
        </div>
      </div>
    </div>

    <template v-if="firstLoad">
      <div class="mb-9 grid items-start gap-4 sm:grid-cols-[1.35fr_1fr_1fr]">
        <Skeleton v-for="i in 3" :key="i" class="aspect-square w-full rounded-2xl" />
      </div>
      <SkeletonList :rows="10" />
    </template>

    <template v-else>
      <div v-if="podium.length" class="mb-9 grid items-start gap-4 sm:grid-cols-[1.35fr_1fr_1fr]">
        <div v-for="(row, i) in podium" :key="row.id" class="podium group relative" :style="{ animationDelay: i * 0.06 + 's' }">
          <RouterLink :to="row.to ?? '/'" class="block overflow-hidden rounded-2xl">
            <CoverArt :id="row.coverId ?? null" :name="row.title" :size="600"
              class="w-full transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
          </RouterLink>
          <div class="pointer-events-none absolute inset-0 rounded-2xl" style="background:linear-gradient(180deg,oklch(0.13 0.02 50 / 0.12) 0%,transparent 36%,oklch(0.12 0.02 50 / 0.9) 100%)" />
          <span class="pointer-events-none absolute left-3 top-1 text-[64px] font-black leading-none tracking-tighter sm:text-[76px]"
            :style="{ color: i === 0 ? 'var(--accent)' : 'oklch(0.97 0.02 80 / 0.5)', textShadow: '0 2px 20px oklch(0.1 0.02 40 / 0.6)' }">{{ i + 1 }}</span>
          <div class="pointer-events-none absolute inset-x-0 bottom-0 p-4 pr-14">
            <div class="truncate text-lg font-black leading-tight tracking-tight text-white sm:text-xl">{{ row.title }}</div>
            <div v-if="row.subtitle" class="truncate text-xs" style="color:oklch(0.97 0.02 80 / 0.75)">{{ row.subtitle }}</div>
            <div class="tabular mt-1 text-[13px] font-bold" :style="{ color: 'var(--accent)' }">{{ row.valueLabel ?? row.value }}</div>
          </div>
          <button
            class="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full text-[color:var(--color-bg)] opacity-0 shadow-lg transition-all duration-200 hover:scale-105 focus-visible:opacity-100 active:scale-95 group-hover:opacity-100"
            :style="{ background: 'var(--accent)' }" @click.stop="playRow(row, i)" aria-label="Play"
          >
            <svg v-if="entity.busyId.value === row.id" viewBox="0 0 24 24" class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke-opacity="0.3" /><path d="M21 12a9 9 0 0 0-9-9" /></svg>
            <svg v-else viewBox="0 0 24 24" class="h-4 w-4 translate-x-px" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </button>
        </div>
      </div>

      <ListActionBar v-if="kind === 'tracks'" :tracks="trackList" :count="filtered.length" />
      <RankedList :rows="listRows" playable :kind="rowKind" :rank-offset="podium.length" :empty-label="emptyLabel" />
    </template>
  </div>
</template>

<style scoped>
.seg-thumb { transition: transform 320ms var(--ease-out-quint); }
.podium { animation: podium-in 520ms var(--ease-out-quint) both; }
@keyframes podium-in {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .seg-thumb { transition: none; }
  .podium { animation: none; }
}
</style>
