<script setup lang="ts">
import { ref, reactive } from 'vue'

import type { Breakpoint, Layout } from 'grid-layout-plus'

const presetLayouts = reactive({
  md: [
    { x: 0, y: 0, w: 2, h: 2, i: '0' },
    { x: 2, y: 0, w: 2, h: 4, i: '1' },
    { x: 4, y: 0, w: 2, h: 5, i: '2' },
    { x: 6, y: 0, w: 2, h: 3, i: '3' },
    { x: 2, y: 4, w: 2, h: 3, i: '4' },
    { x: 4, y: 5, w: 2, h: 3, i: '5' },
    { x: 0, y: 2, w: 2, h: 5, i: '6' },
    { x: 2, y: 7, w: 2, h: 5, i: '7' },
    { x: 4, y: 8, w: 2, h: 5, i: '8' },
    { x: 6, y: 3, w: 2, h: 4, i: '9' },
    { x: 0, y: 7, w: 2, h: 4, i: '10' },
    { x: 2, y: 19, w: 2, h: 4, i: '11' },
    { x: 0, y: 14, w: 2, h: 5, i: '12' },
    { x: 2, y: 14, w: 2, h: 5, i: '13' },
    { x: 4, y: 13, w: 2, h: 4, i: '14' },
    { x: 6, y: 7, w: 2, h: 4, i: '15' },
    { x: 0, y: 19, w: 2, h: 5, i: '16' },
    { x: 8, y: 0, w: 2, h: 2, i: '17' },
    { x: 0, y: 11, w: 2, h: 3, i: '18' },
    { x: 2, y: 12, w: 2, h: 2, i: '19' }
  ],
  lg: [
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
    { x: 8, y: 4, w: 2, h: 4, i: '10' },
    { x: 10, y: 4, w: 2, h: 4, i: '11' },
    { x: 0, y: 10, w: 2, h: 5, i: '12' },
    { x: 2, y: 10, w: 2, h: 5, i: '13' },
    { x: 4, y: 8, w: 2, h: 4, i: '14' },
    { x: 6, y: 8, w: 2, h: 4, i: '15' },
    { x: 8, y: 10, w: 2, h: 5, i: '16' },
    { x: 10, y: 4, w: 2, h: 2, i: '17' },
    { x: 0, y: 9, w: 2, h: 3, i: '18' },
    { x: 2, y: 6, w: 2, h: 2, i: '19' }
  ]
})

const layout = ref(presetLayouts.lg)

function breakpointChangedEvent(newBreakpoint: Breakpoint, newLayout: Layout) {
  console.info('BREAKPOINT CHANGED breakpoint=', newBreakpoint, ', layout: ', newLayout)
}
</script>

<template>
  <GridLayout
    v-model:layout="layout"
    :responsive-layouts="presetLayouts"
    :row-height="30"
    responsive
    @breakpoint-changed="breakpointChangedEvent"
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
