<script setup lang="ts">
import { coverUrl } from "@/api/client";

withDefaults(defineProps<{ id: string | null; tint?: number }>(), { tint: 0.5 });
</script>

<template>
  <div class="absolute inset-0 overflow-hidden" aria-hidden="true">
    <div class="field absolute inset-[-12%]">
      <div class="blob blob-1" />
      <div class="blob blob-2" />
      <div class="blob blob-3" />
      <img v-if="id" :src="coverUrl(id, 200)" alt=""
        class="absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-[64px] saturate-[1.7]" />
    </div>
    <div class="absolute inset-0"
      :style="{ background: `linear-gradient(180deg, oklch(0.14 0.02 50 / ${tint * 0.5}) 0%, oklch(0.13 0.02 50 / ${tint}) 100%)` }" />
  </div>
</template>

<style scoped>
.field {
  transform: translate3d(0, calc(var(--p, 0) * 55px), 0);
  will-change: transform;
}
.blob {
  position: absolute;
  border-radius: 50%;
  opacity: 0.55;
  will-change: transform;
}
.blob-1 {
  width: 130%; height: 145%; left: -35%; top: -45%;
  background: radial-gradient(circle at center, var(--accent-2) 0%, transparent 58%);
  animation: float-1 38s ease-in-out infinite alternate;
}
.blob-2 {
  width: 120%; height: 135%; right: -35%; top: -30%;
  background: radial-gradient(circle at center, var(--accent-3) 0%, transparent 58%);
  animation: float-2 47s ease-in-out infinite alternate;
}
.blob-3 {
  width: 150%; height: 140%; left: -20%; bottom: -55%;
  background: radial-gradient(circle at center, var(--accent) 0%, transparent 56%);
  animation: float-3 43s ease-in-out infinite alternate;
}
@keyframes float-1 {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to   { transform: translate3d(5%, 3%, 0) scale(1.07); }
}
@keyframes float-2 {
  from { transform: translate3d(0, 0, 0) scale(1.05); }
  to   { transform: translate3d(-6%, 4%, 0) scale(0.98); }
}
@keyframes float-3 {
  from { transform: translate3d(0, 0, 0) scale(1.02); }
  to   { transform: translate3d(4%, -5%, 0) scale(1.09); }
}

@media (prefers-reduced-motion: reduce) {
  .field { transform: none; }
  .blob { animation: none; }
}
</style>
