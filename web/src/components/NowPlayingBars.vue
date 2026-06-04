<script setup lang="ts"></script>

<template>
  <span class="eq" role="img" aria-label="Now playing">
    <span class="bar"></span><span class="bar"></span><span class="bar"></span>
  </span>
</template>

<style scoped>
.eq { display: inline-flex; align-items: flex-end; gap: 2px; height: 14px; width: 15px; }
.bar { width: 3px; border-radius: 1px; background: currentColor; transform-origin: bottom; animation: eq 0.9s ease-in-out infinite; }
.bar:nth-child(1) { height: 60%; animation-delay: -0.2s; }
.bar:nth-child(2) { height: 100%; animation-delay: -0.5s; }
.bar:nth-child(3) { height: 45%; animation-delay: 0s; }
@keyframes eq { 0%, 100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }
@media (prefers-reduced-motion: reduce) { .bar { animation: none; transform: scaleY(0.7); } }
</style>
