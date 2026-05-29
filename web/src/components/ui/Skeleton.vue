<script setup lang="ts">
defineProps<{ class?: string }>();
</script>

<template>
  <div class="animate-pulse rounded-md bg-surface-2" :class="$props.class" />
</template>
