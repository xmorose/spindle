<script setup lang="ts">
const groups = [
  { items: [
    { to: "/", label: "Home" },
    { to: "/tops", label: "Tops" },
    { to: "/all-time", label: "All-time" },
  ] },
  { title: "Browse", items: [
    { to: "/artists", label: "Artists" },
    { to: "/albums", label: "Albums" },
    { to: "/tracks", label: "Tracks" },
  ] },
  { title: "Insights", items: [
    { to: "/pulse", label: "Pulse" },
    { to: "/sessions", label: "Sessions" },
    { to: "/wrapped", label: "Wrapped" },
  ] },
];
</script>

<template>
  <nav class="flex h-full flex-col gap-1 p-4">
    <div class="mb-5 flex items-center gap-2 px-1.5 text-base font-extrabold tracking-tight">
      <span class="grid h-[18px] w-[18px] place-items-center rounded-full border-2" :style="{ borderColor: 'var(--accent)' }">
        <span class="block h-2 w-2 rounded-full" :style="{ background: 'var(--accent)' }" />
      </span>
      Spindle
    </div>
    <template v-for="(group, gi) in groups" :key="gi">
      <div v-if="group.title" class="mt-4 mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.13em] text-faint">{{ group.title }}</div>
      <RouterLink
        v-for="item in group.items" :key="item.to" :to="item.to"
        class="rounded-lg px-3 py-2 text-[13.5px] font-medium text-muted hover:text-text"
        active-class="bg-surface-2 text-text font-semibold"
      >{{ item.label }}</RouterLink>
    </template>
  </nav>
</template>
