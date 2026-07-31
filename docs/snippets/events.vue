<script setup lang="ts">
import { ref } from 'vue'

import { GridItem, GridLayout } from 'grid-layout-plus'

import type { Layout } from 'grid-layout-plus'

const layout = ref<Layout>([
  { x: 0, y: 0, w: 3, h: 2, i: 'a' },
  { x: 3, y: 0, w: 3, h: 3, i: 'b' },
])

function handleMoved(id: string | number, x: number, y: number) {
  console.info('moved', { id, x, y })
}

function handleResized(
  id: string | number,
  h: number,
  w: number,
  pixelHeight: number,
  pixelWidth: number,
) {
  console.info('resized', { id, h, w, pixelHeight, pixelWidth })
}
</script>

<template>
  <GridLayout v-model:layout="layout" :col-num="12" :row-height="30">
    <GridItem
      v-for="item in layout"
      :key="item.i"
      :i="item.i"
      @moved="handleMoved"
      @resized="handleResized"
    >
      {{ item.i }}
    </GridItem>
  </GridLayout>
</template>
