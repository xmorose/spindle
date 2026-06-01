<script setup lang="ts">
const groups = [
  { items: [
    { to: "/", label: "Home" },
    { to: "/tops", label: "Tops" },
    { to: "/recent", label: "Recent" },
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
  <nav class="flex h-full flex-col gap-0.5 p-4">
    <div class="mb-6 flex items-center gap-2.5 px-2 text-lg font-extrabold tracking-tight">
      <span class="grid h-5 w-5 place-items-center rounded-full border-2" :style="{ borderColor: 'var(--accent)' }">
        <span class="block h-2 w-2 rounded-full" :style="{ background: 'var(--accent)' }" />
      </span>
      Spindle
    </div>
    <template v-for="(group, gi) in groups" :key="gi">
      <div v-if="group.title" class="label mt-5 mb-1.5 px-3" style="font-size:10.5px;color:var(--color-faint)">{{ group.title }}</div>
      <RouterLink
        v-for="item in group.items" :key="item.to" :to="item.to"
        class="group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors duration-150 hover:bg-surface hover:text-text"
        active-class="!text-text font-semibold"
        :style="{ '--ind': 'transparent' }"
      >
        <span class="h-1.5 w-1.5 flex-none rounded-full transition-colors duration-150"
          :style="{ background: 'var(--ind)' }" data-dot></span>
        {{ item.label }}
      </RouterLink>
    </template>
  </nav>
</template>

<style scoped>
.router-link-active { background: var(--accent-soft); }
.router-link-active [data-dot] { background: var(--accent) !important; }
</style>
