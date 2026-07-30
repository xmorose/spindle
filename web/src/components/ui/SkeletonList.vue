<script setup lang="ts">
import Skeleton from "./Skeleton.vue";

withDefaults(defineProps<{ rows?: number; bar?: boolean }>(), { rows: 10, bar: true });

function titleWidth(i: number) { return `${34 + ((i * 23) % 28)}%`; }
function subWidth(i: number) { return `${18 + ((i * 31) % 16)}%`; }
</script>

<template>
  <div class="flex flex-col gap-0.5">
    <div v-for="i in rows" :key="i" class="flex items-center gap-3 px-2 py-2">
      <Skeleton class="h-3 w-5 flex-none" />
      <Skeleton class="h-9 w-9 flex-none rounded-lg" />
      <div class="min-w-0 flex-1">
        <Skeleton class="h-3 max-w-[260px]" :style="{ width: titleWidth(i) }" />
        <Skeleton class="mt-1.5 h-2.5 max-w-[150px]" :style="{ width: subWidth(i) }" />
        <Skeleton v-if="bar" class="mt-2 h-1 w-full" />
      </div>
      <Skeleton class="h-3 w-10 flex-none" />
    </div>
  </div>
</template>
