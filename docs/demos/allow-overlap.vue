<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

import type {
  CollisionMode,
  GridLayoutExpose,
  InteractionStartPayload,
  InteractionTerminalPayload,
  Layout,
  LayoutUpdateMeta,
  ReadonlyLayout,
} from 'grid-layout-plus'

function createLayout(): Layout {
  return [
    { x: 0, y: 0, w: 4, h: 3, i: '0' },
    { x: 2, y: 1, w: 4, h: 3, i: '1' },
    { x: 6, y: 0, w: 3, h: 2, i: '2' },
    { x: 7, y: 1, w: 3, h: 3, i: '3' },
    { x: 0, y: 5, w: 2, h: 2, i: '4' },
    { x: 3, y: 5, w: 2, h: 2, i: '5' },
  ]
}

const grid = ref<GridLayoutExpose>()
const allowOverlap = ref(true)
const layout = ref(createLayout())
const selectedId = ref('0')
const activeId = ref<string | null>(null)
const lastAction = ref('None')

const itemOptions = computed(() => {
  return layout.value.map(item => ({
    label: String(item.i),
    value: String(item.i),
  }))
})
const collisionMode = computed<CollisionMode>(() => {
  return allowOverlap.value ? 'overlap' : 'push'
})
const topItemId = computed(() => {
  return layout.value.reduce((top, item) => {
    if (!top || (item.zIndex ?? 0) >= (top.zIndex ?? 0)) return item
    return top
  }, layout.value[0])?.i
})

function handleInteractionStart(payload: InteractionStartPayload) {
  activeId.value = String(payload.id)
  selectedId.value = String(payload.id)
  lastAction.value = `${payload.type} started · item ${payload.id} raised`
}

function handleInteractionEnd(payload: InteractionTerminalPayload) {
  activeId.value = null
  lastAction.value = `${payload.type} ${payload.status} · ${payload.reason}`
}

function handleLayoutUpdated(_nextLayout: ReadonlyLayout, meta: LayoutUpdateMeta) {
  if (meta.source === 'programmatic') {
    lastAction.value = `Layer updated · item ${selectedId.value}`
  }
}

function bringSelectedToFront() {
  grid.value?.bringToFront(selectedId.value)
}

function sendSelectedToBack() {
  grid.value?.sendToBack(selectedId.value)
}

async function resetDemo() {
  allowOverlap.value = true
  await nextTick()
  layout.value = createLayout()
  selectedId.value = '0'
  activeId.value = null
  lastAction.value = 'Reset · overlap mode'
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <Checkbox v-model:checked="allowOverlap"> Allow overlap </Checkbox>
      <div class="demo-control">
        <span class="demo-control__label">Selected item</span>
        <Select
          v-model:value="selectedId"
          :options="itemOptions"
          aria-label="Item to reorder"
        ></Select>
      </div>
      <Button button-type="button" @click="bringSelectedToFront"> Bring to front </Button>
      <Button button-type="button" @click="sendSelectedToBack"> Send to back </Button>
      <Button button-type="button" @click="resetDemo"> Reset demo </Button>
    </div>
    <div class="demo-toolbar">
      <Tag class="demo-state demo-state--accent" type="primary" simple circle>
        Collision: {{ collisionMode }}
      </Tag>
      <Tag class="demo-state" simple circle> Top item: {{ topItemId }} </Tag>
      <Tag class="demo-state" simple circle> Last action: {{ lastAction }} </Tag>
    </div>
    <GridLayout
      ref="grid"
      v-model:layout="layout"
      class="demo-grid"
      :collision-mode="collisionMode"
      :row-height="30"
      @interaction-start="handleInteractionStart"
      @interaction-end="handleInteractionEnd"
      @layout-updated="handleLayoutUpdated"
    >
      <template #item="{ item }">
        <span class="demo-item__label" :data-demo-item="item.i">
          {{ item.i }}
          <small v-if="String(item.i) === activeId">Active</small>
          <small v-else-if="item.i === topItemId">Top</small>
        </span>
      </template>
    </GridLayout>
  </section>
</template>

<style scoped>
.demo-item__label {
  align-content: center;
}

.demo-item__label small {
  display: block;
  font-size: 11px;
  color: var(--demo-muted);
}
</style>
