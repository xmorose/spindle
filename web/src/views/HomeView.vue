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
const isEmpty = computed(() => !totals.loading.value && (totals.data.value?.plays ?? 0) === 0);

useCoverAccent(() => (topTrack.value?.hasCoverArt ? topTrack.value.id : null));
</script>

<template>
  <div class="py-2">
    <EmptyState v-if="isEmpty" title="No plays in this range yet"
      hint="Spindle started tracking recently, so recent windows fill in as you listen. Switch to All to see your full history." />

    <template v-else>
      <section class="mb-10 grid grid-cols-1 gap-7 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <div class="text-[11px] font-bold uppercase tracking-[0.16em] text-faint">This range</div>
          <div class="tabular text-7xl font-black leading-[0.9]" :style="{ color: 'var(--accent)' }">
            {{ formatNumber(totals.data.value?.plays ?? 0) }}
          </div>
          <div class="mt-3 text-lg font-semibold text-muted">songs played</div>
          <div class="mt-5 flex gap-7 border-t border-line/50 pt-4">
            <div><div class="tabular text-2xl font-extrabold">{{ formatDuration(totals.data.value?.seconds ?? 0) }}</div><div class="text-[11px] text-faint">listening time</div></div>
            <div><div class="tabular text-2xl font-extrabold">{{ totals.data.value?.distinctArtists ?? 0 }}</div><div class="text-[11px] text-faint">artists</div></div>
          </div>
        </div>
        <RouterLink v-if="topArtist" :to="`/artists/${topArtist.artistId}`"
          class="relative flex min-h-[260px] items-end overflow-hidden rounded-2xl">
          <CoverArt :id="topTrack?.hasCoverArt ? topTrack.id : null" :name="topArtist.name" :size="600" class="absolute inset-0 h-full w-full" />
          <div class="absolute inset-0" style="background:linear-gradient(180deg,transparent 40%,oklch(0.12 0.02 40 / 0.78) 100%)" />
          <div class="relative p-7">
            <div class="text-[11px] font-bold uppercase tracking-[0.16em] text-white/80">Top artist</div>
            <div class="text-4xl font-black text-white" style="text-shadow:0 2px 20px rgba(0,0,0,.4)">{{ cleanArtist(topArtist.name) }}</div>
            <div class="tabular mt-1 text-sm font-semibold text-white/85">{{ topArtist.plays }} plays · {{ formatDuration(topArtist.seconds) }}</div>
          </div>
        </RouterLink>
      </section>

      <section class="mb-10">
        <div class="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Listening over time</div>
        <LineArea :values="playValues" :height="170" />
      </section>

      <section class="grid grid-cols-1 gap-9 lg:grid-cols-[1fr_0.85fr]">
        <div>
          <div class="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Listening clock</div>
          <div class="flex items-center gap-6">
            <RadialClock :hours="hourly" class="h-[200px] w-[200px] flex-none" />
            <div>
              <div class="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Peak listening</div>
              <div class="tabular text-3xl font-extrabold">{{ String(peak).padStart(2, "0") }}:00</div>
            </div>
          </div>
        </div>
        <div v-if="topTrack">
          <div class="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Best song</div>
          <div class="mb-4 flex items-center gap-4">
            <CoverArt :id="topTrack.hasCoverArt ? topTrack.id : null" :name="topTrack.title" :size="160" class="h-16 w-16 flex-none" />
            <div>
              <div class="text-[10px] font-bold uppercase tracking-[0.16em]" :style="{ color: 'var(--accent)' }">{{ topTrack.plays }} plays</div>
              <div class="text-lg font-bold">{{ topTrack.title }}</div>
              <div class="text-sm text-muted">{{ cleanArtist(topTrack.artist) }}</div>
            </div>
          </div>
          <div class="border-t border-line/50">
            <RouterLink v-for="(t, i) in restTracks" :key="t.id" :to="`/tracks/${t.id}`"
              class="flex items-center gap-3 border-b border-line/30 py-2 last:border-0">
              <span class="tabular w-4 text-right text-xs font-bold text-faint">{{ i + 2 }}</span>
              <CoverArt :id="t.hasCoverArt ? t.id : null" :name="t.title" :size="80" class="h-8 w-8 flex-none" />
              <span class="min-w-0 flex-1 truncate text-[13px] font-semibold">{{ t.title }}<span class="block truncate text-[11px] font-normal text-faint">{{ cleanArtist(t.artist) }}</span></span>
              <span class="tabular text-xs font-semibold text-muted">{{ t.plays }}</span>
            </RouterLink>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
