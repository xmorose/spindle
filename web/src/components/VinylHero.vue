<script setup lang="ts">
import { ref, computed } from "vue";
import CoverArt from "@/components/CoverArt.vue";

const props = withDefaults(defineProps<{ id: string | null; name?: string; size?: number }>(), { size: 900 });

const el = ref<HTMLElement | null>(null);
const tilt = ref({ x: 0, y: 0 });
const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function onMove(e: PointerEvent) {
  if (reduce || e.pointerType !== "mouse" || !el.value) return;
  const r = el.value.getBoundingClientRect();
  tilt.value = {
    y: ((e.clientX - r.left) / r.width - 0.5) * 16,
    x: -((e.clientY - r.top) / r.height - 0.5) * 16,
  };
}
function onLeave() { tilt.value = { x: 0, y: 0 }; }

const stackStyle = computed(() => ({
  transform: `perspective(1100px) rotateX(${tilt.value.x.toFixed(2)}deg) rotateY(${tilt.value.y.toFixed(2)}deg)`,
}));
</script>

<template>
  <div ref="el" class="relative aspect-square select-none" @pointermove="onMove" @pointerleave="onLeave">
    <div class="stack absolute inset-0" :style="stackStyle">
      <div class="disc-wrap absolute right-0 top-1/2 h-[86%] w-[86%] -translate-y-1/2 translate-x-[30%]">
        <div class="disc absolute inset-0 rounded-full">
          <div class="absolute inset-[34%] rounded-full opacity-80" :style="{ background: 'var(--accent)' }" />
          <div class="absolute left-1/2 top-1/2 h-[7%] w-[7%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            :style="{ background: 'var(--color-bg)' }" />
        </div>
      </div>
      <CoverArt :id="id" :name="name" :size="size"
        class="sleeve absolute inset-0 !rounded-xl shadow-[0_36px_100px_-28px_oklch(0.06_0.02_40/0.95)]" />
    </div>
  </div>
</template>

<style scoped>
.stack {
  transform-style: preserve-3d;
  transition: transform 400ms var(--ease-out-quint);
}
.disc-wrap { animation: vinyl-rotate 14s linear infinite; }
.disc {
  background:
    repeating-radial-gradient(circle at center, oklch(0.19 0.01 60) 0 1.5px, oklch(0.10 0.008 60) 1.5px 3px);
  box-shadow: inset 0 0 0 1px oklch(1 0 0 / 0.06), 0 24px 70px -20px oklch(0.06 0.02 40 / 0.9);
}
@media (prefers-reduced-motion: reduce) {
  .stack { transition: none; }
  .disc-wrap { animation: none; }
}
</style>
