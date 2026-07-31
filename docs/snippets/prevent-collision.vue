<script setup lang="ts">
import { ref } from 'vue'

import { GridLayout, noCompactor } from 'grid-layout-plus'

import type { Layout } from 'grid-layout-plus'

const layout = ref<Layout>([
  { x: 0, y: 0, w: 3, h: 2, i: 'a' },
  { x: 4, y: 0, w: 3, h: 3, i: 'obstacle', static: true },
  { x: 8, y: 0, w: 3, h: 2, i: 'b' },
])
</script>

<template>
  <GridLayout
    v-model:layout="layout"
    :compactor="noCompactor"
    collision-mode="prevent"
    :row-height="30"
  >
    <template #item="{ item }">
      {{ item.i }}
    </template>
  </GridLayout>
</template>
