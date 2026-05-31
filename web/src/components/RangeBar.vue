<script setup lang="ts">
import { useRangeStore } from "@/stores/range";
import type { Range } from "@/api/types";
const store = useRangeStore();
const ranges: { value: Range; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "year", label: "Year" },
  { value: "all", label: "All time" },
];
</script>

<template>
  <div class="flex items-center gap-2.5">
    <span class="label hidden sm:inline" style="font-size:11px">Range</span>
    <div class="inline-flex rounded-full border border-line bg-surface p-1">
      <button
        v-for="r in ranges" :key="r.value" @click="store.setRange(r.value)"
        class="rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200"
        :class="store.range === r.value
          ? 'text-[oklch(0.22_0.03_55)] shadow-sm'
          : 'text-muted hover:text-text hover:bg-surface-2'"
        :style="store.range === r.value ? { background: 'var(--accent)' } : {}"
      >{{ r.label }}</button>
    </div>
  </div>
</template>
