<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ hours: number[] }>();
const CX = 100, CY = 100, INNER = 40, MAXLEN = 52;
const max = computed(() => Math.max(...props.hours, 1));

const spokes = computed(() =>
  props.hours.map((v, h) => {
    const a = (h / 24) * 2 * Math.PI - Math.PI / 2;
    const len = 4 + (v / max.value) * MAXLEN;
    const cos = Math.cos(a), sin = Math.sin(a);
    return {
      x1: CX + cos * INNER, y1: CY + sin * INNER,
      x2: CX + cos * (INNER + len), y2: CY + sin * (INNER + len),
      opacity: (0.28 + 0.72 * (v / max.value)).toFixed(2),
    };
  }),
);
const labels = [0, 6, 12, 18].map((hh, i) => {
  const a = ((i * 6) / 24) * 2 * Math.PI - Math.PI / 2;
  const r = INNER + MAXLEN + 13;
  return { t: String(hh).padStart(2, "0"), x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r + 3 };
});
</script>

<template>
  <svg viewBox="0 0 200 200" class="block">
    <circle :cx="CX" :cy="CY" :r="INNER - 4" fill="none" stroke="var(--color-line)" stroke-width="1" />
    <circle class="spindle" :cx="CX" :cy="CY" r="3.5" fill="var(--accent)" />
    <line v-for="(s, i) in spokes" :key="i" class="spoke"
      :x1="s.x1" :y1="s.y1" :x2="s.x2" :y2="s.y2"
      stroke="var(--accent)" :stroke-opacity="s.opacity" stroke-width="4.5" stroke-linecap="round" />
    <text v-for="(l, i) in labels" :key="i" :x="l.x" :y="l.y"
      fill="var(--color-faint)" font-size="9" font-weight="700" text-anchor="middle">{{ l.t }}</text>
  </svg>
</template>
