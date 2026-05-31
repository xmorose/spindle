<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { api } from "@/api/client";
import { useCoverAccent } from "@/composables/useCoverAccent";
import { formatNumber, formatDuration, cleanArtist } from "@/lib/format";
import type { Totals, ArtistTop, TrackTop, GenreTop } from "@/api/types";
import CoverArt from "@/components/CoverArt.vue";

const totals = ref<Totals | null>(null);
const artist = ref<ArtistTop | null>(null);
const track = ref<TrackTop | null>(null);
const genre = ref<GenreTop | null>(null);
const loading = ref(true);

onMounted(async () => {
  const [t, ar, tr, ge] = await Promise.all([
    api.totals({ range: "year" }),
    api.topArtists({ range: "year", limit: 1 }),
    api.topTracks({ range: "year", limit: 1 }),
    api.topGenres({ range: "year", limit: 1 }),
  ]);
  totals.value = t; artist.value = ar[0] ?? null; track.value = tr[0] ?? null; genre.value = ge[0] ?? null;
  loading.value = false;
});

const isEmpty = computed(() => !loading.value && (totals.value?.plays ?? 0) === 0);
useCoverAccent(() => (track.value?.hasCoverArt ? track.value.id : null));
</script>

<template>
  <div class="py-2">
    <div v-if="loading" class="grid min-h-[50vh] place-items-center">
      <div class="h-9 w-9 animate-spin rounded-full border-2 border-line border-t-[var(--accent)]" />
    </div>

    <div v-else-if="isEmpty" class="grid min-h-[50vh] place-items-center text-center">
      <div>
        <h1 class="text-3xl font-black tracking-tight">Wrapped</h1>
        <p class="mx-auto mt-3 max-w-[42ch] text-sm text-faint">Not enough listening this year yet. Your year-in-review fills in as Spindle tracks more plays.</p>
      </div>
    </div>

    <template v-else>
      <section class="mb-12">
        <div class="text-[11px] font-bold uppercase tracking-[0.18em] text-faint">Your year in sound</div>
        <div class="tabular mt-2 text-8xl font-black leading-[0.85]" :style="{ color: 'var(--accent)' }">{{ formatNumber(totals?.plays ?? 0) }}</div>
        <div class="mt-3 text-xl font-semibold text-muted">plays · {{ formatDuration(totals?.seconds ?? 0) }} of listening</div>
      </section>

      <div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <RouterLink v-if="artist" :to="`/artists/${artist.artistId}`" class="rounded-2xl border border-line/60 p-5">
          <div class="text-[10px] font-bold uppercase tracking-[0.16em]" :style="{ color: 'var(--accent)' }">Top artist</div>
          <div class="mt-2 text-2xl font-black">{{ cleanArtist(artist.name) }}</div>
          <div class="tabular text-sm text-muted">{{ artist.plays }} plays</div>
        </RouterLink>
        <RouterLink v-if="track" :to="`/tracks/${track.id}`" class="rounded-2xl border border-line/60 p-5">
          <CoverArt :id="track.hasCoverArt ? track.id : null" :name="track.title" :size="120" class="mb-3 h-14 w-14" />
          <div class="text-[10px] font-bold uppercase tracking-[0.16em]" :style="{ color: 'var(--accent)' }">Top song</div>
          <div class="mt-1 text-xl font-bold">{{ track.title }}</div>
          <div class="text-sm text-muted">{{ cleanArtist(track.artist) }}</div>
        </RouterLink>
        <div v-if="genre" class="rounded-2xl border border-line/60 p-5">
          <div class="text-[10px] font-bold uppercase tracking-[0.16em]" :style="{ color: 'var(--accent)' }">Top genre</div>
          <div class="mt-2 text-2xl font-black">{{ genre.genre }}</div>
          <div class="tabular text-sm text-muted">{{ genre.plays }} plays</div>
        </div>
      </div>
    </template>
  </div>
</template>
