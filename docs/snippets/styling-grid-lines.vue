<script setup lang="ts">
import { ref } from 'vue'

import { GridLayout } from 'grid-layout-plus'

import type { Layout } from 'grid-layout-plus'

const layout = ref<Layout>([
  { x: 0, y: 0, w: 2, h: 2, i: 'a' },
  { x: 2, y: 0, w: 2, h: 3, i: 'b' },
  { x: 4, y: 0, w: 2, h: 2, i: 'c' },
])
</script>

<template>
  <GridLayout v-model:layout="layout" class="grid-lines" :row-height="30">
    <template #item="{ item }">
      {{ item.i }}
    </template>
  </GridLayout>
</template>

<style scoped>
.grid-lines::before {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: '';
  background-image:
    linear-gradient(to right, #cbd5e1 1px, transparent 1px),
    linear-gradient(to bottom, #cbd5e1 1px, transparent 1px);
  background-position: -5px -5px;
  background-size: calc((100% + 10px) / 12) 40px;
}
</style>
