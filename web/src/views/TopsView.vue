<script setup lang="ts">
import { ref, watch } from "vue";
import { api } from "@/api/client";
import { storeToRefs } from "pinia";
import { useRangeStore } from "@/stores/range";
import { formatDuration, cleanArtist } from "@/lib/format";
import type { Sort } from "@/api/types";
import RankedList, { type RankedRow } from "@/components/RankedList.vue";

type Kind = "artists" | "albums" | "tracks" | "genres";
const kinds: Kind[] = ["artists", "albums", "tracks", "genres"];
const kind = ref<Kind>("artists");
const sort = ref<Sort>("plays");
const { range } = storeToRefs(useRangeStore());

const rows = ref<RankedRow[]>([]);
const loading = ref(true);

function label(v: number, seconds: number) {
  return sort.value === "time" ? formatDuration(seconds) : String(v);
}

async function load() {
  loading.value = true;
  const p = { range: range.value, sort: sort.value, limit: 50 };
  let mapped: RankedRow[] = [];
  if (kind.value === "artists") {
    mapped = (await api.topArtists(p)).map((a) => ({ id: a.artistId, title: cleanArtist(a.name), value: sort.value === "time" ? a.seconds : a.plays, valueLabel: label(a.plays, a.seconds), coverId: a.artistId, to: `/artists/${a.artistId}` }));
  } else if (kind.value === "albums") {
    mapped = (await api.topAlbums(p)).map((a) => ({ id: a.albumId, title: a.name, subtitle: cleanArtist(a.artist), value: sort.value === "time" ? a.seconds : a.plays, valueLabel: label(a.plays, a.seconds), coverId: a.albumId, to: `/albums/${a.albumId}` }));
  } else if (kind.value === "tracks") {
    mapped = (await api.topTracks(p)).map((t) => ({ id: t.id, title: t.title, subtitle: cleanArtist(t.artist), value: sort.value === "time" ? t.seconds : t.plays, valueLabel: label(t.plays, t.seconds), coverId: t.hasCoverArt ? t.id : null, to: `/tracks/${t.id}` }));
  } else {
    mapped = (await api.topGenres(p)).map((g) => ({ id: g.genre, title: g.genre, value: sort.value === "time" ? g.seconds : g.plays, valueLabel: label(g.plays, g.seconds), coverId: null }));
  }
  rows.value = mapped;
  loading.value = false;
}

watch([kind, sort, range], load, { immediate: true });
</script>

<template>
  <div class="py-2 rise">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-extrabold tracking-tight">Tops</h1>
      <div class="flex gap-1 rounded-full border border-line/60 p-0.5">
        <button v-for="s in (['plays','time'] as Sort[])" :key="s" @click="sort = s"
          class="rounded-full px-3 py-1 text-xs font-semibold capitalize"
          :class="sort === s ? 'bg-surface-2 text-text' : 'text-faint hover:text-muted'">{{ s === 'plays' ? 'Plays' : 'Time' }}</button>
      </div>
    </div>

    <div class="mb-5 flex gap-1">
      <button v-for="k in kinds" :key="k" @click="kind = k"
        class="rounded-lg px-3 py-1.5 text-[13px] font-semibold"
        :class="kind === k ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'">{{ k[0].toUpperCase() + k.slice(1) }}</button>
    </div>

    <RankedList :rows="rows" />
  </div>
</template>
