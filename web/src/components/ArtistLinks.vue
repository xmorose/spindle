<script setup lang="ts">
import { computed } from "vue";
import type { ArtistRef } from "@/api/types";

const props = defineProps<{ text: string; artistId?: string | null; artists?: ArtistRef[] | null }>();

interface Part { text: string; id?: string; }

const parts = computed<Part[] | null>(() => {
  const artists = props.artists ?? [];
  if (artists.length < 2) return null;
  const text = props.text;
  const lower = text.toLowerCase();
  if (lower.length !== text.length) return null;

  const found: { start: number; end: number; id: string }[] = [];
  for (const a of [...artists].sort((x, y) => y.name.length - x.name.length)) {
    const needle = a.name.toLowerCase();
    if (!needle) continue;
    let at = lower.indexOf(needle);
    while (at >= 0 && found.some((f) => at < f.end && at + needle.length > f.start)) at = lower.indexOf(needle, at + 1);
    if (at >= 0) found.push({ start: at, end: at + needle.length, id: a.id });
  }
  if (found.length < 2) return null;

  found.sort((x, y) => x.start - y.start);
  const out: Part[] = [];
  let pos = 0;
  for (const f of found) {
    if (f.start > pos) out.push({ text: text.slice(pos, f.start) });
    out.push({ text: text.slice(f.start, f.end), id: f.id });
    pos = f.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
});

const single = computed(() => props.artistId ?? props.artists?.[0]?.id ?? null);
</script>

<template>
  <span v-if="parts">
    <template v-for="(p, i) in parts" :key="i">
      <RouterLink v-if="p.id" :to="`/artists/${p.id}`" @click.stop
        class="transition-colors hover:text-text hover:underline">{{ p.text }}</RouterLink>
      <template v-else>{{ p.text }}</template>
    </template>
  </span>
  <RouterLink v-else-if="single" :to="`/artists/${single}`" @click.stop
    class="transition-colors hover:text-text hover:underline">{{ text }}</RouterLink>
  <span v-else>{{ text }}</span>
</template>
