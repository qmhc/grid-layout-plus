<script setup lang="ts">
import { reactive } from 'vue'

import { noCompactor } from 'grid-layout-plus'

const layout = reactive([
  { x: 0, y: 0, w: 2, h: 2, i: '0' },
  { x: 3, y: 1, w: 2, h: 3, i: '1' },
  { x: 6, y: 4, w: 3, h: 2, i: '2' },
  { x: 1, y: 6, w: 2, h: 2, i: '3' },
  { x: 8, y: 0, w: 2, h: 3, i: '4' },
  { x: 5, y: 8, w: 2, h: 2, i: '5' },
])
</script>

<template>
  <GridLayout
    v-model:layout="layout"
    :compactor="noCompactor"
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
