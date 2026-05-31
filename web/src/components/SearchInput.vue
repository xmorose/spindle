<script setup lang="ts">
defineProps<{ modelValue: string; placeholder?: string }>();
defineEmits<{ (e: "update:modelValue", v: string): void }>();
</script>

<template>
  <input
    :value="modelValue"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    :placeholder="placeholder ?? 'Search…'"
    type="search"
    class="w-full max-w-xs rounded-lg border border-line bg-surface px-3.5 py-2 text-sm text-text outline-none transition-colors duration-150 placeholder:text-faint focus:border-[var(--accent)]"
  />
</template>
