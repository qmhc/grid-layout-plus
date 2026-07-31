<script setup lang="ts">
import { reactive, ref, watch } from 'vue'

import type { Layout } from 'grid-layout-plus'

interface DemoEventLog {
  key: number
  type: string
  item: string
  detail: string
}

const MAX_EVENT_LOGS = 50

const layout = ref([
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
  { x: 4, y: 10, w: 2, h: 4, i: '14', static: false },
  { x: 6, y: 8, w: 2, h: 4, i: '15', static: false },
  { x: 8, y: 10, w: 2, h: 5, i: '16', static: false },
  { x: 10, y: 8, w: 2, h: 2, i: '17', static: false },
  { x: 0, y: 15, w: 2, h: 3, i: '18', static: false },
  { x: 2, y: 15, w: 2, h: 2, i: '19', static: false },
])

const eventLogs = reactive<DemoEventLog[]>([])
let eventSequence = 0
let layoutReady = false

const eventsDiv = ref<HTMLElement>()

watch(
  () => eventLogs.length,
  () => {
    requestAnimationFrame(() => {
      if (eventsDiv.value) {
        eventsDiv.value.scrollTop = eventsDiv.value.scrollHeight
      }
    })
  },
)

function logEvent(type: string, item: string, detail: string) {
  eventLogs.push({
    key: ++eventSequence,
    type,
    item,
    detail,
  })
  if (eventLogs.length > MAX_EVENT_LOGS) {
    eventLogs.splice(0, eventLogs.length - MAX_EVENT_LOGS)
  }
  console.info(`${type} ${item}: ${detail}`)
}

function clearEvents() {
  eventLogs.splice(0)
}

function moveEvent(i: string, newX: number, newY: number) {
  logEvent('move', `item ${i}`, `x=${newX}, y=${newY}`)
}

function movedEvent(i: string, newX: number, newY: number) {
  logEvent('moved', `item ${i}`, `x=${newX}, y=${newY}`)
}

function resizeEvent(i: string, newH: number, newW: number, newHPx: number, newWPx: number) {
  logEvent('resize', `item ${i}`, `w=${newW}, h=${newH} · ${newWPx}×${newHPx}px`)
}

function resizedEvent(i: string, newX: number, newY: number, newHPx: number, newWPx: number) {
  logEvent('resized', `item ${i}`, `x=${newX}, y=${newY} · ${newWPx}×${newHPx}px`)
}

function containerResizedEvent(
  i: string,
  newH: number,
  newW: number,
  newHPx: number,
  newWPx: number,
) {
  if (!layoutReady) return
  logEvent('container-resized', `item ${i}`, `w=${newW}, h=${newH} · ${newWPx}×${newHPx}px`)
}

function layoutBeforeMountEvent(newLayout: Layout) {
  layoutReady = false
  logEvent('layout-before-mount', 'layout', `${newLayout.length} items`)
}

function layoutMountedEvent(newLayout: Layout) {
  logEvent('layout-mounted', 'layout', `${newLayout.length} items`)
}

function layoutReadyEvent(newLayout: Layout) {
  logEvent('layout-ready', 'layout', `${newLayout.length} items`)
  layoutReady = true
}

function layoutUpdatedEvent(newLayout: Layout) {
  logEvent('layout-updated', 'layout', `${newLayout.length} items`)
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <Tag class="demo-state demo-state--accent" type="primary" simple circle>
        {{ eventLogs.length }} / {{ MAX_EVENT_LOGS }} events
      </Tag>
      <Tag v-if="eventLogs.length" class="demo-state" simple circle>
        Latest: {{ eventLogs[eventLogs.length - 1].type }}
      </Tag>
      <Button button-type="button" :disabled="eventLogs.length === 0" @click="clearEvents">
        Clear events
      </Button>
    </div>
    <div ref="eventsDiv" class="demo-log" role="log" aria-label="Grid event log">
      <p v-if="eventLogs.length === 0" class="demo-empty">
        Interact with the grid to record events.
      </p>
      <ol v-else class="demo-log__list">
        <li v-for="event in eventLogs" :key="event.key" class="demo-log__entry">
          <strong class="demo-log__type">{{ event.type }}</strong>
          <span class="demo-log__item">{{ event.item }}</span>
          <code class="demo-log__detail">{{ event.detail }}</code>
        </li>
      </ol>
    </div>
    <GridLayout
      v-model:layout="layout"
      class="demo-grid"
      :row-height="30"
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
        <span class="demo-item__label">
          {{ item.i }}<template v-if="item.static"> · Static</template>
        </span>
      </GridItem>
    </GridLayout>
  </section>
</template>
