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
  <div style="margin-top:10px;">
    <h4>Grid #1</h4>
    <GridLayout
      v-model:layout="layout"
      :col-num="12"
      :row-height="30"
      :is-draggable="true"
      :is-resizable="true"
      :vertical-compact="true"
      :use-css-transforms="true"
    >
      <GridItem
        v-for="item in layout"
        :key="item.i"
        :x="item.x"
        :y="item.y"
        :w="item.w"
        :h="item.h"
        :i="item.i"
      >
        <span class="text">{{ item.i }}</span>
      </GridItem>
    </GridLayout>
  </div>
  <div style="margin-top:10px;">
    <h4>Grid #2</h4>
    <GridLayout
      :layout="layout2"
      :col-num="12"
      :row-height="30"
      :is-draggable="true"
      :is-resizable="true"
      :vertical-compact="true"
      :use-css-transforms="true"
    >
      <GridItem
        v-for="item in layout2"
        :key="item.i"
        :x="item.x"
        :y="item.y"
        :w="item.w"
        :h="item.h"
        :i="item.i"
      >
        <span class="text">{{ item.i }}</span>
      </GridItem>
    </GridLayout>
  </div>
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
