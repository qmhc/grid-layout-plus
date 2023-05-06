<script setup lang="ts">
import { ref, reactive } from 'vue'

const draggable = ref(true)
const resizable = ref(false)
const isSwappable = ref(true)
const bounded = ref(false)
const preventCollision = ref(false)
const verticalCompact = ref(true)
const restoreOnDrag = ref(true)

// const layout = reactive([
//   { x: 0, y: 0, w: 2, h: 2, i: '0', static: false },
//   { x: 2, y: 0, w: 2, h: 4, i: '1', static: true },
//   { x: 4, y: 0, w: 2, h: 5, i: '2', static: false },
//   { x: 6, y: 0, w: 2, h: 3, i: '3', static: false },
//   { x: 8, y: 0, w: 2, h: 3, i: '4', static: false },
//   { x: 10, y: 0, w: 2, h: 3, i: '5', static: false },
//   { x: 0, y: 5, w: 2, h: 5, i: '6', static: false },
//   { x: 2, y: 5, w: 2, h: 5, i: '7', static: false },
//   { x: 4, y: 5, w: 2, h: 5, i: '8', static: false },
//   { x: 6, y: 3, w: 2, h: 4, i: '9', static: true },
//   { x: 8, y: 4, w: 2, h: 4, i: '10', static: false },
//   { x: 10, y: 4, w: 2, h: 4, i: '11', static: false },
//   { x: 0, y: 10, w: 2, h: 5, i: '12', static: false },
//   { x: 2, y: 10, w: 2, h: 5, i: '13', static: false },
//   { x: 4, y: 8, w: 2, h: 4, i: '14', static: false },
//   { x: 6, y: 8, w: 2, h: 4, i: '15', static: false },
//   { x: 8, y: 10, w: 2, h: 5, i: '16', static: false },
//   { x: 10, y: 4, w: 2, h: 2, i: '17', static: false },
//   { x: 0, y: 9, w: 2, h: 3, i: '18', static: false },
//   { x: 2, y: 6, w: 2, h: 2, i: '19', static: false }
// ])

const layout = reactive([
  { x: 0, y: 0, w: 1, h: 1, i: '0' },
  { x: 1, y: 0, w: 1, h: 1, i: '1' },
  { x: 2, y: 0, w: 1, h: 1, i: '2' },
  { x: 3, y: 0, w: 1, h: 1, i: '3' },
  { x: 4, y: 0, w: 1, h: 1, i: '4' },
  { x: 5, y: 0, w: 1, h: 1, i: '5' },
  { x: 6, y: 0, w: 1, h: 1, i: '6' },
  { x: 7, y: 0, w: 1, h: 1, i: '7' },
  { x: 8, y: 0, w: 1, h: 1, i: '8' },
  { x: 9, y: 0, w: 1, h: 1, i: '9' },
  { x: 10, y: 0, w: 1, h: 1, i: '10' },
  { x: 11, y: 0, w: 1, h: 1, i: '11' },
  { x: 0, y: 1, w: 2, h: 2, i: '12' },
  { x: 2, y: 1, w: 2, h: 2, i: '13' },
  { x: 4, y: 1, w: 2, h: 2, i: '14' },
  { x: 6, y: 1, w: 2, h: 2, i: '15' },
  { x: 8, y: 1, w: 2, h: 2, i: '16' },
  { x: 10, y: 1, w: 2, h: 2, i: '17' },
  { x: 0, y: 3, w: 3, h: 3, i: '18' },
  { x: 3, y: 3, w: 3, h: 3, i: '19' },
  { x: 6, y: 3, w: 3, h: 3, i: '20' },
  { x: 9, y: 3, w: 3, h: 3, i: '21' },
  { x: 0, y: 6, w: 4, h: 4, i: '22' },
  { x: 4, y: 6, w: 4, h: 4, i: '23' },
  { x: 8, y: 6, w: 4, h: 4, i: '24' },
  { x: 0, y: 10, w: 6, h: 4, i: '25' },
  { x: 6, y: 10, w: 6, h: 4, i: '26' },
  { x: 0, y: 14, w: 12, h: 4, i: '27' }
])
</script>

<template>
  <div class="layout-json">
    Displayed as <code>[x, y, w, h]</code>:
    <div class="columns">
      <div v-for="item in layout" :key="item.i">
        <b>{{ item.i }}</b>: [{{ item.x }}, {{ item.y }}, {{ item.w }}, {{ item.h }}]
      </div>
    </div>
  </div>
  <hr />
  <input v-model="draggable" type="checkbox" /> Draggable
  <input v-model="resizable" type="checkbox" /> Resizable
  <input v-model="isSwappable" type="checkbox" /> Swappable
  <input v-model="bounded" type="checkbox" /> Bounded
  <input v-model="preventCollision" type="checkbox" /> Prevent Collision
  <input v-model="verticalCompact" type="checkbox" /> Vertical Compact
  <input v-model="restoreOnDrag" type="checkbox" /> Restore on Drag
  <br />
  <div style="width: 100%; height: 100%; margin-top: 10px">
    <GridLayout
      v-model:layout="layout"
      :col-num="12"
      :row-height="100"
      :is-draggable="draggable"
      :is-resizable="resizable"
      :is-swappable="isSwappable"
      :is-bounded="bounded"
      :prevent-collision="preventCollision"
      :vertical-compact="verticalCompact"
      :restore-on-drag="restoreOnDrag"
    >
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

.layout-json {
  padding: 10px;
  margin-top: 10px;
  background-color: #ddd;
  border: 1px solid black;
}

.columns {
  columns: 120px;
}
</style>
