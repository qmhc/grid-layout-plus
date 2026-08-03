<script setup lang="ts">
import { ref } from 'vue'

import type { Layout, ResizeConfig } from 'grid-layout-plus'

const resizeConfig: ResizeConfig = {
  handles: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'],
}

function createLayout(): Layout {
  return [
    { x: 0, y: 0, w: 4, h: 3, i: '0', resizeHandles: ['e', 's', 'se'] },
    { x: 4, y: 0, w: 4, h: 4, i: '1' },
    { x: 8, y: 0, w: 4, h: 3, i: '2' },
    { x: 0, y: 3, w: 4, h: 3, i: '3' },
    { x: 4, y: 4, w: 4, h: 3, i: '4' },
    { x: 8, y: 3, w: 4, h: 4, i: '5' },
  ]
}

const layout = ref(createLayout())
const lastAction = ref('Waiting · resize from any edge or corner')

function handleResize(id: string) {
  lastAction.value = `Resizing item ${id}`
}

function handleResized(id: string) {
  lastAction.value = `Resized item ${id}`
}

function itemLabel(id: string) {
  if (id === '0') return 'Item 0 · E / S / SE only'
  if (id === '4') return 'Item 4 · try N / NE / NW'
  return `Item ${id}`
}

function resetDemo() {
  layout.value = createLayout()
  lastAction.value = 'Reset · resize from any edge or corner'
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <Tag class="demo-state demo-state--accent" type="primary" simple circle>
        {{ lastAction }}
      </Tag>
      <Button button-type="button" @click="resetDemo"> Reset layout </Button>
    </div>
    <GridLayout
      v-model:layout="layout"
      class="demo-grid"
      :is-draggable="false"
      :resize-config="resizeConfig"
      :row-height="30"
    >
      <GridItem
        v-for="item in layout"
        :key="item.i"
        :i="item.i"
        @resize="handleResize"
        @resized="handleResized"
      >
        <span class="demo-item__label">{{ itemLabel(item.i) }}</span>
      </GridItem>
    </GridLayout>
  </section>
</template>
