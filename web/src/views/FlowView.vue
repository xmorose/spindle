<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { api, coverUrl } from "@/api/client";
import type { FlowData, FlowGroup, FlowParams, FlowSeries } from "@/api/types";
import { useRangeStore } from "@/stores/range";
import { useUserStore } from "@/stores/user";
import { useCoverAccent } from "@/composables/useCoverAccent";
import { useFlowColors } from "@/composables/useFlowColors";
import { cleanArtist, formatDate, formatDuration, formatNumber } from "@/lib/format";
import { fallbackFlowColor, formatFlowPlays, GROUP_LABELS, type FlowMetric } from "@/lib/flow";
import FlowStream from "@/components/charts/FlowStream.vue";
import CoverArt from "@/components/CoverArt.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import Skeleton from "@/components/ui/Skeleton.vue";

interface Period { from: number; to: number; }

const FILL_KEY = "spindle.flow.fill";
const GROUPS: FlowGroup[] = ["artist", "album", "genre"];
const METRICS: { value: FlowMetric; label: string }[] = [
  { value: "plays", label: "Plays" },
  { value: "time", label: "Listening time" },
];
const PERIOD_LABELS = { day: "Daily", week: "Weekly", month: "Monthly" } as const;

function readArtworkPref(): boolean {
  try { return localStorage.getItem(FILL_KEY) !== "colors"; } catch { return true; }
}

function writeArtworkPref(artwork: boolean) {
  try { localStorage.setItem(FILL_KEY, artwork ? "artwork" : "colors"); } catch { }
}

const rangeStore = useRangeStore();
const { params } = storeToRefs(rangeStore);
const { user } = storeToRefs(useUserStore());

const group = ref<FlowGroup>("artist");
const metric = ref<FlowMetric>("plays");
const artwork = ref(readArtworkPref());
watch(artwork, writeArtworkPref);

const data = ref<FlowData | null>(null);
const loading = ref(true);
const error = ref(false);
const selected = ref<string | null>(null);
const includeOther = ref(false);
const zooms = ref<Period[]>([]);

const media = window.matchMedia("(max-width: 639px)");
const compact = ref(media.matches);
const onMediaChange = () => { compact.value = media.matches; };
media.addEventListener("change", onMediaChange);

let controller: AbortController | null = null;
onBeforeUnmount(() => {
  controller?.abort();
  media.removeEventListener("change", onMediaChange);
});

const colors = useFlowColors(data);
const other = computed(() => data.value?.series.find((s) => s.other) ?? null);
const topSeries = computed(() => data.value?.series.filter((s) => !s.other) ?? []);
const plotted = computed(() => data.value && (includeOther.value ? data.value : { ...data.value, series: topSeries.value }));
const feature = computed(() => data.value?.series.find((s) => s.id === selected.value) ?? topSeries.value[0] ?? null);
const groupLabel = computed(() => GROUP_LABELS[group.value].toLowerCase());
const backdropFailed = ref(false);
watch(() => feature.value?.coverArt, () => { backdropFailed.value = false; });
useCoverAccent(() => feature.value?.coverArt);

const color = (id: string) => colors.value[id] ?? fallbackFlowColor(id);
const name = (s: FlowSeries) => (group.value === "artist" ? cleanArtist(s.name) : s.name);
const total = (s: FlowSeries) => (metric.value === "time" ? s.totalSeconds : s.totalPlays);
const amount = (n: number) => (metric.value === "time" ? formatDuration(n) : formatFlowPlays(n));

async function load() {
  controller?.abort();
  const current = new AbortController();
  controller = current;
  loading.value = true;
  error.value = false;
  const query: FlowParams = {
    ...(zooms.value.at(-1) ?? params.value),
    group: group.value,
    sort: metric.value,
    bucket: "auto",
    limit: compact.value ? 8 : 16,
    compact: compact.value,
    focus: selected.value && selected.value !== other.value?.id ? selected.value : undefined,
  };
  try {
    const response = await api.flow(query, current.signal);
    if (controller !== current) return;
    data.value = response;
    if (!response.series.some((s) => s.id === selected.value)) selected.value = null;
  } catch {
    if (!current.signal.aborted) error.value = true;
  } finally {
    if (controller === current) loading.value = false;
  }
}

watch([params, user], () => {
  zooms.value = [];
  selected.value = null;
  data.value = null;
});
watch(group, () => {
  selected.value = null;
  data.value = null;
});
watch([params, user, group, metric, compact, zooms], load, { immediate: true });

function select(id: string) {
  selected.value = selected.value === id ? null : id;
}

function toggleOther() {
  includeOther.value = !includeOther.value;
  if (!includeOther.value && selected.value === other.value?.id) selected.value = null;
}

function zoomTo(period: Period) { zooms.value = [...zooms.value, period]; }
function zoomOut() { zooms.value = zooms.value.slice(0, -1); }
function resetZoom() { zooms.value = []; }
function allHistory() {
  resetZoom();
  rangeStore.setPreset("all");
}

