<script setup lang="ts">
import { ref } from 'vue'

import { useContainerWidth, useGridLayout } from 'grid-layout-plus'

import type { Layout } from 'grid-layout-plus'

const containerRef = ref<HTMLElement | null>(null)
const { width } = useContainerWidth(containerRef)

const initialLayout: Layout = [
  { x: 0, y: 0, w: 2, h: 2, i: '0' },
  { x: 2, y: 0, w: 2, h: 3, i: '1' },
  { x: 4, y: 0, w: 2, h: 2, i: '2' },
  { x: 6, y: 0, w: 2, h: 3, i: '3' },
]

const sourceLayout = ref<Layout>(initialLayout)

const { currentLayout, moveItem, addItem, removeItem } = useGridLayout({
  layout: sourceLayout,
  cols: 12,
  rowHeight: 30,
})

let nextId = 4

function handleAdd() {
  addItem({ x: 0, y: 0, w: 2, h: 2, i: String(nextId++) })
}

function handleRemoveLast() {
  const items = currentLayout.value
  if (items.length > 0) {
    removeItem(items[items.length - 1].i)
  }
}
</script>

<template>
  <div style="margin-bottom: 10px">
    <button type="button" @click="handleAdd">
      Add Item
    </button>
    <button type="button" style="margin-left: 8px" @click="handleRemoveLast">
      Remove Last
    </button>
    <span style="margin-left: 12px; color: #666">
      Container width: {{ width }}px | Items: {{ currentLayout.length }}
    </span>
  </div>
  <div ref="containerRef" class="headless-grid">
    <div
      v-for="item in currentLayout"
      :key="item.i"
      class="headless-item"
    >
      <span class="text">{{ item.i }} ({{ item.x }},{{ item.y }} {{ item.w }}×{{ item.h }})</span>
    </div>
  </div>
</template>

<style scoped>
.headless-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 100px;
  padding: 10px;
  background-color: #eee;
  border: 1px dashed #999;
}

.headless-item {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  background-color: #ccc;
  border: 1px solid black;
}

.text {
  font-size: 14px;
  text-align: center;
}
</style>
