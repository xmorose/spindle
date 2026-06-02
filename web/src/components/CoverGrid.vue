<script setup lang="ts">
import CoverArt from "./CoverArt.vue";

export interface CoverItem {
  id: string; title: string; subtitle?: string; value?: string; coverId: string | null; to: string;
}
defineProps<{ items: CoverItem[] }>();
</script>

<template>
  <div v-if="items.length" class="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
    <RouterLink v-for="it in items" :key="it.id" :to="it.to" data-tile class="group">
      <CoverArt :id="it.coverId" :name="it.title" :size="300" class="w-full transition duration-300 ease-out group-hover:-translate-y-1.5 group-hover:shadow-[0_16px_44px_-12px_var(--accent-soft)]" />
      <div class="mt-2 truncate text-sm font-semibold group-hover:text-text">{{ it.title }}</div>
      <div v-if="it.subtitle" class="truncate text-xs text-faint">{{ it.subtitle }}</div>
      <div v-if="it.value" class="tabular mt-0.5 text-xs text-muted">{{ it.value }}</div>
    </RouterLink>
  </div>
  <div v-else class="py-16 text-center text-sm text-faint">Nothing here yet.</div>
</template>
