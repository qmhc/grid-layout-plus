<script setup lang="ts">
import { ref } from 'vue'

import { GridLayout } from 'grid-layout-plus'

import type { Layout } from 'grid-layout-plus'

const threshold = ref(10)
const layout = ref<Layout>([
  { x: 0, y: 0, w: 3, h: 2, i: 'a' },
  { x: 3, y: 0, w: 3, h: 3, i: 'b' },
  { x: 6, y: 0, w: 3, h: 2, i: 'c' },
])
</script>

<template>
  <label>
    Drag threshold
    <input
      v-model.number="threshold"
      type="number"
      min="0"
      max="100"
      aria-label="Drag threshold in pixels"
    />
  </label>
  <GridLayout v-model:layout="layout" :drag-threshold="threshold" :row-height="30">
    <template #item="{ item }">
      {{ item.i }}
    </template>
  </GridLayout>
</template>
