<script setup lang="ts">
import { computed } from "vue";
import { api } from "@/api/client";
import { useRangedResource } from "@/composables/useRangedResource";
import { hourlyFromHeatmap, peakHour, quietHour, dayParts, weekdayFromHeatmap, streaks } from "@/lib/stats";
import { formatNumber, formatDuration } from "@/lib/format";
import Heatmap from "@/components/charts/Heatmap.vue";
import RadialClock from "@/components/charts/RadialClock.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import Skeleton from "@/components/ui/Skeleton.vue";

const heat = useRangedResource((p) => api.heatmap(p));
const series = useRangedResource((p) => api.timeseries({ ...p, bucket: "day" }));
const sessions = useRangedResource((p) => api.sessions({ ...p, limit: 200 }));

const cells = computed(() => heat.data.value ?? []);
const hourly = computed(() => hourlyFromHeatmap(cells.value));
const peak = computed(() => peakHour(hourly.value));
const quiet = computed(() => quietHour(hourly.value));
const parts = computed(() => dayParts(hourly.value));
const topPart = computed(() => parts.value.reduce((a, b) => (b.plays > a.plays ? b : a), parts.value[0]));

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const weekday = computed(() => weekdayFromHeatmap(cells.value));
const weekdayMax = computed(() => Math.max(1, ...weekday.value));
const busiestDay = computed(() => weekday.value.indexOf(Math.max(...weekday.value)));

const weekendShare = computed(() => {
  const total = weekday.value.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  return (weekday.value[0] + weekday.value[6]) / total;
});

const dailyValues = computed(() => (series.data.value ?? []).map((p) => p.plays));
const streak = computed(() => streaks(dailyValues.value));

const sessionList = computed(() => sessions.data.value ?? []);
const avgSession = computed(() => {
  const s = sessionList.value;
  if (!s.length) return 0;
  return Math.round(s.reduce((a, x) => a + x.seconds, 0) / s.length);
});
const longestSession = computed(() => Math.max(0, ...sessionList.value.map((s) => s.seconds)));

const firstLoad = computed(() => heat.loading.value && heat.data.value === null);
const isEmpty = computed(() => !heat.loading.value && cells.value.length === 0);
const hh = (n: number) => String(n).padStart(2, "0") + ":00";
</script>

<template>
  <div class="pb-2">
    <h1 class="mb-8 text-3xl font-black tracking-tight">Pulse</h1>

    <div v-if="firstLoad" class="flex flex-col gap-14">
      <div class="flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-16">
        <Skeleton class="aspect-square w-[260px] flex-none rounded-full" />
        <div class="flex-1">
          <Skeleton class="h-16 w-52" />
          <Skeleton class="mt-4 h-3 w-64 max-w-full" />
          <div class="mt-8 flex flex-col gap-3">
            <Skeleton v-for="i in 4" :key="i" class="h-8 w-full" />
          </div>
        </div>
      </div>
      <Skeleton class="h-[180px] w-full rounded-2xl" />
    </div>

    <EmptyState v-else-if="isEmpty" title="No listening pattern yet"
      hint="Pulse needs live plays with real timestamps. It fills in as Spindle tracks your listening." />

    <div v-else class="stagger flex flex-col gap-16">
      <section class="flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-16">
        <RadialClock :hours="hourly" :label-step="3" :peak="peak" class="w-[240px] flex-none self-center sm:w-[280px] lg:self-auto" />

        <div class="min-w-0 flex-1">
          <div class="label">Peak listening</div>
          <div class="tabular mt-2 text-6xl font-black leading-[0.85] tracking-tight sm:text-7xl" :style="{ color: 'var(--accent)' }">{{ hh(peak) }}</div>
          <p class="mt-4 max-w-[42ch] text-sm text-muted">
            Most of your listening lands in the {{ topPart.label.toLowerCase() }}. Your quietest hour is {{ hh(quiet) }}.
          </p>

          <div class="mt-8 flex flex-col gap-3">
            <div v-for="p in parts" :key="p.key" class="flex items-center gap-4">
              <span class="label-sm w-20 flex-none">{{ p.label }}</span>
              <div class="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div class="part-bar h-full rounded-full" :style="{ width: (p.share * 100).toFixed(1) + '%', background: 'var(--accent)', opacity: p.key === topPart.key ? 1 : 0.45 }" />
              </div>
              <span class="tabular w-12 flex-none text-right text-[12px] font-semibold" :class="p.key === topPart.key ? 'text-text' : 'text-faint'">{{ Math.round(p.share * 100) }}%</span>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div class="label mb-1">Across the week</div>
        <p class="mb-6 text-sm text-faint">
          {{ DAYS[busiestDay] }} is your heaviest day. {{ Math.round(weekendShare * 100) }}% of your plays happen on the weekend.
        </p>
        <div class="flex items-end gap-2 sm:gap-3">
          <div v-for="(v, d) in weekday" :key="d" class="flex min-w-0 flex-1 flex-col items-center gap-2">
            <span class="tabular text-[11px] font-bold" :class="d === busiestDay ? 'text-text' : 'text-faint'">{{ formatNumber(v) }}</span>
            <div class="w-full rounded-t-md rounded-b-sm transition-[height] duration-700 ease-out motion-reduce:transition-none"
              :style="{ height: Math.max(4, (v / weekdayMax) * 132) + 'px', background: 'var(--accent)', opacity: d === busiestDay ? 1 : 0.4 }" />
            <span class="label-sm">{{ DAYS[d].slice(0, 3) }}</span>
          </div>
        </div>
      </section>

      <section>
        <div class="label mb-5">Habit</div>
        <div class="flex flex-wrap items-end gap-x-12 gap-y-7 border-y border-line/50 py-6">
          <div>
            <div class="tabular text-4xl font-black leading-none tracking-tight" :style="{ color: 'var(--accent)' }">{{ streak.current }}</div>
            <div class="label-sm mt-2.5">Day streak</div>
          </div>
          <div>
            <div class="tabular text-2xl font-black leading-none tracking-tight">{{ streak.longest }}</div>
            <div class="label-sm mt-2.5">Longest streak</div>
          </div>
          <div>
            <div class="tabular text-2xl font-black leading-none tracking-tight">{{ streak.activeDays }}<span class="text-faint">/{{ streak.totalDays }}</span></div>
            <div class="label-sm mt-2.5">Days with plays</div>
          </div>
          <div class="flex gap-12 sm:border-l sm:border-line/60 sm:pl-12">
            <div>
              <div class="tabular text-2xl font-black leading-none tracking-tight">{{ formatDuration(avgSession) }}</div>
              <div class="label-sm mt-2.5">Typical session</div>
            </div>
            <div>
              <div class="tabular text-2xl font-black leading-none tracking-tight">{{ formatDuration(longestSession) }}</div>
              <div class="label-sm mt-2.5">Longest session</div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div class="label mb-1">Hour by hour</div>
        <p class="mb-6 text-sm text-faint">Every hour of every weekday in this range, shaded by how much you played.</p>
        <div class="overflow-x-auto pb-1">
          <Heatmap :cells="cells" />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.part-bar { transition: width 700ms var(--ease-out-quint); }
@media (prefers-reduced-motion: reduce) { .part-bar { transition: none; } }
</style>
