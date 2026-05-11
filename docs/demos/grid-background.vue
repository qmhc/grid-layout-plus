<script setup lang="ts">
import { reactive, ref } from 'vue'

import { GridBackground } from '../../src'

const color = ref('rgba(0,0,0,0.1)')
const strokeWidth = ref(1)

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
    <label>
      Color:
      <input v-model="color" type="color" />
    </label>
    <label style="margin-left: 12px">
      Stroke Width:
      <input
        v-model.number="strokeWidth"
        type="number"
        min="1"
        max="5"
        style="width: 60px"
      />
    </label>
  </div>
  <GridLayout v-model:layout="layout" :row-height="30">
    <GridBackground :color="color" :stroke-width="strokeWidth"></GridBackground>
    <GridItem v-for="item in layout" :key="item.i" v-bind="item">
      <span class="text">{{ item.i }}</span>
    </GridItem>
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
