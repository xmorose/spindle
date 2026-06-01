<script setup lang="ts">
import { computed } from "vue";
import { api } from "@/api/client";
import { useRangedResource } from "@/composables/useRangedResource";
import { hourlyFromHeatmap, peakHour } from "@/lib/stats";
import Heatmap from "@/components/charts/Heatmap.vue";
import RadialClock from "@/components/charts/RadialClock.vue";
import EmptyState from "@/components/ui/EmptyState.vue";

const res = useRangedResource((range) => api.heatmap({ range }));
const cells = computed(() => res.data.value ?? []);
const hourly = computed(() => hourlyFromHeatmap(cells.value));
const peak = computed(() => peakHour(hourly.value));
const isEmpty = computed(() => !res.loading.value && cells.value.length === 0);
</script>

<template>
  <div class="py-2 rise">
    <h1 class="mb-6 text-2xl font-extrabold tracking-tight">Pulse</h1>

    <EmptyState v-if="isEmpty" title="No listening pattern yet"
      hint="Pulse needs live plays with real timestamps. It fills in as Spindle tracks your listening." />

    <template v-else>
      <section class="mb-10">
        <div class="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">By hour &amp; weekday</div>
        <Heatmap :cells="cells" />
      </section>
      <section>
        <div class="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Listening clock</div>
        <div class="flex items-center gap-6">
          <RadialClock :hours="hourly" class="h-[200px] w-[200px] flex-none" />
          <div>
            <div class="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Peak listening</div>
            <div class="tabular text-3xl font-extrabold">{{ String(peak).padStart(2, "0") }}:00</div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
