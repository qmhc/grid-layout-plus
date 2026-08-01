<script setup lang="ts">
import { ref } from 'vue'

import type { Layout, ReadonlyLayout } from 'grid-layout-plus'

function createLayout(): Layout {
  return [
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
    { x: 2, y: 6, w: 2, h: 2, i: '19', static: false },
  ]
}

const layout = ref(createLayout())
const resetReady = ref(false)
let resetLayoutSnapshot: Layout | null = null

function cloneLayout(source: ReadonlyLayout): Layout {
  return source.map(item => ({ ...item }))
}

function captureResetLayout(nextLayout: ReadonlyLayout) {
  if (!resetLayoutSnapshot) {
    resetLayoutSnapshot = cloneLayout(nextLayout)
    resetReady.value = true
  }
}

function resetLayout() {
  layout.value = resetLayoutSnapshot ? cloneLayout(resetLayoutSnapshot) : createLayout()
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <Tag class="demo-state demo-state--accent" type="primary" simple circle>
        {{ layout.length }} items
      </Tag>
      <Tag class="demo-state" simple circle> 2 static </Tag>
      <Button button-type="button" :disabled="!resetReady" @click="resetLayout">
        Reset layout
      </Button>
    </div>
    <GridLayout
      v-model:layout="layout"
      class="demo-grid"
      :row-height="30"
      @layout-ready="captureResetLayout"
    >
      <template #item="{ item }">
        <span class="demo-item__label">
          {{ `${item.i}${item.static ? ' · Static' : ''}` }}
        </span>
      </template>
    </GridLayout>
  </section>
</template>
