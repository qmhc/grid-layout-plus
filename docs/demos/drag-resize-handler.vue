<script setup lang="ts">
import { ref } from 'vue'

import type { Layout } from 'grid-layout-plus'

function createLayout(): Layout {
  return [
    { x: 0, y: 0, w: 4, h: 3, i: '0' },
    { x: 4, y: 0, w: 4, h: 4, i: '1' },
    { x: 8, y: 0, w: 4, h: 3, i: '2' },
    { x: 0, y: 3, w: 4, h: 3, i: '3' },
    { x: 4, y: 4, w: 4, h: 3, i: '4' },
    { x: 8, y: 3, w: 4, h: 4, i: '5' },
  ]
}

const layout = ref(createLayout())
const lastAction = ref('Waiting · move only from a labeled handle')

function handleClick(id: string) {
  lastAction.value = `Clicked item ${id} · no drag started`
}

function handleMove(id: string) {
  lastAction.value = `Moving item ${id}`
}

function handleMoved(id: string) {
  lastAction.value = `Moved item ${id}`
}

function resetDemo() {
  layout.value = createLayout()
  lastAction.value = 'Reset · move only from a labeled handle'
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
      :is-resizable="false"
      :row-height="30"
    >
      <GridItem
        v-for="item in layout"
        :key="item.i"
        :i="item.i"
        drag-allow-from=".demo-drag-handle"
        drag-ignore-from=".demo-no-drag"
        @move="handleMove"
        @moved="handleMoved"
      >
        <div class="handler-item">
          <div class="demo-drag-handle" :title="`Drag item ${item.i}`">Drag item {{ item.i }}</div>
          <div class="demo-no-drag">
            <Button
              class="handler-action"
              button-type="button"
              :aria-label="`Click item ${item.i} without dragging`"
              @click.stop="handleClick(item.i)"
            >
              Click without dragging
            </Button>
          </div>
        </div>
      </GridItem>
    </GridLayout>
  </section>
</template>

<style scoped>
.handler-item {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: 44px minmax(0, 1fr);
  width: 100%;
  height: 100%;
}

.demo-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 44px;
  padding: 0 6px;
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  color: var(--demo-accent, #2859b8);
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: grab;
  background: var(--demo-accent-soft, #dbe7ff);
  border-bottom: 1px solid var(--demo-border, #64748b);
}

.demo-drag-handle:active {
  cursor: grabbing;
}

.demo-no-drag {
  display: grid;
  place-items: center;
  min-width: 0;
  min-height: 0;
  padding: 6px;
}

.handler-action {
  max-width: 100%;
  min-height: 44px;
  padding: 0 8px;
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
