<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";

const props = withDefaults(
  defineProps<{ value: number; format?: (n: number) => string; duration?: number }>(),
  { duration: 1400 },
);

const armed = ref(false);
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const chars = computed(() => {
  const text = props.format ? props.format(props.value) : String(props.value);
  return [...text].map((ch, i) => ({ ch, i, digit: ch >= "0" && ch <= "9" ? Number(ch) : null }));
});

const reduce = typeof matchMedia === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches;
onMounted(() => { if (reduce) armed.value = true; else requestAnimationFrame(() => { armed.value = true; }); });
watch(() => props.value, () => {
  if (reduce) return;
  armed.value = false;
  requestAnimationFrame(() => { armed.value = true; });
});
</script>

<template>
  <span class="tabular inline-flex items-baseline">
    <span v-for="c in chars" :key="c.i" aria-hidden="true">
      <span v-if="c.digit === null">{{ c.ch }}</span>
      <span v-else class="digit">
        <span class="reel" :style="{
          transform: `translateY(${armed ? -c.digit : 0}em)`,
          transitionDuration: reduce ? '0ms' : duration + 'ms',
          transitionDelay: reduce ? '0ms' : c.i * 70 + 'ms',
        }">
          <span v-for="d in DIGITS" :key="d" class="cell">{{ d }}</span>
        </span>
      </span>
    </span>
    <span class="sr-only">{{ format ? format(value) : value }}</span>
  </span>
</template>

<style scoped>
.digit {
  display: inline-block;
  overflow: hidden;
  height: 1em;
  line-height: 1;
  vertical-align: baseline;
}
.reel {
  display: block;
  transition-property: transform;
  transition-timing-function: var(--ease-out-quint);
  will-change: transform;
}
.cell { display: block; height: 1em; line-height: 1; }
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
</style>
