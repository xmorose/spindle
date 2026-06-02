<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { api } from "@/api/client";
import { storeToRefs } from "pinia";
import { useRangeStore } from "@/stores/range";
import { formatDuration, cleanArtist } from "@/lib/format";
import type { Sort } from "@/api/types";
import RankedList, { type RankedRow } from "@/components/RankedList.vue";
import SearchInput from "@/components/SearchInput.vue";
import Spinner from "@/components/ui/Spinner.vue";

type Kind = "artists" | "albums" | "tracks";
const kinds: Kind[] = ["artists", "albums", "tracks"];
const counts = [25, 50, 100, 200];
const kind = ref<Kind>("artists");
const sort = ref<Sort>("plays");
const limitN = ref(50);
const q = ref("");
const { range } = storeToRefs(useRangeStore());

const rows = ref<RankedRow[]>([]);
const loading = ref(true);
const firstLoad = computed(() => loading.value && rows.value.length === 0);

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase();
  return s ? rows.value.filter((r) => r.title.toLowerCase().includes(s) || (r.subtitle ?? "").toLowerCase().includes(s)) : rows.value;
});

function label(v: number, seconds: number) {
  return sort.value === "time" ? formatDuration(seconds) : String(v);
}

async function load() {
  loading.value = true;
  const p = { range: range.value, sort: sort.value, limit: limitN.value };
  let mapped: RankedRow[] = [];
  if (kind.value === "artists") {
    mapped = (await api.topArtists(p)).map((a) => ({ id: a.artistId, title: cleanArtist(a.name), value: sort.value === "time" ? a.seconds : a.plays, valueLabel: label(a.plays, a.seconds), coverId: a.coverArt, to: `/artists/${a.artistId}` }));
  } else if (kind.value === "albums") {
    mapped = (await api.topAlbums(p)).map((a) => ({ id: a.albumId, title: a.name, subtitle: cleanArtist(a.artist), value: sort.value === "time" ? a.seconds : a.plays, valueLabel: label(a.plays, a.seconds), coverId: a.albumId, to: `/albums/${a.albumId}` }));
  } else {
    mapped = (await api.topTracks(p)).map((t) => ({ id: t.id, title: t.title, subtitle: cleanArtist(t.artist), value: sort.value === "time" ? t.seconds : t.plays, valueLabel: label(t.plays, t.seconds), coverId: t.hasCoverArt ? t.id : null, to: `/tracks/${t.id}` }));
  }
  rows.value = mapped;
  loading.value = false;
}

watch([kind, sort, range, limitN], load, { immediate: true });
</script>

<template>
  <div class="py-2 rise">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-3xl font-black tracking-tight">Tops</h1>
      <div class="flex items-center gap-3">
        <SearchInput v-model="q" placeholder="Filter…" />
        <div class="flex gap-1 rounded-full border border-line/60 p-0.5">
          <button v-for="s in (['plays','time'] as Sort[])" :key="s" @click="sort = s"
            class="rounded-full px-3 py-1 text-xs font-semibold capitalize"
            :class="sort === s ? 'bg-surface-2 text-text' : 'text-faint hover:text-muted'">{{ s === 'plays' ? 'Plays' : 'Time' }}</button>
        </div>
      </div>
    </div>

    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div class="flex gap-1">
        <button v-for="k in kinds" :key="k" @click="kind = k"
          class="rounded-lg px-3 py-1.5 text-[13px] font-semibold"
          :class="kind === k ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'">{{ k[0].toUpperCase() + k.slice(1) }}</button>
      </div>
      <div class="flex items-center gap-2">
        <span class="label" style="font-size:10.5px">Show</span>
        <div class="flex gap-1 rounded-full border border-line/60 p-0.5">
          <button v-for="c in counts" :key="c" @click="limitN = c"
            class="tabular rounded-full px-2.5 py-1 text-xs font-semibold"
            :class="limitN === c ? 'bg-surface-2 text-text' : 'text-faint hover:text-muted'">{{ c }}</button>
        </div>
      </div>
    </div>

    <div v-if="firstLoad" class="grid min-h-[40vh] place-items-center"><Spinner /></div>
    <RankedList v-else :rows="filtered" :playable="kind === 'tracks'" />
  </div>
</template>
