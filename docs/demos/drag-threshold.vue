<script setup lang="ts">
import { ref } from 'vue'

import type { InteractionStartPayload, InteractionTerminalPayload, Layout } from 'grid-layout-plus'

const threshold = ref(10)
const interactionStatus = ref('Waiting for pointer movement')

function createLayout(): Layout {
  return [
    { x: 0, y: 0, w: 2, h: 2, i: '0' },
    { x: 2, y: 0, w: 2, h: 4, i: '1' },
    { x: 4, y: 0, w: 2, h: 5, i: '2' },
    { x: 6, y: 0, w: 2, h: 3, i: '3' },
    { x: 8, y: 0, w: 2, h: 3, i: '4' },
    { x: 10, y: 0, w: 2, h: 3, i: '5' },
    { x: 0, y: 5, w: 2, h: 5, i: '6' },
    { x: 2, y: 5, w: 2, h: 5, i: '7' },
    { x: 4, y: 5, w: 2, h: 5, i: '8' },
    { x: 6, y: 4, w: 2, h: 4, i: '9' },
  ]
}

const layout = ref(createLayout())

function handleInteractionStart(payload: InteractionStartPayload) {
  if (payload.type !== 'drag') return
  interactionStatus.value = `Active · item ${payload.id} crossed ${threshold.value}px`
}

function handleInteractionEnd(payload: InteractionTerminalPayload) {
  if (payload.type !== 'drag') return
  interactionStatus.value = `${payload.status} · ${payload.reason}`
}

function handleThresholdChange(value: number) {
  if (!Number.isFinite(value)) {
    threshold.value = 10
  }
}

function resetDemo() {
  threshold.value = 10
  layout.value = createLayout()
  interactionStatus.value = 'Reset · waiting for pointer movement'
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <div class="demo-control">
        <span>Drag threshold</span>
        <NumberInput
          v-model:value="threshold"
          class="threshold-input"
          :min="0"
          :max="100"
          :control-attrs="{ 'aria-label': 'Drag threshold in pixels' }"
          @input="interactionStatus = 'Waiting for pointer movement'"
          @change="handleThresholdChange"
        ></NumberInput>
        <span>px</span>
      </div>
      <Tag class="demo-state demo-state--accent" type="primary" simple circle>
        {{ interactionStatus }}
      </Tag>
      <Button button-type="button" @click="resetDemo"> Reset demo </Button>
    </div>
    <GridLayout
      v-model:layout="layout"
      class="demo-grid"
      :drag-threshold="threshold"
      :row-height="30"
      @interaction-start="handleInteractionStart"
      @interaction-end="handleInteractionEnd"
    >
      <template #item="{ item }">
        <span class="demo-item__label">{{ item.i }}</span>
      </template>
    </GridLayout>
  </section>
</template>

<style scoped>
.threshold-input {
  width: 76px;
}
</style>
