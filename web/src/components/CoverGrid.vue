<script setup lang="ts">
import CoverArt from "./CoverArt.vue";

export interface CoverItem {
  id: string; title: string; subtitle?: string; value?: string; coverId: string | null; to: string; artistId?: string | null;
}
withDefaults(
  defineProps<{ items: CoverItem[]; playable?: boolean; shareable?: boolean; busyId?: string | null }>(),
  { playable: false, shareable: false, busyId: null },
);
const emit = defineEmits<{ play: [item: CoverItem]; share: [item: CoverItem] }>();
</script>

<template>
  <div v-if="items.length" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
    <div v-for="it in items" :key="it.id" data-tile class="group">
      <div class="relative">
        <RouterLink :to="it.to" class="block">
          <CoverArt :id="it.coverId" :name="it.title" :size="300" class="w-full transition duration-300 ease-out group-hover:-translate-y-1.5 group-hover:shadow-[0_16px_44px_-12px_var(--accent-soft)]" />
        </RouterLink>
        <button
          v-if="playable"
          class="absolute bottom-2 left-2 grid h-9 w-9 place-items-center rounded-full text-[color:var(--color-bg)] shadow-lg transition-transform hover:scale-105 active:scale-95"
          :style="{ background: 'var(--accent)' }" @click.stop="emit('play', it)" aria-label="Play"
        >
          <svg v-if="busyId === it.id" viewBox="0 0 24 24" class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke-opacity="0.3" /><path d="M21 12a9 9 0 0 0-9-9" /></svg>
          <svg v-else viewBox="0 0 24 24" class="h-4 w-4 translate-x-px" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
        </button>
        <button
          v-if="shareable"
          class="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75"
          @click.stop="emit('share', it)" aria-label="Teilen"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" /></svg>
        </button>
      </div>
      <RouterLink :to="it.to" class="mt-2 block truncate text-sm font-semibold group-hover:text-text">{{ it.title }}</RouterLink>
      <RouterLink v-if="it.subtitle && it.artistId" :to="`/artists/${it.artistId}`" class="block truncate text-xs text-faint transition-colors hover:text-text hover:underline">{{ it.subtitle }}</RouterLink>
      <div v-else-if="it.subtitle" class="truncate text-xs text-faint">{{ it.subtitle }}</div>
      <div v-if="it.value" class="tabular mt-0.5 text-xs text-muted">{{ it.value }}</div>
    </div>
  </div>
  <div v-else class="py-16 text-center text-sm text-faint">Nothing here yet.</div>
</template>
