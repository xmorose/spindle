<script setup lang="ts">
import { shareToast } from "@/composables/useShare";
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="shareToast"
        class="fixed bottom-28 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 truncate rounded-full border border-line px-4 py-2 text-sm font-semibold shadow-xl backdrop-blur"
        :class="shareToast.tone === 'error' ? 'bg-surface text-text' : 'bg-[var(--accent)] text-[color:var(--color-bg)]'"
      >
        {{ shareToast.message }}
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 8px); }
@media (prefers-reduced-motion: reduce) { .toast-enter-active, .toast-leave-active { transition: none; } }
</style>
