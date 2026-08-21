<script setup lang="ts">
import { computed, ref } from "vue";
import { api } from "@/api/client";
import { useRangedResource } from "@/composables/useRangedResource";
import { useCoverAccent } from "@/composables/useCoverAccent";
import { formatNumber, formatDuration, cleanArtist } from "@/lib/format";
import { hourlyFromHeatmap, peakHour } from "@/lib/stats";
import LineArea from "@/components/charts/LineArea.vue";
import RadialClock from "@/components/charts/RadialClock.vue";
import CoverArt from "@/components/CoverArt.vue";
import RankedList, { type RankedRow } from "@/components/RankedList.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import AnimatedNumber from "@/components/ui/AnimatedNumber.vue";
import Skeleton from "@/components/ui/Skeleton.vue";
import DayDetail from "@/components/DayDetail.vue";

const totals = useRangedResource((p) => api.totals(p));
const series = useRangedResource((p) => api.timeseries({ ...p, bucket: "day" }));
const artists = useRangedResource((p) => api.topArtists({ ...p, limit: 1 }));
const tracks = useRangedResource((p) => api.topTracks({ ...p, limit: 5 }));
const heat = useRangedResource((p) => api.heatmap(p));

const topArtist = computed(() => artists.data.value?.[0] ?? null);
const topTrack = computed(() => tracks.data.value?.[0] ?? null);
const trackRows = computed<RankedRow[]>(() =>
  (tracks.data.value ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    subtitle: cleanArtist(t.artist),
    value: t.plays,
    valueLabel: formatNumber(t.plays),
    coverId: t.hasCoverArt ? t.id : null,
    to: `/tracks/${t.id}`,
    artistId: t.artistId,
  })),
);
const playValues = computed(() => (series.data.value ?? []).map((p) => p.plays));
const seriesLabels = computed(() =>
  (series.data.value ?? []).map((p) =>
    new Date(p.bucket * 86_400_000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })),
);
const hasSeries = computed(() => playValues.value.some((v) => v > 0));
const hourly = computed(() => hourlyFromHeatmap(heat.data.value ?? []));
const peak = computed(() => peakHour(hourly.value));
const firstLoad = computed(() => totals.loading.value && totals.data.value === null);
const isEmpty = computed(() => !totals.loading.value && (totals.data.value?.plays ?? 0) === 0);

const pickedDay = ref<number | null>(null);
function pickDay(i: number) {
  const p = series.data.value?.[i];
  if (p) pickedDay.value = p.bucket;
}

const heroCover = computed(() => topArtist.value?.coverArt ?? (topTrack.value?.hasCoverArt ? topTrack.value.id : null));
useCoverAccent(() => heroCover.value);
</script>

