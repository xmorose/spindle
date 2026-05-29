<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { coverUrl } from "@/api/client";

const props = withDefaults(defineProps<{ id: string | null; name?: string; size?: number }>(), { size: 300, name: "" });
const failed = ref(false);
watch(() => props.id, () => { failed.value = false; });

const src = computed(() => (props.id && !failed.value ? coverUrl(props.id, props.size) : null));
const initial = computed(() => (props.name?.trim()?.[0] ?? "·").toUpperCase());
</script>

<template>
  <div class="grid place-items-center overflow-hidden rounded-lg bg-surface-2" :style="{ aspectRatio: '1' }">
    <img v-if="src" :src="src" :alt="name" class="h-full w-full object-cover" loading="lazy" @error="failed = true" />
    <span v-else class="text-muted font-bold">{{ initial }}</span>
  </div>
</template>
