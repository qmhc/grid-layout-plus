<script setup lang="ts">
import { ref } from 'vue'

import { GridLayout } from 'grid-layout-plus'

import type { Layout } from 'grid-layout-plus'

let nextId = 3
const layout = ref<Layout>([
  { x: 0, y: 0, w: 3, h: 2, i: '0' },
  { x: 3, y: 0, w: 3, h: 2, i: '1' },
  { x: 6, y: 0, w: 3, h: 2, i: '2' },
])

function addItem() {
  layout.value.push({ x: 0, y: layout.value.length * 2, w: 3, h: 2, i: String(nextId++) })
}

function removeLastItem() {
  layout.value.pop()
}
</script>

<template>
  <button type="button" @click="addItem">
    <span>Add item</span>
  </button>
  <button type="button" :disabled="!layout.length" @click="removeLastItem">
    <span>Remove last</span>
  </button>

  <GridLayout v-model:layout="layout" :row-height="30">
    <template #item="{ item }">
      {{ item.i }}
    </template>
  </GridLayout>
</template>
