<script setup lang="ts">
import { ref } from 'vue'

import { GridLayout, noCompactor } from 'grid-layout-plus'

import type { Layout } from 'grid-layout-plus'

const layout = ref<Layout>([
  { x: 0, y: 0, w: 2, h: 2, i: 'a' },
  { x: 4, y: 1, w: 2, h: 3, i: 'b' },
  { x: 8, y: 4, w: 3, h: 2, i: 'c' },
])
</script>

<template>
  <GridLayout v-model:layout="layout" :compactor="noCompactor" :row-height="30">
    <template #item="{ item }">
      <span> {{ item.i }} · ({{ item.x }}, {{ item.y }}) </span>
    </template>
  </GridLayout>
</template>
