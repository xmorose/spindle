<script setup lang="ts">
defineProps<{ title: string; hint?: string }>();
</script>

<template>
  <div class="grid place-items-center rounded-xl border border-line/60 px-6 py-14 text-center">
    <div>
      <p class="text-sm font-semibold text-muted">{{ title }}</p>
      <p v-if="hint" class="mx-auto mt-1.5 max-w-[40ch] text-xs text-faint">{{ hint }}</p>
    </div>
  </div>
</template>
