<script setup lang="ts">
import Skeleton from "./Skeleton.vue";

withDefaults(defineProps<{ count?: number }>(), { count: 10 });

function titleWidth(i: number) { return `${48 + ((i * 19) % 40)}%`; }
</script>

<template>
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
    <div v-for="i in count" :key="i">
      <Skeleton class="aspect-square w-full rounded-lg" />
      <Skeleton class="mt-2 h-3" :style="{ width: titleWidth(i) }" />
      <Skeleton class="mt-1.5 h-2.5 w-1/3" />
    </div>
  </div>
</template>
