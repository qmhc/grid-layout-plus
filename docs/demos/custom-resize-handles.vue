<script setup lang="ts">
import { ref } from 'vue'

import type {
  InteractionStartPayload,
  InteractionTerminalPayload,
  Layout,
  ResizeConfig,
  ResizeHandleAxis,
} from 'grid-layout-plus'

const resizeConfig: ResizeConfig = {
  handles: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'],
}

const directionGlyph: Record<ResizeHandleAxis, string> = {
  n: '↑',
  ne: '↗',
  e: '→',
  se: '↘',
  s: '↓',
  sw: '↙',
  w: '←',
  nw: '↖',
}

function createLayout(): Layout {
  return [
    { x: 0, y: 0, w: 6, h: 4, i: '0' },
    { x: 6, y: 0, w: 6, h: 4, i: '1', resizeHandles: ['e', 's', 'se'] },
    { x: 0, y: 4, w: 12, h: 3, i: '2', resizeHandles: ['n', 'w', 'nw'] },
  ]
}

const layout = ref(createLayout())
const lastAction = ref('Waiting · resize from a custom arrow handle')

function handleInteractionStart(payload: InteractionStartPayload) {
  if (payload.type === 'resize') lastAction.value = `Resizing item ${payload.id}`
}

function handleInteractionEnd(payload: InteractionTerminalPayload) {
  if (payload.type === 'resize') lastAction.value = `Resized item ${payload.id}`
}

function itemLabel(id: string) {
  if (id === '0') return 'Item 0 · all 8 custom handles'
  if (id === '1') return 'Item 1 · E / S / SE'
  return 'Item 2 · N / W / NW'
}

function resetDemo() {
  layout.value = createLayout()
  lastAction.value = 'Reset · resize from a custom arrow handle'
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
      :row-height="40"
      @interaction-end="handleInteractionEnd"
      @interaction-start="handleInteractionStart"
    >
      <template #item="{ item }">
        <span class="demo-item__label" :data-custom-resize-item="item.i">
          {{ itemLabel(String(item.i)) }}
        </span>
      </template>
      <template #resize-handle="{ item, axis, direction }">
        <span
          class="demo-custom-resize-handle"
          data-testid="custom-resize-handle"
          :data-resize-axis="axis"
          :data-resize-direction="direction"
          :data-resize-item="item.i"
        >
          {{ directionGlyph[direction] }}
        </span>
      </template>
    </GridLayout>
  </section>
</template>