<template>
  <div class="py-2">
    <div v-if="firstLoad" class="flex flex-col gap-12">
      <section class="flex flex-col gap-7 sm:flex-row sm:items-end sm:gap-12">
        <div>
          <Skeleton class="h-12 w-52 max-w-full sm:h-14 lg:h-[68px]" />
          <Skeleton class="mt-3 h-2.5 w-28" />
        </div>
        <div class="flex flex-wrap gap-8 sm:gap-12">
          <div v-for="i in 3" :key="i">
            <Skeleton class="h-6 w-20 sm:h-7" />
            <Skeleton class="mt-2 h-2.5 w-16" />
          </div>
        </div>
      </section>
      <Skeleton class="h-[280px] w-full rounded-2xl sm:h-[320px]" />
      <section>
        <Skeleton class="mb-4 h-2.5 w-36" />
        <Skeleton class="h-[210px] w-full rounded-2xl" />
      </section>
    </div>

    <EmptyState v-else-if="isEmpty" title="No plays in this range yet"
      hint="Spindle started tracking recently, so recent windows fill in as you listen. Switch to All time to see your full history." />

    <div v-else class="stagger flex flex-col gap-14">
      <section class="flex flex-col gap-7 sm:flex-row sm:items-end sm:gap-12">
        <div class="flex-none">
          <div class="text-6xl font-black leading-[0.82] tracking-tight sm:text-7xl lg:text-8xl" :style="{ color: 'var(--accent)' }"><AnimatedNumber :value="totals.data.value?.plays ?? 0" :format="formatNumber" /></div>
          <div class="label mt-3">Songs played</div>
        </div>
        <div class="flex flex-wrap gap-x-10 gap-y-6 sm:gap-x-12 sm:border-l sm:border-line/60 sm:pb-1.5 sm:pl-12">
          <div>
            <div class="text-2xl font-black leading-none tracking-tight sm:text-3xl"><AnimatedNumber :value="totals.data.value?.seconds ?? 0" :format="formatDuration" /></div>
            <div class="label-sm mt-2">Listening time</div>
          </div>
          <div>
            <div class="text-2xl font-black leading-none tracking-tight sm:text-3xl"><AnimatedNumber :value="totals.data.value?.distinctArtists ?? 0" :format="formatNumber" /></div>
            <div class="label-sm mt-2">Artists</div>
          </div>
          <div>
            <div class="text-2xl font-black leading-none tracking-tight sm:text-3xl"><AnimatedNumber :value="totals.data.value?.distinctAlbums ?? 0" :format="formatNumber" /></div>
            <div class="label-sm mt-2">Albums</div>
          </div>
        </div>
      </section>

      <RouterLink v-if="topArtist" :to="`/artists/${topArtist.artistId}`"
        class="group relative block h-[280px] overflow-hidden rounded-2xl sm:h-[320px]">
        <CoverArt :id="heroCover" :name="cleanArtist(topArtist.name)" :size="900"
          class="absolute inset-0 h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
        <div class="absolute inset-0" style="background:linear-gradient(100deg,oklch(0.13 0.02 50 / 0.92) 0%,oklch(0.13 0.02 50 / 0.55) 46%,transparent 72%)" />
        <div class="absolute inset-x-0 bottom-0 h-1/2" style="background:linear-gradient(180deg,transparent,oklch(0.13 0.02 50 / 0.8))" />
        <div class="relative flex h-full max-w-[62%] flex-col justify-end p-7 sm:p-9">
          <div class="label label-over">Top artist</div>
          <div class="mt-1.5 text-4xl font-black leading-[0.92] tracking-tight text-white sm:text-6xl" style="text-shadow:0 2px 28px oklch(0.1 0.02 40 / 0.55)">{{ cleanArtist(topArtist.name) }}</div>
          <div class="tabular mt-3 text-[15px] font-semibold" style="color:oklch(0.97 0.02 80 / 0.85)">{{ formatNumber(topArtist.plays) }} {{ topArtist.plays === 1 ? 'play' : 'plays' }} · {{ formatDuration(topArtist.seconds) }}</div>
        </div>
      </RouterLink>

      <section>
        <div class="label mb-4">Listening over time</div>
        <LineArea v-if="hasSeries" :values="playValues" :labels="seriesLabels" :height="210" zoomable pickable @pick="pickDay" />
        <div v-else class="grid h-[210px] place-items-center rounded-2xl border border-line/60 text-center text-sm text-faint">Not enough plays in this range yet. Try a longer window.</div>
      </section>

      <section class="grid grid-cols-1 gap-12 lg:grid-cols-[0.85fr_1fr] lg:gap-16">
        <div>
          <div class="label mb-5">Listening clock</div>
          <div class="flex flex-wrap items-center gap-x-8 gap-y-5">
            <RadialClock :hours="hourly" class="h-[210px] w-[210px] flex-none" />
            <div>
              <div class="tabular text-5xl font-black leading-none tracking-tight" :style="{ color: 'var(--accent)' }">{{ String(peak).padStart(2, "0") }}:00</div>
              <div class="label-sm mt-2.5">Peak listening</div>
            </div>
          </div>
        </div>
        <div v-if="trackRows.length">
          <div class="label mb-5">Top songs</div>
          <RankedList :rows="trackRows" playable kind="track" />
        </div>
      </section>
    </div>

    <DayDetail :day="pickedDay" @close="pickedDay = null" />
  </div>
</template>
