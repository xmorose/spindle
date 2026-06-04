<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRoute } from "vue-router";
import { api } from "@/api/client";
import { cleanArtist } from "@/lib/format";
import type { SearchResult } from "@/api/types";
import CoverArt from "@/components/CoverArt.vue";
import Spinner from "@/components/ui/Spinner.vue";

const route = useRoute();
const q = ref(String(route.query.q ?? ""));
const res = ref<SearchResult | null>(null);
const loading = ref(false);

let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
watch(q, (val) => {
  clearTimeout(timer);
  const term = val.trim();
  if (!term) { res.value = null; loading.value = false; return; }
  loading.value = true;
  timer = setTimeout(async () => {
    const mine = ++seq;
    try { const r = await api.search(term); if (mine === seq) res.value = r; }
    finally { if (mine === seq) loading.value = false; }
  }, 250);
}, { immediate: true });

const empty = computed(() => !!res.value && !res.value.artists.length && !res.value.albums.length && !res.value.tracks.length);
</script>

<template>
  <div class="py-2 rise">
    <h1 class="mb-5 text-3xl font-black tracking-tight">Search</h1>
    <input
      v-model="q" type="search" autofocus
      placeholder="Search artists, albums, tracks…"
      class="mb-8 w-full max-w-xl rounded-lg border border-line bg-surface px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-faint focus:border-[var(--accent)]"
    />

    <div v-if="loading && !res" class="grid min-h-[30vh] place-items-center"><Spinner /></div>
    <p v-else-if="!q.trim()" class="text-sm text-faint">Type to search your library.</p>
    <p v-else-if="empty" class="text-sm text-faint">No matches for “{{ q.trim() }}”.</p>

    <div v-else-if="res" class="flex max-w-3xl flex-col gap-8">
      <section v-if="res.artists.length">
        <div class="label mb-2">Artists</div>
        <RouterLink v-for="a in res.artists" :key="a.id" :to="`/artists/${a.id}`" class="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface">
          <CoverArt :id="null" :name="a.name" :size="80" class="h-9 w-9 flex-none rounded-full" />
          <span class="truncate text-sm font-semibold">{{ cleanArtist(a.name) }}</span>
        </RouterLink>
      </section>

      <section v-if="res.albums.length">
        <div class="label mb-2">Albums</div>
        <div v-for="al in res.albums" :key="al.id" class="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface">
          <RouterLink :to="`/albums/${al.id}`" class="flex-none">
            <CoverArt :id="al.id" :name="al.name" :size="80" class="h-9 w-9 rounded" />
          </RouterLink>
          <div class="min-w-0">
            <RouterLink :to="`/albums/${al.id}`" class="block truncate text-sm font-semibold hover:underline">{{ al.name }}</RouterLink>
            <RouterLink :to="`/artists/${al.artistId}`" class="block truncate text-xs text-faint transition-colors hover:text-text hover:underline">{{ cleanArtist(al.artist) }}</RouterLink>
          </div>
        </div>
      </section>

      <section v-if="res.tracks.length">
        <div class="label mb-2">Tracks</div>
        <div v-for="t in res.tracks" :key="t.id" class="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface">
          <RouterLink :to="`/tracks/${t.id}`" class="flex-none">
            <CoverArt :id="t.hasCoverArt ? t.id : null" :name="t.title" :size="80" class="h-9 w-9 rounded" />
          </RouterLink>
          <div class="min-w-0">
            <RouterLink :to="`/tracks/${t.id}`" class="block truncate text-sm font-semibold hover:underline">{{ t.title }}</RouterLink>
            <RouterLink :to="`/artists/${t.artistId}`" class="block truncate text-xs text-faint transition-colors hover:text-text hover:underline">{{ cleanArtist(t.artist) }}</RouterLink>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
