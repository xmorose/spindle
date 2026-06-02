<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue";

const props = withDefaults(
  defineProps<{ value: number; format?: (n: number) => string; duration?: number }>(),
  { duration: 900 },
);

const shown = ref(props.value);
let raf = 0;
const reduce = typeof matchMedia === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches;
const canRaf = typeof requestAnimationFrame === "function";

function animateTo(to: number) {
  if (raf) cancelAnimationFrame(raf);
  if (reduce || !canRaf || props.duration <= 0) { shown.value = to; return; }
  const from = shown.value;
  let start = 0;
  const step = (t: number) => {
    if (!start) start = t;
    const p = Math.min(1, (t - start) / props.duration);
    const eased = 1 - Math.pow(1 - p, 5);
    shown.value = from + (to - from) * eased;
    raf = p < 1 ? requestAnimationFrame(step) : 0;
    if (p >= 1) shown.value = to;
  };
  raf = requestAnimationFrame(step);
}

watch(() => props.value, (v) => animateTo(v), { immediate: true });
onUnmounted(() => { if (raf) cancelAnimationFrame(raf); });
</script>

<template>
  <span class="tabular">{{ format ? format(Math.round(shown)) : Math.round(shown) }}</span>
</template>
