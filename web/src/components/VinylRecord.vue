<script setup lang="ts">
import CoverArt from "@/components/CoverArt.vue";

defineProps<{ id: string | null; name?: string; playing?: boolean; srcOverride?: string | null }>();
</script>

<template>
  <div class="vinyl relative aspect-square" :class="{ 'is-spinning': playing }">
    <div class="vinyl-disc absolute inset-0 rounded-full"></div>
    <CoverArt :id="id" :name="name" :src-override="srcOverride" :size="80" class="absolute inset-[28%] !rounded-full ring-1 ring-black/40" />
    <div class="absolute left-1/2 top-1/2 h-[9%] w-[9%] -translate-x-1/2 -translate-y-1/2 rounded-full" :style="{ background: 'var(--color-bg)' }"></div>
  </div>
</template>

<style scoped>
.vinyl { animation: vinyl-rotate 4s linear infinite; animation-play-state: paused; }
.vinyl.is-spinning { animation-play-state: running; }
.vinyl-disc {
  background: repeating-radial-gradient(circle at center, oklch(0.17 0.01 60) 0 1.2px, oklch(0.10 0.008 60) 1.2px 2.4px);
  box-shadow: inset 0 0 0 1px oklch(1 0 0 / 0.05);
}
@media (prefers-reduced-motion: reduce) { .vinyl { animation: none; } }
</style>
