<script setup lang="ts">
defineProps<{ label: string; value: string; sub?: string }>();
</script>

<template>
  <div class="rounded-xl border border-line/60 bg-surface px-4 py-3.5">
    <div class="text-[9px] font-semibold uppercase tracking-wider text-faint">{{ label }}</div>
    <div class="tabular mt-1.5 text-2xl font-extrabold">{{ value }}</div>
    <div v-if="sub" class="mt-0.5 text-[11px] text-muted">{{ sub }}</div>
  </div>
</template>
