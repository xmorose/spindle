<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { api } from "@/api/client";
import { useCoverAccent } from "@/composables/useCoverAccent";
import { formatNumber, formatDuration, cleanArtist } from "@/lib/format";
import type { Totals, ArtistTop, TrackTop, GenreTop, TimePoint } from "@/api/types";
import RankedList, { type RankedRow } from "@/components/RankedList.vue";
import LineArea from "@/components/charts/LineArea.vue";
import Spinner from "@/components/ui/Spinner.vue";
import AnimatedNumber from "@/components/ui/AnimatedNumber.vue";

const totals = ref<Totals | null>(null);
const artists = ref<ArtistTop[]>([]);
const tracks = ref<TrackTop[]>([]);
const genres = ref<GenreTop[]>([]);
const series = ref<TimePoint[]>([]);
const loading = ref(true);

onMounted(async () => {
  const [t, ar, tr, ge, ts] = await Promise.all([
    api.totals({ range: "year" }),
    api.topArtists({ range: "year", limit: 5 }),
    api.topTracks({ range: "year", limit: 5 }),
    api.topGenres({ range: "year", limit: 6 }),
    api.timeseries({ range: "year", bucket: "month" }),
  ]);
  totals.value = t; artists.value = ar; tracks.value = tr; genres.value = ge; series.value = ts;
  loading.value = false;
});

const isEmpty = computed(() => !loading.value && (totals.value?.plays ?? 0) === 0);
const topTrack = computed(() => tracks.value[0] ?? null);
useCoverAccent(() => (topTrack.value?.hasCoverArt ? topTrack.value.id : null));

const artistRows = computed<RankedRow[]>(() => artists.value.map((a) => ({ id: a.artistId, title: cleanArtist(a.name), value: a.plays, coverId: a.coverArt, to: `/artists/${a.artistId}` })));
const trackRows = computed<RankedRow[]>(() => tracks.value.map((t) => ({ id: t.id, title: t.title, subtitle: cleanArtist(t.artist), value: t.plays, coverId: t.hasCoverArt ? t.id : null, to: `/tracks/${t.id}`, artistId: t.artistId })));
const seriesValues = computed(() => series.value.map((p) => p.plays));
const genreMax = computed(() => Math.max(1, ...genres.value.map((g) => g.plays)));
</script>

<template>
  <div class="py-2">
    <div v-if="loading" class="grid min-h-[50vh] place-items-center"><Spinner /></div>

    <div v-else-if="isEmpty" class="grid min-h-[50vh] place-items-center text-center">
      <div>
        <h1 class="text-3xl font-black tracking-tight">Wrapped</h1>
        <p class="mx-auto mt-3 max-w-[42ch] text-sm text-muted">Not enough listening this year yet. Your year in review fills in as Spindle tracks more plays.</p>
      </div>
    </div>

    <div v-else class="stagger flex flex-col gap-12">
      <section>
        <div class="label" style="letter-spacing:0.12em">Your year in sound</div>
        <div class="mt-2 text-7xl font-black leading-[0.85] tracking-tight lg:text-8xl" :style="{ color: 'var(--accent)' }"><AnimatedNumber :value="totals?.plays ?? 0" :format="formatNumber" /></div>
        <div class="mt-3 text-xl font-semibold text-muted">plays · <AnimatedNumber :value="totals?.seconds ?? 0" :format="formatDuration" /> of listening</div>
      </section>

      <section class="grid grid-cols-3 gap-8">
        <div><div class="text-4xl font-black lg:text-5xl"><AnimatedNumber :value="totals?.distinctArtists ?? 0" :format="formatNumber" /></div><div class="label mt-2">Artists</div></div>
        <div><div class="text-4xl font-black lg:text-5xl"><AnimatedNumber :value="totals?.distinctAlbums ?? 0" :format="formatNumber" /></div><div class="label mt-2">Albums</div></div>
        <div><div class="text-4xl font-black lg:text-5xl"><AnimatedNumber :value="totals?.distinctTracks ?? 0" :format="formatNumber" /></div><div class="label mt-2">Tracks</div></div>
      </section>

      <section v-if="seriesValues.length">
        <div class="label mb-4">Across the year</div>
        <div class="rounded-2xl border border-line/70 bg-surface/40 p-5">
          <LineArea :values="seriesValues" :height="170" />
        </div>
      </section>

      <section class="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <div>
          <div class="label mb-4">Top artists</div>
          <RankedList :rows="artistRows" />
        </div>
        <div>
          <div class="label mb-4">Top songs</div>
          <RankedList :rows="trackRows" playable />
        </div>
      </section>

      <section v-if="genres.length">
        <div class="label mb-4">Top genres</div>
        <div class="flex flex-col gap-2.5">
          <div v-for="g in genres" :key="g.genre" class="flex items-center gap-4">
            <span class="w-32 flex-none truncate text-sm font-semibold capitalize">{{ g.genre }}</span>
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div class="h-full rounded-full" :style="{ width: (g.plays / genreMax) * 100 + '%', background: 'var(--accent)' }" />
            </div>
            <span class="tabular w-12 flex-none text-right text-sm font-semibold text-muted">{{ formatNumber(g.plays) }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
