<script setup lang="ts">
import { ref, reactive } from 'vue'

const draggable = ref(true)
const resizable = ref(true)

const layout = reactive([
  { x: 0, y: 0, w: 2, h: 2, i: '0', static: false },
  { x: 2, y: 0, w: 2, h: 4, i: '1', static: true },
  { x: 4, y: 0, w: 2, h: 5, i: '2', static: false },
  { x: 6, y: 0, w: 2, h: 3, i: '3', static: false },
  { x: 8, y: 0, w: 2, h: 3, i: '4', static: false },
  { x: 10, y: 0, w: 2, h: 3, i: '5', static: false },
  { x: 0, y: 5, w: 2, h: 5, i: '6', static: false },
  { x: 2, y: 5, w: 2, h: 5, i: '7', static: false },
  { x: 4, y: 5, w: 2, h: 5, i: '8', static: false },
  { x: 6, y: 3, w: 2, h: 4, i: '9', static: true },
  { x: 8, y: 4, w: 2, h: 4, i: '10', static: false },
  { x: 10, y: 4, w: 2, h: 4, i: '11', static: false },
  { x: 0, y: 10, w: 2, h: 5, i: '12', static: false },
  { x: 2, y: 10, w: 2, h: 5, i: '13', static: false },
  { x: 4, y: 8, w: 2, h: 4, i: '14', static: false },
  { x: 6, y: 8, w: 2, h: 4, i: '15', static: false },
  { x: 8, y: 10, w: 2, h: 5, i: '16', static: false },
  { x: 10, y: 4, w: 2, h: 2, i: '17', static: false },
  { x: 0, y: 9, w: 2, h: 3, i: '18', static: false },
  { x: 2, y: 6, w: 2, h: 2, i: '19', static: false }
])
</script>

<template>
  <GridLayout
    v-model:layout="layout"
    :col-num="12"
    :row-height="30"
    :is-draggable="draggable"
    :is-resizable="resizable"
    :vertical-compact="true"
    :use-css-transforms="true"
  >
    <GridItem
      v-for="item in layout"
      :key="item.i"
      :static="item.static"
      :x="item.x"
      :y="item.y"
      :w="item.w"
      :h="item.h"
      :i="item.i"
    >
      <span class="text">{{ `${item.i}${item.static ? '- Static' : ''}` }}</span>
    </GridItem>
  </GridLayout>
</template>

<style scoped>
.vue-grid-layout {
  background: #eee;
}

.vue-grid-item:not(.vue-grid-placeholder) {
  background: #ccc;
  border: 1px solid black;
}

.vue-grid-item .resizing {
  opacity: 90%;
}

.vue-grid-item .static {
  background: #cce;
}

.vue-grid-item .text {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: auto;
  font-size: 24px;
  text-align: center;
}
</style>
