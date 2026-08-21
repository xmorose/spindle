<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { coverUrl } from "@/api/client";

const props = withDefaults(
  defineProps<{ id: string | null; name?: string; size?: number; srcOverride?: string | null }>(),
  { size: 300, name: "" },
);
const failed = ref(false);
const loaded = ref(false);
const img = ref<HTMLImageElement | null>(null);

let gen = 0;
let raf1 = 0;
let raf2 = 0;

function clearFrames() {
  cancelAnimationFrame(raf1);
  cancelAnimationFrame(raf2);
}

function reveal(forGen: number) {
  if (forGen === gen) loaded.value = true;
}

function syncCached() {
  const el = img.value;
  if (!el || !el.complete || el.naturalWidth === 0) return;
  const mine = gen;
  clearFrames();
  raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(() => reveal(mine));
  });
}

onMounted(syncCached);
watch(() => [props.id, props.srcOverride], () => {
  gen++;
  clearFrames();
  failed.value = false;
  loaded.value = false;
  void nextTick(syncCached);
});
onBeforeUnmount(clearFrames);

const src = computed(() => {
  if (props.srcOverride !== undefined) {
    return props.srcOverride && !failed.value ? props.srcOverride : null;
  }
  return props.id && !failed.value ? coverUrl(props.id, props.size) : null;
});
const initial = computed(() => (props.name?.trim()?.[0] ?? "·").toUpperCase());
</script>

<template>
  <div class="grid place-items-center overflow-hidden rounded-lg bg-surface-2" :style="{ aspectRatio: '1' }">
    <img
      v-if="src" ref="img" :src="src" :alt="name" class="art-img h-full w-full object-cover" :class="{ ready: loaded }"
      loading="lazy" decoding="async" @load="loaded = true" @error="failed = true"
    />
    <span v-else class="text-muted font-bold">{{ initial }}</span>
  </div>
</template>

<style scoped>
.art-img {
  opacity: 0;
  transform: scale(1.04);
  transition: opacity 420ms var(--ease-out-quint), transform 620ms var(--ease-out-quint);
}
.art-img.ready { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .art-img { transition: none; opacity: 1; transform: none; }
}
</style>
