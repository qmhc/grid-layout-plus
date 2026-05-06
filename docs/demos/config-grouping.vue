<script setup lang="ts">
import { reactive } from 'vue'

import type { DragConfig, DropConfig, GridConfig, ResizeConfig } from 'grid-layout-plus'

const gridConfig = reactive<GridConfig>({
  colNum: 12,
  rowHeight: 30,
  margin: [10, 10],
})

const dragConfig = reactive<DragConfig>({
  isDraggable: true,
  dragThreshold: 0,
})

const resizeConfig = reactive<ResizeConfig>({
  isResizable: true,
  resizeHandles: ['se'],
})

const dropConfig = reactive<DropConfig>({
  isDroppable: false,
})

const layout = reactive([
  { x: 0, y: 0, w: 2, h: 2, i: '0' },
  { x: 2, y: 0, w: 2, h: 4, i: '1' },
  { x: 4, y: 0, w: 2, h: 3, i: '2' },
  { x: 6, y: 0, w: 2, h: 3, i: '3' },
  { x: 8, y: 0, w: 2, h: 3, i: '4' },
  { x: 10, y: 0, w: 2, h: 3, i: '5' },
])
</script>

<template>
  <div style="margin-bottom: 10px">
    <fieldset style="display: inline-block; margin-right: 12px; vertical-align: top">
      <legend>Grid Config</legend>
      <label>
        Row Height:
        <input
          v-model.number="gridConfig.rowHeight"
          type="number"
          min="10"
          max="100"
          style="width: 60px"
        />
      </label>
    </fieldset>
    <fieldset style="display: inline-block; margin-right: 12px; vertical-align: top">
      <legend>Drag Config</legend>
      <label>
        <input v-model="dragConfig.isDraggable" type="checkbox" />
        Draggable
      </label>
      <label style="margin-left: 8px">
        Threshold:
        <input
          v-model.number="dragConfig.dragThreshold"
          type="number"
          min="0"
          max="50"
          style="width: 50px"
        />
      </label>
    </fieldset>
    <fieldset style="display: inline-block; margin-right: 12px; vertical-align: top">
      <legend>Resize Config</legend>
      <label>
        <input v-model="resizeConfig.isResizable" type="checkbox" />
        Resizable
      </label>
    </fieldset>
    <fieldset style="display: inline-block; vertical-align: top">
      <legend>Drop Config</legend>
      <label>
        <input v-model="dropConfig.isDroppable" type="checkbox" />
        Droppable
      </label>
    </fieldset>
  </div>
  <GridLayout
    v-model:layout="layout"
    :grid-config="gridConfig"
    :drag-config="dragConfig"
    :resize-config="resizeConfig"
    :drop-config="dropConfig"
  >
    <template #item="{ item }">
      <span class="text">{{ item.i }}</span>
    </template>
  </GridLayout>
</template>

<style scoped>
.vgl-layout {
  background-color: #eee;
}

:deep(.vgl-item:not(.vgl-item--placeholder)) {
  background-color: #ccc;
  border: 1px solid black;
}

:deep(.vgl-item--resizing) {
  opacity: 90%;
}

:deep(.vgl-item--static) {
  background-color: #cce;
}

.text {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: auto;
  font-size: 24px;
  text-align: center;
}
</style>
