import { computed, onMounted, ref, type ComputedRef, type Ref } from "vue";
import { api } from "@/api/client";
import type { TimePoint } from "@/api/types";
import { DAY_MS, dateFromDayBucket, dayKey, dayKeyFromDayBucket, monthKey, startOfDay } from "@/lib/calendar";
import { createHeatScale, playsByMonth, playsByYear, type DailyStats, type HeatScale } from "@/lib/heatmap";

export interface YearTotal { year: number; plays: number }

export interface DailyHistory {
  daily: Ref<DailyStats>;
  dataStart: Ref<Date>;
  years: ComputedRef<YearTotal[]>;
  dayHeat: ComputedRef<HeatScale>;
  monthHeat: ComputedRef<HeatScale>;
  yearHeat: ComputedRef<HeatScale>;
  playsOn: (date: Date) => number;
  playsInMonth: (year: number, month: number) => number;
}

let pending: Promise<TimePoint[]> | null = null;

function loadSeries(): Promise<TimePoint[]> {
  return (pending ??= api.timeseries({ range: "all", bucket: "day" }));
}

export function useDailyHistory(today: Date): DailyHistory {
  const daily = ref<DailyStats>(new Map());
  const dataStart = ref(startOfDay(new Date(today.getTime() - 365 * DAY_MS)));

  onMounted(async () => {
    const series = await loadSeries();
    const stats: DailyStats = new Map();
    let earliest: Date | null = null;
    for (const point of series) {
      stats.set(dayKeyFromDayBucket(point.bucket), { plays: point.plays, seconds: point.seconds });
      const day = dateFromDayBucket(point.bucket);
      if (!earliest || day < earliest) earliest = day;
    }
    daily.value = stats;
    if (earliest) dataStart.value = earliest;
  });

  const monthly = computed(() => playsByMonth(daily.value));
  const yearly = computed(() => playsByYear(monthly.value));

  const years = computed<YearTotal[]>(() => {
    const out: YearTotal[] = [];
    for (let year = dataStart.value.getFullYear(); year <= today.getFullYear(); year++) {
      out.push({ year, plays: yearly.value.get(year) ?? 0 });
    }
    return out;
  });

  const dayHeat = computed(() =>
    createHeatScale([...daily.value.values()].map((stat) => stat.plays), { percentile: 0.95, empty: 0, base: 0.14, span: 0.6 }),
  );
  const monthHeat = computed(() =>
    createHeatScale(monthly.value.values(), { percentile: 0.9, empty: 0.05, base: 0.18, span: 0.62 }),
  );
  const yearHeat = computed(() =>
    createHeatScale(yearly.value.values(), { percentile: 0.9, empty: 0.05, base: 0.2, span: 0.6 }),
  );

  return {
    daily,
    dataStart,
    years,
    dayHeat,
    monthHeat,
    yearHeat,
    playsOn: (date) => daily.value.get(dayKey(date))?.plays ?? 0,
    playsInMonth: (year, month) => monthly.value.get(monthKey(year, month)) ?? 0,
  };
}
