<script setup lang="ts">
import { computed } from "vue";
import { api } from "@/api/client";
import { useRangedResource } from "@/composables/useRangedResource";
import { useCoverAccent } from "@/composables/useCoverAccent";
import { formatNumber, formatDuration, cleanArtist } from "@/lib/format";
import { hourlyFromHeatmap, peakHour } from "@/lib/stats";
import LineArea from "@/components/charts/LineArea.vue";
import RadialClock from "@/components/charts/RadialClock.vue";
import CoverArt from "@/components/CoverArt.vue";
import EmptyState from "@/components/ui/EmptyState.vue";

const totals = useRangedResource((range) => api.totals({ range }));
const series = useRangedResource((range) => api.timeseries({ range, bucket: "day" }));
const artists = useRangedResource((range) => api.topArtists({ range, limit: 1 }));
const tracks = useRangedResource((range) => api.topTracks({ range, limit: 4 }));
const heat = useRangedResource(() => api.heatmap({ range: "all" }));

const topArtist = computed(() => artists.data.value?.[0] ?? null);
const topTrack = computed(() => tracks.data.value?.[0] ?? null);
const restTracks = computed(() => tracks.data.value?.slice(1) ?? []);
const playValues = computed(() => (series.data.value ?? []).map((p) => p.plays));
const hourly = computed(() => hourlyFromHeatmap(heat.data.value ?? []));
const peak = computed(() => peakHour(hourly.value));
const firstLoad = computed(() => totals.loading.value && totals.data.value === null);
const isEmpty = computed(() => !totals.loading.value && (totals.data.value?.plays ?? 0) === 0);

useCoverAccent(() => (topTrack.value?.hasCoverArt ? topTrack.value.id : null));
</script>

<template>
  <div class="py-2">
    <div v-if="firstLoad" class="grid min-h-[60vh] place-items-center">
      <div class="h-10 w-10 animate-spin rounded-full border-2 border-line border-t-[var(--accent)]" />
    </div>

    <EmptyState v-else-if="isEmpty" title="No plays in this range yet"
      hint="Spindle started tracking recently, so recent windows fill in as you listen. Switch to All time to see your full history." />

    <div v-else class="stagger flex flex-col gap-12">
      <section class="grid grid-cols-2 gap-x-8 gap-y-9 md:grid-cols-4">
        <div>
          <div class="tabular text-5xl font-black leading-none lg:text-6xl" :style="{ color: 'var(--accent)' }">{{ formatNumber(totals.data.value?.plays ?? 0) }}</div>
          <div class="label mt-3">Songs played</div>
        </div>
        <div>
          <div class="tabular text-5xl font-black leading-none lg:text-6xl">{{ formatDuration(totals.data.value?.seconds ?? 0) }}</div>
          <div class="label mt-3">Listening time</div>
        </div>
        <div>
          <div class="tabular text-5xl font-black leading-none lg:text-6xl">{{ formatNumber(totals.data.value?.distinctArtists ?? 0) }}</div>
          <div class="label mt-3">Artists</div>
        </div>
        <div>
          <div class="tabular text-5xl font-black leading-none lg:text-6xl">{{ formatNumber(totals.data.value?.distinctAlbums ?? 0) }}</div>
          <div class="label mt-3">Albums</div>
        </div>
      </section>

      <RouterLink v-if="topArtist" :to="`/artists/${topArtist.artistId}`"
        class="group relative block h-[240px] overflow-hidden rounded-2xl">
        <CoverArt :id="topTrack?.hasCoverArt ? topTrack.id : null" :name="cleanArtist(topArtist.name)" :size="900"
          class="absolute inset-0 h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
        <div class="absolute inset-0" style="background:linear-gradient(110deg,oklch(0.14 0.02 50 / 0.85) 0%,transparent 55%,oklch(0.14 0.02 50 / 0.5) 100%)" />
        <div class="relative flex h-full flex-col justify-end p-8">
          <div class="label" style="color:oklch(0.97 0.02 80 / 0.9)">Top artist</div>
          <div class="mt-1 text-5xl font-black text-white" style="text-shadow:0 2px 24px oklch(0.1 0.02 40 / 0.5)">{{ cleanArtist(topArtist.name) }}</div>
          <div class="tabular mt-2 text-[15px] font-semibold" style="color:oklch(0.97 0.02 80 / 0.85)">{{ formatNumber(topArtist.plays) }} plays · {{ formatDuration(topArtist.seconds) }}</div>
        </div>
      </RouterLink>

      <section>
        <div class="label mb-4">Listening over time</div>
        <div class="rounded-2xl border border-line/70 bg-surface/40 p-5">
          <LineArea :values="playValues" :height="190" />
        </div>
      </section>

      <section class="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <div class="label mb-5">Listening clock</div>
          <div class="flex items-center gap-7">
            <RadialClock :hours="hourly" class="h-[220px] w-[220px] flex-none" />
            <div>
              <div class="label">Peak listening</div>
              <div class="tabular mt-1 text-4xl font-black" :style="{ color: 'var(--accent)' }">{{ String(peak).padStart(2, "0") }}:00</div>
            </div>
          </div>
        </div>
        <div v-if="topTrack">
          <div class="label mb-5">Best song</div>
          <RouterLink :to="`/tracks/${topTrack.id}`" class="mb-3 flex items-center gap-4">
            <CoverArt :id="topTrack.hasCoverArt ? topTrack.id : null" :name="topTrack.title" :size="160" class="h-16 w-16 flex-none" />
            <div>
              <div class="label" :style="{ color: 'var(--accent)', fontSize: '11px' }">{{ formatNumber(topTrack.plays) }} plays</div>
              <div class="text-xl font-bold leading-tight">{{ topTrack.title }}</div>
              <div class="text-sm text-muted">{{ cleanArtist(topTrack.artist) }}</div>
            </div>
          </RouterLink>
          <div class="border-t border-line/60">
            <RouterLink v-for="(t, i) in restTracks" :key="t.id" :to="`/tracks/${t.id}`"
              class="flex items-center gap-3 border-b border-line/40 py-2.5 transition-colors duration-150 last:border-0 hover:bg-surface/60">
              <span class="tabular w-5 text-right text-sm font-bold text-faint">{{ i + 2 }}</span>
              <CoverArt :id="t.hasCoverArt ? t.id : null" :name="t.title" :size="80" class="h-9 w-9 flex-none" />
              <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ t.title }}<span class="block truncate text-xs font-normal text-faint">{{ cleanArtist(t.artist) }}</span></span>
              <span class="tabular text-sm font-semibold text-muted">{{ formatNumber(t.plays) }}</span>
            </RouterLink>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
