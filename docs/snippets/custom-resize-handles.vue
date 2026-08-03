<script setup lang="ts">
import { ref } from 'vue'

import { GridLayout } from 'grid-layout-plus'

import type { Layout, ResizeConfig, ResizeHandleAxis } from 'grid-layout-plus'

const resizeConfig: ResizeConfig = {
  handles: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'],
}
const glyphs: Record<ResizeHandleAxis, string> = {
  n: '↑',
  ne: '↗',
  e: '→',
  se: '↘',
  s: '↓',
  sw: '↙',
  w: '←',
  nw: '↖',
}
const layout = ref<Layout>([
  { x: 0, y: 0, w: 6, h: 3, i: 'all' },
  { x: 6, y: 0, w: 6, h: 3, i: 'limited', resizeHandles: ['e', 's', 'se'] },
])
</script>

<template>
  <GridLayout
    v-model:layout="layout"
    :is-draggable="false"
    :resize-config="resizeConfig"
    :row-height="30"
  >
    <template #item="{ item }">
      {{ item.i }}
    </template>
    <template #resize-handle="{ axis, direction }">
      <span class="custom-handle" :data-axis="axis">{{ glyphs[direction] }}</span>
    </template>
  </GridLayout>
</template>
