<script setup lang="ts">
import { ref } from 'vue'

import { GridLayout } from 'grid-layout-plus'

import type { Layout } from 'grid-layout-plus'

const mirrored = ref(true)
const layout = ref<Layout>([
  { x: 0, y: 0, w: 3, h: 2, i: 'a' },
  { x: 3, y: 0, w: 3, h: 3, i: 'b' },
  { x: 6, y: 0, w: 3, h: 2, i: 'c' },
])
</script>

<template>
  <label>
    <input v-model="mirrored" type="checkbox" />
    Mirror the visual origin
  </label>
  <GridLayout v-model:layout="layout" :is-mirrored="mirrored" :row-height="30">
    <template #item="{ item }">
      <span> {{ item.i }} · x={{ item.x }} </span>
    </template>
  </GridLayout>
</template>
