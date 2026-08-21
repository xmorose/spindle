<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/api/client";
import { cleanArtist } from "@/lib/format";
import type { SearchResult } from "@/api/types";
import CoverArt from "@/components/CoverArt.vue";

type Hit = { key: string; to: string; title: string; sub: string; coverId: string | null; round: boolean; group: string };

const router = useRouter();
const open = ref(false);
const q = ref("");
const res = ref<SearchResult | null>(null);
const loading = ref(false);
const active = ref(0);
const field = ref<HTMLInputElement | null>(null);
const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

watch(q, (val) => {
  clearTimeout(timer);
  const term = val.trim();
  active.value = 0;
  if (!term) { res.value = null; loading.value = false; return; }
  loading.value = true;
  timer = setTimeout(async () => {
    const mine = ++seq;
    try {
      const r = await api.search(term);
      if (mine === seq) res.value = r;
    } finally {
      if (mine === seq) loading.value = false;
    }
  }, 200);
});

const hits = computed<Hit[]>(() => {
  const r = res.value;
  if (!r) return [];
  return [
    ...r.artists.map((a) => ({ key: `ar-${a.id}`, to: `/artists/${a.id}`, title: cleanArtist(a.name), sub: "Artist", coverId: null, round: true, group: "Artists" })),
    ...r.albums.map((a) => ({ key: `al-${a.id}`, to: `/albums/${a.id}`, title: a.name, sub: cleanArtist(a.artist), coverId: a.id, round: false, group: "Albums" })),
    ...r.tracks.map((t) => ({ key: `tr-${t.id}`, to: `/tracks/${t.id}`, title: t.title, sub: cleanArtist(t.artist), coverId: t.hasCoverArt ? t.id : null, round: false, group: "Tracks" })),
  ];
});
const empty = computed(() => !!res.value && hits.value.length === 0);

function firstOfGroup(i: number): boolean {
  return i === 0 || hits.value[i - 1].group !== hits.value[i].group;
}

async function show() {
  open.value = true;
  await nextTick();
  field.value?.focus();
}
function hide() {
  open.value = false;
  q.value = "";
  res.value = null;
  active.value = 0;
}
function go(h: Hit) {
  hide();
  router.push(h.to);
}
function move(delta: number) {
  const n = hits.value.length;
  if (!n) return;
  active.value = (active.value + delta + n) % n;
}
function onEnter() {
  const h = hits.value[active.value];
  if (h) { go(h); return; }
  const term = q.value.trim();
  if (term) { hide(); router.push({ path: "/search", query: { q: term } }); }
}

function onWindowKey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (open.value) hide(); else void show();
    return;
  }
  if (e.key === "Escape" && open.value) hide();
}
onMounted(() => window.addEventListener("keydown", onWindowKey));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onWindowKey);
  clearTimeout(timer);
});
</script>

<template>
  <button
    class="group flex items-center gap-2 rounded-lg border border-line/70 bg-surface/60 py-1.5 pl-2.5 pr-2 text-[13px] text-faint transition-colors duration-150 hover:border-line hover:text-muted sm:w-40 lg:w-52"
    aria-label="Search" @click="show"
  >
    <svg viewBox="0 0 24 24" class="h-4 w-4 flex-none" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" />
    </svg>
    <span class="hidden flex-1 text-left sm:block">Search</span>
    <kbd class="tabular hidden flex-none rounded border border-line/70 px-1.5 py-px text-[10px] font-semibold sm:block">{{ isMac ? "⌘K" : "Ctrl K" }}</kbd>
  </button>

  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]" @click.self="hide">
      <div class="palette-scrim absolute inset-0 bg-[oklch(0.1_0.02_50/0.66)] backdrop-blur-sm" @click="hide"></div>

      <div class="palette-panel relative flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <div class="flex flex-none items-center gap-3 border-b border-line/70 px-4">
          <svg viewBox="0 0 24 24" class="h-4 w-4 flex-none text-faint" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" />
          </svg>
          <input
            ref="field" v-model="q" type="text" placeholder="Search artists, albums, tracks"
            class="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-faint"
            @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)" @keydown.enter.prevent="onEnter"
          />
          <span v-if="loading" class="h-3.5 w-3.5 flex-none animate-spin rounded-full border-2 border-line border-t-[var(--accent)]"></span>
        </div>

        <div v-if="hits.length" class="min-h-0 flex-1 overflow-y-auto p-1.5">
          <template v-for="(h, i) in hits" :key="h.key">
            <div v-if="firstOfGroup(i)" class="label-sm px-2.5 pb-1 pt-2.5">{{ h.group }}</div>
            <button
              class="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-100"
              :class="i === active ? 'bg-[var(--accent-soft)]' : 'hover:bg-surface-2'"
              @click="go(h)" @mousemove="active = i"
            >
              <CoverArt :id="h.coverId" :name="h.title" :size="80" class="h-8 w-8 flex-none" :class="h.round ? '!rounded-full' : ''" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[13.5px] font-semibold" :style="i === active ? { color: 'var(--accent)' } : undefined">{{ h.title }}</span>
                <span class="block truncate text-[11.5px] text-faint">{{ h.sub }}</span>
              </span>
            </button>
          </template>
        </div>

        <div v-else-if="empty" class="px-4 py-10 text-center text-sm text-faint">No matches for “{{ q.trim() }}”.</div>
        <div v-else-if="!q.trim()" class="px-4 py-10 text-center text-sm text-faint">Type to search your library.</div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.palette-panel { animation: palette-in 200ms var(--ease-out-quint) both; }
.palette-scrim { animation: fade 160ms ease both; }
@keyframes palette-in {
  from { opacity: 0; transform: translateY(-10px) scale(0.985); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .palette-panel, .palette-scrim { animation: none; }
}
</style>
