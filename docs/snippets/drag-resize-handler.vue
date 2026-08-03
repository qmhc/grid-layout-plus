<script setup lang="ts">
import { ref } from 'vue'

import { GridItem, GridLayout } from 'grid-layout-plus'

import type { Layout } from 'grid-layout-plus'

const layout = ref<Layout>([
  { x: 0, y: 0, w: 4, h: 3, i: 'a' },
  { x: 4, y: 0, w: 4, h: 3, i: 'b' },
])
</script>

<template>
  <GridLayout v-model:layout="layout" :is-resizable="false" :row-height="30">
    <GridItem
      v-for="item in layout"
      :key="item.i"
      :i="item.i"
      drag-allow-from=".drag-handle"
      drag-ignore-from=".drag-ignore"
    >
      <div class="drag-handle">
        <span>Drag {{ item.i }}</span>
      </div>
      <button class="drag-ignore" type="button">
        <span>Click without dragging</span>
      </button>
    </GridItem>
  </GridLayout>
</template>

<style scoped>
.drag-handle {
  cursor: grab;
}
</style>
