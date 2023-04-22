<script setup lang="ts">
import { reactive } from 'vue'

const layout = reactive([
  { x: 0, y: 0, w: 2, h: 2, i: '0' },
  { x: 2, y: 0, w: 2, h: 4, i: '1' }
])
const layout2 = reactive([
  { x: 0, y: 0, w: 2, h: 2, i: '0' },
  { x: 2, y: 0, w: 2, h: 4, i: '1' },
  { x: 4, y: 0, w: 2, h: 2, i: '2' }
])
</script>

<template>
  <div style="margin-top: 10px">
    <h4>Grid #1</h4>
    <GridLayout v-model:layout="layout" :row-height="30">
      <template #item="{ item }">
        <span class="text">{{ item.i }}</span>
      </template>
    </GridLayout>
  </div>
  <div style="margin-top: 10px">
    <h4>Grid #2</h4>
    <GridLayout :layout="layout2" :row-height="30">
      <template #item="{ item }">
        <span class="text">{{ item.i }}</span>
      </template>
    </GridLayout>
  </div>
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
