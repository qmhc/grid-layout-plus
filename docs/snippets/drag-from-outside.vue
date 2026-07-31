<script setup lang="ts">
import { ref } from 'vue'

import { GridLayout } from 'grid-layout-plus'

import type { DropConfig, DropEvaluationResult, Layout } from 'grid-layout-plus'

type AcceptedDropResult = Extract<DropEvaluationResult, { status: 'accepted' }>

const sourceSize = ref({ w: 4, h: 2 })
const dropConfig: DropConfig = {
  isDroppable: true,
  dropItem: { w: 2, h: 2 },
  onDragOver: () => sourceSize.value,
}

let nextId = 2
const layout = ref<Layout>([
  { x: 0, y: 0, w: 3, h: 2, i: '0' },
  { x: 3, y: 0, w: 3, h: 3, i: '1' },
])

function handleDragStart(event: DragEvent) {
  event.dataTransfer?.setData('application/x-grid-layout-plus', JSON.stringify(sourceSize.value))
}

function handleDrop(result: AcceptedDropResult) {
  const nextLayout = result.previewLayout.map(item => ({ ...item }))
  nextLayout.splice(result.insertionIndex, 0, {
    ...result.candidate,
    i: `external-${nextId++}`,
  })
  layout.value = nextLayout
}
</script>

<template>
  <div draggable="true" @dragstart="handleDragStart">
    <span>Drag a 4 × 2 item</span>
  </div>

  <GridLayout
    v-model:layout="layout"
    :drop-config="dropConfig"
    :margin="[10, 10]"
    :row-height="30"
    @drop="handleDrop"
  >
    <template #item="{ item }">
      {{ item.i }}
    </template>
  </GridLayout>
</template>