const datesOpen = ref(false);
const fromDate = ref("");
const toDate = ref("");
const dateError = ref("");

function isoDay(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toggleDates() {
  if (!data.value) return;
  fromDate.value = isoDay(data.value.from);
  toDate.value = isoDay(data.value.to);
  dateError.value = "";
  datesOpen.value = !datesOpen.value;
}

function applyDates() {
  const from = Math.floor(new Date(`${fromDate.value}T00:00:00`).getTime() / 1000);
  const to = Math.floor(Math.min(Date.now(), new Date(`${toDate.value}T23:59:59`).getTime()) / 1000);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || from > to) {
    dateError.value = "Choose a valid start and end date.";
    return;
  }
  zoomTo({ from, to });
  datesOpen.value = false;
}
</script>

<template>
  <div class="min-w-0 pb-4">
    <header class="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div>
        <h1 class="text-4xl font-black tracking-tight">Flow</h1>
        <p class="mt-2 text-sm text-muted">Your music, changing over time.</p>
      </div>
      <button class="flow-button" @click="allHistory">Explore all history</button>
    </header>

    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div class="flex gap-1" role="group" aria-label="Group listening by">
        <button v-for="option in GROUPS" :key="option" class="flow-tab" :aria-pressed="group === option" @click="group = option">
          {{ GROUP_LABELS[option] }}
        </button>
      </div>
      <div class="flex gap-1 rounded-full border border-line p-1" role="group" aria-label="Measure listening by">
        <button v-for="option in METRICS" :key="option.value" class="flow-pill" :aria-pressed="metric === option.value" @click="metric = option.value">
          {{ option.label }}
        </button>
      </div>
    </div>

    <div v-if="loading && !data" role="status" aria-label="Loading listening history">
      <Skeleton class="h-40 w-full rounded-xl" />
      <Skeleton class="mt-5 h-[350px] w-full rounded-xl" />
    </div>

    <div v-else-if="error" role="alert">
      <EmptyState title="Flow could not load" hint="Your listening history is still there. Try loading it again." />
      <button class="flow-button mt-4" @click="load">Retry</button>
    </div>

    <div v-else-if="!data?.series.length">
      <EmptyState title="No listening history in this period" hint="Flow uses imported history and new scrobbles. Starting play counts have no dates." />
      <div class="mt-4 flex gap-2">
        <button class="flow-button" @click="allHistory">Show all history</button>
        <button v-if="zooms.length" class="flow-button" @click="zoomOut">Back</button>
      </div>
    </div>

    <div v-else :aria-busy="loading">
      <section class="flow-feature relative isolate flex min-h-40 items-center gap-5 overflow-hidden rounded-xl px-5 py-6 sm:px-7" aria-label="Featured listening">
        <img
          v-if="feature?.coverArt && !backdropFailed"
          :key="feature.coverArt"
          :src="coverUrl(feature.coverArt, 600)"
          alt=""
          class="feature-art absolute inset-y-0 right-0 -z-20 h-full w-3/4 object-cover sm:w-3/5"
          @error="backdropFailed = true"
        />
        <div class="feature-shade absolute inset-0 -z-10" />
        <template v-if="feature">
          <CoverArt :id="feature.coverArt" :name="name(feature)" :size="160" class="w-16 flex-none shadow-lg sm:w-24" />
          <div class="min-w-0 max-w-[65ch]">
            <div class="label-sm mb-2">{{ selected ? "Following this stream" : `Leading ${group} in this period` }}</div>
            <RouterLink v-if="feature.href" :to="feature.href" class="block truncate text-2xl font-black tracking-tight hover:underline sm:text-3xl">
              {{ name(feature) }}
            </RouterLink>
            <span v-else class="block truncate text-2xl font-black tracking-tight sm:text-3xl">{{ name(feature) }}</span>
            <div v-if="feature.subtitle" class="mt-1 truncate text-sm text-muted">{{ cleanArtist(feature.subtitle) }}</div>
            <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
              <span>{{ amount(total(feature)) }}</span>
              <button v-if="selected" class="underline underline-offset-4 hover:text-text" @click="selected = null">Show every stream</button>
            </div>
          </div>
        </template>
      </section>

      <section class="mt-7" aria-label="Listening flow">
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div class="text-xs text-muted">
            {{ PERIOD_LABELS[data.bucket] }} · {{ formatDate(data.from) }} – {{ formatDate(data.to) }}
            <span v-if="loading" class="ml-3" role="status">Updating…</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <div class="flex gap-1 rounded-full border border-line p-1" role="group" aria-label="Stream appearance">
              <button class="flow-pill" :aria-pressed="artwork" @click="artwork = true">Artwork</button>
              <button class="flow-pill" :aria-pressed="!artwork" @click="artwork = false">Colors</button>
            </div>
            <button v-if="other" class="flow-button" :aria-pressed="includeOther" @click="toggleOther">
              {{ includeOther ? "Hide other" : "Include other" }}
            </button>
            <template v-if="zooms.length">
              <button class="flow-button" :disabled="loading" @click="zoomOut">Back</button>
              <button class="flow-button" :disabled="loading" @click="resetZoom">Reset zoom</button>
            </template>
            <button class="flow-button" :aria-expanded="datesOpen" @click="toggleDates">Choose dates</button>
          </div>
        </div>

        <form v-if="datesOpen" class="mb-5 flex flex-wrap items-end gap-3 rounded-lg bg-surface p-4" @submit.prevent="applyDates">
          <label class="text-xs text-muted">From<input v-model="fromDate" type="date" required class="mt-1 block rounded border border-line bg-surface-2 p-2 text-text" /></label>
          <label class="text-xs text-muted">To<input v-model="toDate" type="date" required class="mt-1 block rounded border border-line bg-surface-2 p-2 text-text" /></label>
          <button class="flow-button" type="submit">Explore period</button>
          <p v-if="dateError" role="alert" class="w-full text-sm text-muted">{{ dateError }}</p>
        </form>

        <FlowStream
          v-if="plotted"
          :flow="plotted"
          :metric="metric"
          :colors="colors"
          :artwork="artwork"
          :selected="selected"
          :busy="loading"
          @select="select"
          @zoom="zoomTo"
        />
        <p v-if="other && !includeOther" class="mt-3 text-xs text-muted">
          Showing the top {{ topSeries.length }} {{ groupLabel }}. Other listening ({{ amount(total(other)) }}) is excluded from the graph scale.
        </p>
        <div class="mt-5 flex flex-wrap justify-between gap-2 border-b border-line/50 pb-5 text-[11px] text-faint">
          <span>Drag to explore a period. Tap a cover to follow its stream.</span>
          <span>
            {{ amount(metric === "time" ? data.totalSeconds : data.totalPlays) }} · {{ topSeries.length }} {{ groupLabel }}<template v-if="other"> + other</template>
          </span>
        </div>
      </section>

      <div class="mt-5 flex gap-3 overflow-x-auto pb-4" :aria-label="`${GROUP_LABELS[group]} in this period`">
        <button
          v-for="series in plotted?.series ?? []"
          :key="series.id"
          class="flow-cover flex w-28 flex-none flex-col text-left sm:w-32"
          :class="{ 'opacity-45': selected && selected !== series.id }"
          :aria-pressed="selected === series.id"
          :disabled="loading"
          @click="select(series.id)"
        >
          <div class="relative w-full">
            <CoverArt :id="series.coverArt" :name="name(series)" :size="160" class="w-full" />
            <span class="absolute bottom-0 left-0 right-0 h-1 rounded-b-lg" :style="{ background: color(series.id) }" />
            <span v-if="selected === series.id" class="absolute right-1.5 top-1.5 rounded-full bg-bg px-2 py-0.5 text-xs text-text">✓</span>
          </div>
          <span class="mt-2 w-full truncate text-xs font-bold" :title="name(series)">{{ name(series) }}</span>
          <span class="mt-1 text-[11px] text-faint">{{ amount(total(series)) }}</span>
        </button>
      </div>

      <p class="mt-2 max-w-[75ch] text-[11px] text-faint">
        Stream thickness shows {{ metric === "plays" ? "plays" : "listening time" }} in each {{ data.bucket }}.
        <template v-if="data.unassignedPlays">
          {{ formatNumber(data.unassignedPlays) }} plays {{ group === "genre" ? "have no genre tag" : "could not be matched to this grouping" }}.
        </template>
        <template v-if="group === 'genre'">Genres come from your library tags.</template>
      </p>
    </div>
  </div>
