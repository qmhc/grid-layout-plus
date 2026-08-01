<script setup lang="ts">
import { computed, ref } from 'vue'

import { useContainerWidth, useGridLayout } from 'grid-layout-plus'

import type { Layout, LayoutOperationResult } from 'grid-layout-plus'

const cols = 6
const rowHeight = 30
const margin = [8, 8] as const
const containerPadding = [10, 10] as const

function createLayout(): Layout {
  return [
    { x: 0, y: 0, w: 2, h: 2, i: '0' },
    { x: 2, y: 0, w: 2, h: 3, i: '1' },
    { x: 4, y: 0, w: 2, h: 2, i: '2' },
    { x: 0, y: 3, w: 2, h: 2, i: '3' },
  ]
}

const containerRef = ref<HTMLElement | null>(null)
const { width } = useContainerWidth(containerRef)
const sourceLayout = ref<Layout>(createLayout())
const lastOperation = ref('None')

const { layout, containerHeight, moveItem, addItem, removeItem, setLayout } = useGridLayout({
  layout: sourceLayout,
  cols,
  rowHeight,
  margin,
  containerPadding,
})

let nextId = 4

function report(operation: string, result: LayoutOperationResult) {
  lastOperation.value =
    result.status === 'rejected'
      ? `${operation}: rejected (${result.reason})`
      : `${operation}: ${result.status}`
}

const cellWidth = computed(() => {
  if (width.value === null) return 0
  const available = width.value - containerPadding[0] * 2 - margin[0] * Math.max(0, cols - 1)
  return Math.max(0, available / cols)
})

function getItemStyle(item: Layout[number]) {
  const itemWidth = item.w * cellWidth.value + Math.max(0, item.w - 1) * margin[0]
  const itemHeight = item.h * rowHeight + Math.max(0, item.h - 1) * margin[1]
  const left = containerPadding[0] + item.x * (cellWidth.value + margin[0])
  const top = containerPadding[1] + item.y * (rowHeight + margin[1])
  return {
    width: `${itemWidth}px`,
    height: `${itemHeight}px`,
    transform: `translate3d(${left}px, ${top}px, 0)`,
  }
}

function handleAdd() {
  report('add', addItem({ x: 0, y: 0, w: 2, h: 2, i: String(nextId++) }))
}

function handleMoveFirst() {
  const item = layout.value[0]
  if (item) {
    report('move', moveItem(item.i, (item.x + 1) % (cols - item.w + 1), item.y))
  }
}

function handleRemoveLast() {
  const items = layout.value
  if (items.length > 0) {
    report('remove', removeItem(items[items.length - 1].i))
  }
}

function resetDemo() {
  report('reset', setLayout(createLayout()))
  nextId = 4
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <Button button-type="button" type="primary" @click="handleAdd">Add item</Button>
      <Button button-type="button" :disabled="!layout.length" @click="handleMoveFirst">
        Move first
      </Button>
      <Button
        button-type="button"
        type="error"
        :disabled="!layout.length"
        @click="handleRemoveLast"
      >
        Remove last
      </Button>
      <Button button-type="button" @click="resetDemo">Reset demo</Button>
    </div>
    <dl class="demo-metrics">
      <div class="demo-metric">
        <dt>Container</dt>
        <dd>{{ width === null ? 'measuring' : `${Math.round(width)}px` }}</dd>
      </div>
      <div class="demo-metric">
        <dt>Items</dt>
        <dd>{{ layout.length }}</dd>
      </div>
      <div class="demo-metric">
        <dt>Columns</dt>
        <dd>{{ cols }}</dd>
      </div>
      <div class="demo-metric">
        <dt>Last result</dt>
        <dd>{{ lastOperation }}</dd>
      </div>
    </dl>
    <div ref="containerRef" class="headless-grid" :style="{ height: `${containerHeight}px` }">
      <div v-for="item in layout" :key="item.i" class="headless-item" :style="getItemStyle(item)">
        <span>{{ item.i }}</span>
        <small>{{ item.x }},{{ item.y }} · {{ item.w }}×{{ item.h }}</small>
      </div>
      <p v-if="!layout.length" class="demo-empty">No items yet</p>
    </div>
  </section>
</template>

<style scoped>
.headless-grid {
  position: relative;
  min-height: 100px;
  overflow: hidden;
  background: var(--demo-canvas);
  border: 1px solid var(--demo-border-subtle);
  border-radius: 8px;
}

.headless-item {
  position: absolute;
  top: 0;
  left: 0;
  display: grid;
  align-content: center;
  color: var(--demo-text);
  text-align: center;
  background: var(--demo-item);
  border: 1px solid var(--demo-border);
  transition: transform 160ms ease;
}

.headless-item small {
  color: var(--demo-muted);
}
</style>
