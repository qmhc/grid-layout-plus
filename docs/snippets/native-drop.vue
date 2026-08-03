<script setup lang="ts">
import { ref } from 'vue'

import { GridLayout } from 'grid-layout-plus'

import type { DropConfig, Layout } from 'grid-layout-plus'

let nextId = 2
const layout = ref<Layout>([
  { x: 0, y: 0, w: 3, h: 2, i: '0' },
  { x: 3, y: 0, w: 3, h: 3, i: '1' },
])
const dropConfig: DropConfig = {
  isDroppable: true,
  dropItem: { w: 2, h: 2 },
  createItem: () => ({ i: String(nextId++), x: 0, y: 0, w: 2, h: 2 }),
}

function handleDragStart(event: DragEvent) {
  event.dataTransfer?.setData('text/plain', 'grid item')
}

</script>

<template>
  <div draggable="true" @dragstart="handleDragStart">
    <span>Drag a new item</span>
  </div>

  <GridLayout
    v-model:layout="layout"
    :drop-config="dropConfig"
    :row-height="30"
  >
    <template #item="{ item }">
      {{ item.i }}
    </template>
  </GridLayout>
</template>
