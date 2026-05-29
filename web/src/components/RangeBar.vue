<script setup lang="ts">
import { useRangeStore } from "@/stores/range";
import type { Range } from "@/api/types";
const store = useRangeStore();
const ranges: { value: Range; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "year", label: "Year" },
  { value: "all", label: "All" },
];
</script>

<template>
  <div class="flex gap-1">
    <button
      v-for="r in ranges" :key="r.value" @click="store.setRange(r.value)"
      class="rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors"
      :class="store.range === r.value ? 'text-[oklch(0.20_0.03_50)]' : 'text-muted hover:text-text'"
      :style="store.range === r.value ? { background: 'var(--accent)' } : {}"
    >{{ r.label }}</button>
  </div>
</template>
