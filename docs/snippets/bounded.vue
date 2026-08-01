<script setup lang="ts">
import { ref } from 'vue'

import { GridLayout } from 'grid-layout-plus'

import type { Layout } from 'grid-layout-plus'

const bounded = ref(true)
const layout = ref<Layout>([
  { x: 0, y: 0, w: 3, h: 2, i: 'a' },
  { x: 3, y: 0, w: 3, h: 2, i: 'b' },
  { x: 6, y: 0, w: 3, h: 2, i: 'c' },
])
</script>

<template>
  <label>
    <input v-model="bounded" type="checkbox" />
    Keep dragged items inside the grid
  </label>
  <GridLayout
    v-model:layout="layout"
    :is-bounded="bounded"
    :is-resizable="false"
    :margin="[10, 10]"
    :row-height="30"
  >
    <template #item="{ item }">
      {{ item.i }}
    </template>
  </GridLayout>
</template>
