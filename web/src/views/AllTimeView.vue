<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import { api } from "@/api/client";
import { useUserStore } from "@/stores/user";
import { formatNumber, formatDuration, cleanArtist } from "@/lib/format";
import type { Totals, TimePoint } from "@/api/types";
import RankedList, { type RankedRow } from "@/components/RankedList.vue";
import LineArea from "@/components/charts/LineArea.vue";
import AnimatedNumber from "@/components/ui/AnimatedNumber.vue";
import Skeleton from "@/components/ui/Skeleton.vue";
import SkeletonList from "@/components/ui/SkeletonList.vue";
import { useCoverAccent } from "@/composables/useCoverAccent";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const router = useRouter();
const totals = ref<Totals | null>(null);
const artistRows = ref<RankedRow[]>([]);
const trackRows = ref<RankedRow[]>([]);
const daily = ref<TimePoint[]>([]);
const loading = ref(true);
const { user } = storeToRefs(useUserStore());

async function load() {
  loading.value = true;
  try {
    const [t, ar, tr, ds] = await Promise.all([
      api.totals({ range: "all" }),
      api.topArtists({ range: "all", limit: 10 }),
      api.topTracks({ range: "all", limit: 10 }),
      api.timeseries({ range: "all", bucket: "day" }),
    ]);
    totals.value = t;
    artistRows.value = ar.map((a) => ({ id: a.artistId, title: cleanArtist(a.name), value: a.plays, coverId: a.coverArt, to: `/artists/${a.artistId}` }));
    trackRows.value = tr.map((x) => ({ id: x.id, title: x.title, subtitle: cleanArtist(x.artist), value: x.plays, coverId: x.hasCoverArt ? x.id : null, to: `/tracks/${x.id}`, artistId: x.artistId }));
    daily.value = ds;
  } finally {
    loading.value = false;
  }
}
watch(user, load, { immediate: true });
useCoverAccent(() => artistRows.value[0]?.coverId ?? null);

const supporting = computed(() => totals.value ? [
  { label: "Listening time", value: formatDuration(totals.value.seconds) },
  { label: "Artists", value: formatNumber(totals.value.distinctArtists) },
  { label: "Albums", value: formatNumber(totals.value.distinctAlbums) },
  { label: "Tracks", value: formatNumber(totals.value.distinctTracks) },
] : []);

interface Month { key: string; year: number; month: number; plays: number }

const months = computed<Month[]>(() => {
  if (!daily.value.length) return [];
  const byKey = new Map<string, Month>();
  for (const p of daily.value) {
    const d = new Date(p.bucket * 86_400_000);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const key = `${year}-${month}`;
    const cur = byKey.get(key) ?? { key, year, month, plays: 0 };
    cur.plays += p.plays;
    byKey.set(key, cur);
  }
  const found = [...byKey.values()].sort((a, b) => a.year - b.year || a.month - b.month);
  const first = found[0];
  const last = found[found.length - 1];
  const out: Month[] = [];
  for (let y = first.year; y <= last.year; y++) {
    const from = y === first.year ? first.month : 0;
    const to = y === last.year ? last.month : 11;
    for (let m = from; m <= to; m++) {
      const key = `${y}-${m}`;
      out.push(byKey.get(key) ?? { key, year: y, month: m, plays: 0 });
    }
  }
  return out;
});

const monthValues = computed(() => months.value.map((m) => m.plays));
const monthLabels = computed(() => months.value.map((m) => `${MONTHS[m.month]} ${m.year}`));

const years = computed(() => {
  const byYear = new Map<number, number>();
  for (const m of months.value) byYear.set(m.year, (byYear.get(m.year) ?? 0) + m.plays);
  return [...byYear.entries()].map(([year, plays]) => ({ year, plays })).sort((a, b) => a.year - b.year);
});
const yearMax = computed(() => Math.max(1, ...years.value.map((y) => y.plays)));
const bestYear = computed(() => years.value.reduce((a, b) => (b.plays > a.plays ? b : a), years.value[0]));
const bestMonth = computed(() => months.value.reduce((a, b) => (b.plays > a.plays ? b : a), months.value[0]));
const firstMonth = computed(() => months.value.find((m) => m.plays > 0) ?? null);
const hasHistory = computed(() => months.value.length > 1);

function openYear(year: number) {
  void router.push(year === new Date().getFullYear() ? "/wrapped" : `/wrapped/${year}`);
}
</script>

