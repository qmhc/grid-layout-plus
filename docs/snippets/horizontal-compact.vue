<script setup lang="ts">
import { ref } from 'vue'

import { GridLayout, horizontalCompactor } from 'grid-layout-plus'

import type { Layout } from 'grid-layout-plus'

const layout = ref<Layout>([
  { x: 0, y: 0, w: 2, h: 2, i: 'a' },
  { x: 4, y: 1, w: 2, h: 3, i: 'b' },
  { x: 8, y: 0, w: 2, h: 2, i: 'c' },
])
</script>

<template>
  <GridLayout v-model:layout="layout" :compactor="horizontalCompactor" :row-height="30">
    <template #item="{ item }">
      {{ item.i }}
    </template>
  </GridLayout>
</template>