</template>

<style scoped>
.flow-feature { background: var(--color-surface); }
.feature-art { opacity: 0.65; }
.feature-shade {
  background: linear-gradient(90deg,
    var(--color-surface) 8%,
    color-mix(in oklch, var(--color-surface) 94%, transparent) 30%,
    color-mix(in oklch, var(--color-surface) 22%, transparent) 100%);
}
.flow-button { border: 1px solid var(--color-line); border-radius: 7px; padding: 6px 11px; font-size: 12px; font-weight: 600; color: var(--color-muted); }
.flow-button:hover { color: var(--color-text); background: var(--color-surface); }
.flow-tab { padding: 9px 14px; font-size: 14px; font-weight: 700; color: var(--color-muted); border-radius: 8px; }
.flow-tab[aria-pressed="true"] { color: var(--accent); background: var(--accent-soft); }
.flow-pill { border-radius: 99px; padding: 6px 12px; font-size: 12px; font-weight: 600; color: var(--color-muted); }
.flow-pill[aria-pressed="true"] { background: var(--accent); color: var(--color-ink); }
.flow-cover { transition: opacity 180ms ease-out; }
.flow-cover:hover { opacity: 1; }
button:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
button:disabled { opacity: 0.5; cursor: wait; }
@media (prefers-reduced-motion: reduce) { .flow-cover { transition: none; } }
</style>
