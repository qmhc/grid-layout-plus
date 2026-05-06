<script setup lang="ts">
import { reactive, ref } from 'vue'

const threshold = ref(10)

const layout = reactive([
  { x: 0, y: 0, w: 2, h: 2, i: '0' },
  { x: 2, y: 0, w: 2, h: 4, i: '1' },
  { x: 4, y: 0, w: 2, h: 5, i: '2' },
  { x: 6, y: 0, w: 2, h: 3, i: '3' },
  { x: 8, y: 0, w: 2, h: 3, i: '4' },
  { x: 10, y: 0, w: 2, h: 3, i: '5' },
  { x: 0, y: 5, w: 2, h: 5, i: '6' },
  { x: 2, y: 5, w: 2, h: 5, i: '7' },
  { x: 4, y: 5, w: 2, h: 5, i: '8' },
  { x: 6, y: 4, w: 2, h: 4, i: '9' },
])
</script>

<template>
  <div style="margin-bottom: 10px">
    <label>
      Drag Threshold (px):
      <input
        v-model.number="threshold"
        type="number"
        min="0"
        max="100"
        style="width: 60px"
      />
    </label>
    <span style="margin-left: 8px; color: #666">
      Move the mouse at least {{ threshold }}px before dragging starts.
    </span>
  </div>
  <GridLayout
    v-model:layout="layout"
    :drag-threshold="threshold"
    :row-height="30"
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
