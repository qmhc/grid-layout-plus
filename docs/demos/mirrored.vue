<script setup lang="ts">
import { computed, ref } from 'vue'

import type { InteractionTerminalPayload, Layout } from 'grid-layout-plus'

function createLayout(): Layout {
  return [
    { x: 0, y: 0, w: 3, h: 2, i: '0' },
    { x: 3, y: 0, w: 3, h: 3, i: '1', static: true },
    { x: 6, y: 0, w: 3, h: 2, i: '2' },
    { x: 9, y: 0, w: 3, h: 3, i: '3' },
    { x: 0, y: 3, w: 4, h: 2, i: '4' },
    { x: 7, y: 4, w: 3, h: 2, i: '5' },
  ]
}

const draggable = ref(true)
const resizable = ref(true)
const mirrored = ref(true)
const layout = ref(createLayout())
const lastAction = ref('None')

const originLabel = computed(() => {
  return mirrored.value
    ? 'Right origin · x increases to the left'
    : 'Left origin · x increases to the right'
})

function handleInteractionEnd(payload: InteractionTerminalPayload) {
  lastAction.value = `${payload.type} ${payload.status} · ${payload.reason}`
}

function resetDemo() {
  draggable.value = true
  resizable.value = true
  mirrored.value = true
  layout.value = createLayout()
  lastAction.value = 'Reset · mirrored from the right'
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <Checkbox v-model:checked="mirrored"> Mirrored </Checkbox>
      <Checkbox v-model:checked="draggable"> Draggable </Checkbox>
      <Checkbox v-model:checked="resizable"> Resizable </Checkbox>
      <Button button-type="button" @click="resetDemo"> Reset demo </Button>
    </div>
    <div class="demo-toolbar">
      <Tag class="demo-state demo-state--accent" type="primary" simple circle>
        {{ originLabel }}
      </Tag>
      <Tag class="demo-state" simple circle> Last action: {{ lastAction }} </Tag>
    </div>
    <div class="mirror-axis" :class="{ 'mirror-axis--right': mirrored }" aria-hidden="true">
      <strong>origin x=0</strong>
      <span>{{ mirrored ? '← x increases' : 'x increases →' }}</span>
    </div>
    <GridLayout
      v-model:layout="layout"
      class="demo-grid"
      :is-draggable="draggable"
      :is-mirrored="mirrored"
      :is-resizable="resizable"
      :row-height="30"
      @interaction-end="handleInteractionEnd"
    >
      <template #item="{ item }">
        <span class="demo-item__label">
          {{ item.i }}<template v-if="item.static"> · Static</template> · x={{ item.x }}
        </span>
      </template>
    </GridLayout>
  </section>
</template>

<style scoped>
.mirror-axis {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  padding: 0 10px;
  color: var(--demo-muted);
  border-bottom: 2px solid var(--demo-accent);
}

.mirror-axis--right {
  flex-direction: row-reverse;
}
</style>
