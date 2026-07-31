<script setup lang="ts">
import { ref } from 'vue'

import { noCompactor } from 'grid-layout-plus'

import type { InteractionTerminalPayload, Layout } from 'grid-layout-plus'

function createLayout(): Layout {
  return [
    { x: 0, y: 0, w: 2, h: 2, i: '0' },
    { x: 3, y: 1, w: 2, h: 3, i: '1' },
    { x: 6, y: 4, w: 3, h: 2, i: '2' },
    { x: 1, y: 6, w: 2, h: 2, i: '3' },
    { x: 9, y: 0, w: 2, h: 3, i: '4' },
    { x: 5, y: 8, w: 2, h: 2, i: '5' },
  ]
}

const layout = ref(createLayout())
const lastAction = ref('Original gaps preserved')

function handleInteractionEnd(payload: InteractionTerminalPayload) {
  lastAction.value =
    payload.status === 'committed'
      ? `${payload.type} committed · surrounding gaps kept`
      : `${payload.status} · ${payload.reason}`
}

function resetDemo() {
  layout.value = createLayout()
  lastAction.value = 'Reset · original gaps preserved'
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <Tag class="demo-state demo-state--accent" type="primary" simple circle>
        Compaction: none
      </Tag>
      <Tag class="demo-state" simple circle> {{ lastAction }} </Tag>
      <Button button-type="button" @click="resetDemo"> Reset layout </Button>
    </div>
    <GridLayout
      v-model:layout="layout"
      class="demo-grid no-compact-grid"
      :compactor="noCompactor"
      :row-height="30"
      @interaction-end="handleInteractionEnd"
    >
      <template #item="{ item }">
        <span class="demo-item__label">
          {{ item.i }}
          <small>{{ item.x }}, {{ item.y }}</small>
        </span>
      </template>
    </GridLayout>
  </section>
</template>

<style scoped>
.no-compact-grid.vgl-layout {
  background-color: var(--demo-canvas);
  background-image:
    linear-gradient(to right, var(--demo-border-subtle) 1px, transparent 1px),
    linear-gradient(to bottom, var(--demo-border-subtle) 1px, transparent 1px);
  background-position: 5px 5px;
  background-size: calc((100% - 10px) / 12) 40px;
}

.demo-item__label {
  align-content: center;
}

.demo-item__label small {
  display: block;
  font-size: 11px;
  color: var(--demo-muted);
}
</style>
