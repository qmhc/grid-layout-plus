<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

import type { ResizeHandle } from 'grid-layout-plus'

const allHandles: ResizeHandle[] = ['se', 'sw', 'ne', 'nw', 's', 'n', 'e', 'w']
const selected = ref<Record<ResizeHandle, boolean>>({
  se: true,
  sw: true,
  ne: true,
  nw: true,
  s: false,
  n: false,
  e: false,
  w: false,
})

const resizeHandles = computed(() => {
  return allHandles.filter(h => selected.value[h])
})

const layout = reactive([
  { x: 0, y: 0, w: 3, h: 3, i: '0' },
  { x: 3, y: 0, w: 3, h: 3, i: '1' },
  { x: 6, y: 0, w: 3, h: 3, i: '2' },
  { x: 0, y: 3, w: 4, h: 3, i: '3' },
  { x: 4, y: 3, w: 4, h: 3, i: '4' },
  { x: 8, y: 3, w: 4, h: 3, i: '5' },
])
</script>

<template>
  <div style="margin-bottom: 10px">
    <span>Resize Handles: </span>
    <label v-for="h in allHandles" :key="h" style="margin-right: 8px">
      <input v-model="selected[h]" type="checkbox" />
      {{ h }}
    </label>
  </div>
  <GridLayout
    v-model:layout="layout"
    :resize-handles="resizeHandles"
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