<template>
  <div class="pb-2 rise">
    <h1 class="mb-1 text-3xl font-black tracking-tight">All-time</h1>
    <p class="mb-9 text-sm text-faint">Your full history, including plays from before tracking started.</p>

    <template v-if="loading">
      <section class="mb-11 flex flex-col gap-7 sm:flex-row sm:items-end sm:gap-12">
        <div>
          <Skeleton class="h-12 w-52 max-w-full sm:h-14 lg:h-[68px]" />
          <Skeleton class="mt-3 h-2.5 w-28" />
        </div>
        <div class="flex flex-wrap gap-8 sm:gap-12">
          <div v-for="i in 4" :key="i">
            <Skeleton class="h-6 w-20 sm:h-7" />
            <Skeleton class="mt-2 h-2.5 w-16" />
          </div>
        </div>
      </section>
      <Skeleton class="mb-11 h-[200px] w-full rounded-2xl" />
      <div class="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <SkeletonList :rows="8" />
        <SkeletonList :rows="8" />
      </div>
    </template>

    <template v-else>
      <section class="mb-12 flex flex-col gap-7 sm:flex-row sm:items-end sm:gap-12">
        <div class="flex-none">
          <div class="text-5xl font-black leading-[0.85] tracking-tight sm:text-6xl lg:text-7xl" :style="{ color: 'var(--accent)' }">
            <AnimatedNumber :value="totals?.plays ?? 0" :format="formatNumber" />
          </div>
          <div class="label mt-3">Songs played</div>
        </div>
        <div class="flex flex-wrap gap-8 sm:gap-12 sm:border-l sm:border-line/60 sm:pb-1 sm:pl-12">
          <div v-for="s in supporting" :key="s.label">
            <div class="tabular text-2xl font-black leading-none tracking-tight sm:text-3xl">{{ s.value }}</div>
            <div class="label-sm mt-2">{{ s.label }}</div>
          </div>
        </div>
      </section>

      <template v-if="hasHistory">
        <section class="mb-12">
          <div class="label mb-1">Every month you have listened</div>
          <p class="mb-5 text-sm text-faint">Timestamped plays only. Baseline counts from before tracking have no dates, so they sit in the totals above but not on this line.</p>
          <LineArea :values="monthValues" :labels="monthLabels" :height="200" zoomable />
        </section>

        <section class="mb-12">
          <div class="label mb-1">Year by year</div>
          <p class="mb-6 text-sm text-faint">Pick a year to open its Wrapped.</p>
          <div class="flex items-end gap-2 sm:gap-3">
            <button v-for="y in years" :key="y.year" @click="openYear(y.year)"
              class="year-col group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-lg pb-1 pt-1 transition-colors hover:bg-surface/70">
              <span class="tabular text-[11px] font-bold" :class="y.year === bestYear.year ? 'text-text' : 'text-faint'">{{ formatNumber(y.plays) }}</span>
              <span class="w-full rounded-t-md rounded-b-sm transition-[height,opacity] duration-700 ease-out motion-reduce:transition-none"
                :style="{ height: Math.max(4, (y.plays / yearMax) * 150) + 'px', background: 'var(--accent)', opacity: y.year === bestYear.year ? 1 : 0.42 }" />
              <span class="label-sm group-hover:text-text">{{ y.year }}</span>
            </button>
          </div>
        </section>

        <section class="mb-12">
          <div class="label mb-5">Milestones</div>
          <div class="flex flex-wrap items-end gap-x-12 gap-y-7 border-y border-line/50 py-6">
            <div v-if="firstMonth">
              <div class="text-2xl font-black leading-none tracking-tight">{{ MONTHS[firstMonth.month] }} {{ firstMonth.year }}</div>
              <div class="label-sm mt-2.5">First tracked month</div>
            </div>
            <div v-if="bestMonth">
              <div class="text-2xl font-black leading-none tracking-tight" :style="{ color: 'var(--accent)' }">{{ MONTHS[bestMonth.month] }} {{ bestMonth.year }}</div>
              <div class="label-sm mt-2.5">Biggest month</div>
            </div>
            <div v-if="bestYear" class="sm:border-l sm:border-line/60 sm:pl-12">
              <div class="tabular text-2xl font-black leading-none tracking-tight">{{ bestYear.year }}</div>
              <div class="label-sm mt-2.5">Biggest year</div>
            </div>
            <div>
              <div class="tabular text-2xl font-black leading-none tracking-tight">{{ months.length }}</div>
              <div class="label-sm mt-2.5">Months tracked</div>
            </div>
          </div>
        </section>
      </template>

      <div class="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <section>
          <div class="label mb-3">Top artists</div>
          <RankedList :rows="artistRows" playable kind="artist" />
        </section>
        <section>
          <div class="label mb-3">Top tracks</div>
          <RankedList :rows="trackRows" playable />
        </section>
      </div>
    </template>
  </div>
</template>
