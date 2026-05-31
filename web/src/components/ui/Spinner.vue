<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 36 });
</script>

<template>
  <div class="animate-spin rounded-full border-2 border-line"
    :style="{ width: size + 'px', height: size + 'px', borderTopColor: 'var(--accent)' }" />
</template>
