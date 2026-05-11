<script setup lang="ts">
import { reactive, ref } from 'vue'

let nextId = 6

const layout = reactive([
  { x: 0, y: 0, w: 2, h: 2, i: '0' },
  { x: 2, y: 0, w: 2, h: 4, i: '1' },
  { x: 4, y: 0, w: 2, h: 3, i: '2' },
  { x: 6, y: 0, w: 2, h: 3, i: '3' },
  { x: 8, y: 0, w: 2, h: 3, i: '4' },
  { x: 10, y: 0, w: 2, h: 3, i: '5' },
])

const isDroppable = ref(true)
const dropStatus = ref('')

function handleDropDragOver(pos: { x: number, y: number }) {
  dropStatus.value = `Dragging over: (${pos.x}, ${pos.y})`
}

function handleDrop(item: { x: number, y: number, w: number, h: number }) {
  layout.push({ ...item, i: String(nextId++) })
  dropStatus.value = `Dropped at: (${item.x}, ${item.y})`
}

function handleDropDragLeave() {
  dropStatus.value = 'Drag left the grid'
}
</script>

<template>
  <div style="margin-bottom: 10px">
    <div
      draggable="true"
      class="droppable-element"
    >
      Drag me into the grid
    </div>
    <label style="margin-left: 8px">
      <input v-model="isDroppable" type="checkbox" />
      isDroppable
    </label>
    <span v-if="dropStatus" style="margin-left: 8px; color: #666">{{ dropStatus }}</span>
  </div>
  <GridLayout
    v-model:layout="layout"
    :is-droppable="isDroppable"
    :drop-item="{ w: 2, h: 2 }"
    :row-height="30"
    @drop-drag-over="handleDropDragOver"
    @drop="handleDrop"
    @drop-drag-leave="handleDropDragLeave"
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

.droppable-element {
  display: inline-block;
  padding: 10px 20px;
  cursor: grab;
  background-color: #fdd;
  border: 1px solid black;
}
</style>
