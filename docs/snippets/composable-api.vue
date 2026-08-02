<script setup lang="ts">
import { ref } from 'vue'

import { useGridLayout } from 'grid-layout-plus'

import type { Layout } from 'grid-layout-plus'

const sourceLayout = ref<Layout>([
  { x: 0, y: 0, w: 2, h: 2, i: 'a' },
  { x: 2, y: 0, w: 2, h: 3, i: 'b' },
])

const { layout, addItem, moveItem, removeItem } = useGridLayout({
  layout: sourceLayout,
  cols: 6,
  rowHeight: 30,
  gap: [8, 8],
  containerPadding: [10, 10],
})

function add() {
  addItem({ x: 0, y: 0, w: 2, h: 2, i: `item-${layout.value.length}` })
}
</script>

<template>
  <button type="button" @click="add">
    <span>Add item</span>
  </button>
  <button type="button" @click="moveItem('a', 1, 0)">
    <span>Move item a</span>
  </button>
  <button type="button" @click="removeItem('b')">
    <span>Remove item b</span>
  </button>

  <pre>{{ layout }}</pre>
</template>
