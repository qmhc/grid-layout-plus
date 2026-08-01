<script setup lang="ts">
import { ref } from 'vue'

import { GridLayout } from 'grid-layout-plus'

import type { DropEvaluationResult, Layout } from 'grid-layout-plus'

type AcceptedDropResult = Extract<DropEvaluationResult, { status: 'accepted' }>

let nextId = 2
const layout = ref<Layout>([
  { x: 0, y: 0, w: 3, h: 2, i: '0' },
  { x: 3, y: 0, w: 3, h: 3, i: '1' },
])

function handleDragStart(event: DragEvent) {
  event.dataTransfer?.setData('text/plain', 'grid item')
}

function handleDrop(result: AcceptedDropResult) {
  const nextLayout = result.previewLayout.map(item => ({ ...item }))
  nextLayout.splice(result.insertionIndex, 0, {
    ...result.candidate,
    i: String(nextId++),
  })
  layout.value = nextLayout
}
</script>

<template>
  <div draggable="true" @dragstart="handleDragStart">
    <span>Drag a new item</span>
  </div>

  <GridLayout
    v-model:layout="layout"
    is-droppable
    :drop-item="{ w: 2, h: 2 }"
    :row-height="30"
    @drop="handleDrop"
  >
    <template #item="{ item }">
      {{ item.i }}
    </template>
  </GridLayout>
</template>
