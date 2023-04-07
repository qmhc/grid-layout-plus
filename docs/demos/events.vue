<script setup lang="ts">
import { ref, reactive, watch } from 'vue'

import type { Layout } from 'grid-layout-plus'

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

const eventLog = reactive<string[]>([])

const eventsDiv = ref<HTMLElement>()

watch(() => eventLog.length, () => {
  requestAnimationFrame(() => {
    if (eventsDiv.value) {
      eventsDiv.value.scrollTop = eventsDiv.value.scrollHeight
    }
  })
})

function moveEvent(i: string, newX: number, newY: number) {
  const msg = 'MOVE i=' + i + ', X=' + newX + ', Y=' + newY
  this.eventLog.push(msg)
  console.info(msg)
}

function movedEvent(i: string, newX: number, newY: number) {
  const msg = 'MOVED i=' + i + ', X=' + newX + ', Y=' + newY
  this.eventLog.push(msg)
  console.info(msg)
}

function resizeEvent(i: string, newH: number, newW: number, newHPx: number, newWPx: number) {
  const msg = 'RESIZE i=' + i + ', H=' + newH + ', W=' + newW + ', H(px)=' + newHPx + ', W(px)=' + newWPx
  this.eventLog.push(msg)
  console.info(msg)
}

function resizedEvent(i: string, newX: number, newY: number, newHPx: number, newWPx: number) {
  const msg = 'RESIZED i=' + i + ', X=' + newX + ', Y=' + newY + ', H(px)=' + newHPx + ', W(px)=' + newWPx
  this.eventLog.push(msg)
  console.info(msg)
}

function containerResizedEvent(i: string, newH: number, newW: number, newHPx: number, newWPx: number) {
  const msg = 'CONTAINER RESIZED i=' + i + ', H=' + newH + ', W=' + newW + ', H(px)=' + newHPx + ', W(px)=' + newWPx
  this.eventLog.push(msg)
  console.info(msg)
}

function layoutCreatedEvent(newLayout: Layout) {
  this.eventLog.push('Created layout')
  console.info('Created layout: ', newLayout)
}

function layoutBeforeMountEvent(newLayout: Layout) {
  this.eventLog.push('beforeMount layout')
  console.info('beforeMount layout: ', newLayout)
}

function layoutMountedEvent(newLayout: Layout) {
  this.eventLog.push('Mounted layout')
  console.info('Mounted layout: ', newLayout)
}

function layoutReadyEvent(newLayout: Layout) {
  this.eventLog.push('Ready layout')
  console.info('Ready layout: ', newLayout)
}

function layoutUpdatedEvent(newLayout: Layout) {
  this.eventLog.push('Updated layout')
  console.info('Updated layout: ', newLayout)
}
</script>

<template>
  <div>
    <div ref="eventsDiv" class="event-logs">
      <div v-for="(event, index) in eventLog" :key="index">
        {{ event }}
      </div>
    </div>
    <div style="margin-top:10px;">
      <grid-layout
        v-model:layout="layout"
        :col-num="12"
        :row-height="30"
        :is-draggable="draggable"
        :is-resizable="resizable"
        :vertical-compact="true"
        :use-css-transforms="true"
        @layout-created="layoutCreatedEvent"
        @layout-before-mount="layoutBeforeMountEvent"
        @layout-mounted="layoutMountedEvent"
        @layout-ready="layoutReadyEvent"
        @layout-updated="layoutUpdatedEvent"
      >
        <GridItem
          v-for="item in layout"
          :key="item.i"
          :x="item.x"
          :y="item.y"
          :w="item.w"
          :h="item.h"
          :i="item.i"
          @resize="resizeEvent"
          @move="moveEvent"
          @resized="resizedEvent"
          @container-resized="containerResizedEvent"
          @moved="movedEvent"
        >
          <span class="text">{{ item.i }}</span>
        </GridItem>
      </grid-layout>
    </div>
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

.event-logs {
  height: 100px;
  padding: 10px;
  margin-top: 10px;
  overflow-y: scroll;
  background-color: #ddd;
  border: 1px solid black;
}
</style>
