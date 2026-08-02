<script setup lang="ts">
import { reactive, ref } from 'vue'

import { GridLayout } from 'grid-layout-plus'

import type { DragConfig, DropConfig, GridConfig, Layout, ResizeConfig } from 'grid-layout-plus'

const gridConfig = reactive<GridConfig>({
  colNum: 12,
  rowHeight: 30,
  gap: [10, 10],
})
const dragConfig = reactive<DragConfig>({ isDraggable: true, dragThreshold: 8 })
const resizeConfig = reactive<ResizeConfig>({ isResizable: true })
const dropConfig = reactive<DropConfig>({ isDroppable: false })

const layout = ref<Layout>([
  { x: 0, y: 0, w: 3, h: 2, i: 'a' },
  { x: 3, y: 0, w: 3, h: 3, i: 'b' },
  { x: 6, y: 0, w: 3, h: 2, i: 'c' },
])
</script>

<template>
  <GridLayout
    v-model:layout="layout"
    :grid-config="gridConfig"
    :drag-config="dragConfig"
    :resize-config="resizeConfig"
    :drop-config="dropConfig"
  >
    <template #item="{ item }">
      {{ item.i }}
    </template>
  </GridLayout>
</template>
