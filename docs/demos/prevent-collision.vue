<script setup lang="ts">
import { ref } from 'vue'

import { noCompactor } from 'grid-layout-plus'

import type {
  InteractionChangePayload,
  InteractionStartPayload,
  InteractionTerminalPayload,
  Layout,
  OperationRejectedPayload,
} from 'grid-layout-plus'

function createLayout(): Layout {
  return [
    { x: 0, y: 0, w: 3, h: 2, i: '0' },
    { x: 4, y: 0, w: 3, h: 3, i: '1', static: true },
    { x: 8, y: 0, w: 3, h: 2, i: '2' },
    { x: 0, y: 4, w: 3, h: 2, i: '3' },
    { x: 4, y: 4, w: 3, h: 2, i: '4' },
    { x: 8, y: 4, w: 3, h: 2, i: '5' },
  ]
}

const layout = ref(createLayout())
const interactionStatus = ref('Waiting · drag a movable item toward the obstacle')
const lastRejection = ref<OperationRejectedPayload | null>(null)

function handleInteractionStart(payload: InteractionStartPayload) {
  lastRejection.value = null
  interactionStatus.value = `${payload.type} active · item ${payload.id}`
}

function handleInteractionChange(_payload: InteractionChangePayload) {
  lastRejection.value = null
}

function handlePointerMove() {
  if (lastRejection.value) {
    interactionStatus.value = 'Candidate valid · release to commit'
  }
  lastRejection.value = null
}

function handleOperationRejected(payload: OperationRejectedPayload) {
  if (payload.operation !== 'move' && payload.operation !== 'resize') return
  lastRejection.value = payload
  interactionStatus.value = `Rejected · ${payload.reason}`
}

function handleInteractionEnd(payload: InteractionTerminalPayload) {
  const rejection = lastRejection.value
  lastRejection.value = null
  if (rejection) {
    interactionStatus.value =
      payload.status === 'committed'
        ? `Last candidate rejected · ${rejection.reason}; committed last valid position`
        : `Rejected · ${rejection.reason}; item ${payload.id} returned`
    return
  }

  if (payload.status === 'committed') {
    interactionStatus.value = `Accepted · ${payload.type} committed for item ${payload.id}`
  } else if (payload.status === 'unchanged') {
    interactionStatus.value = `Returned · item ${payload.id} stayed in place`
  } else {
    interactionStatus.value = `Cancelled · ${payload.reason}`
  }
}

function resetDemo() {
  layout.value = createLayout()
  lastRejection.value = null
  interactionStatus.value = 'Reset · drag a movable item toward the obstacle'
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <Tag class="demo-state demo-state--accent" type="primary" simple circle>
        Collision: prevent
      </Tag>
      <Tag class="demo-state" simple circle> Compaction: none </Tag>
      <Tag class="demo-state" simple circle> {{ interactionStatus }} </Tag>
      <Button button-type="button" @click="resetDemo"> Reset layout </Button>
    </div>
    <GridLayout
      v-model:layout="layout"
      class="demo-grid"
      :compactor="noCompactor"
      :row-height="30"
      collision-mode="prevent"
      @interaction-change="handleInteractionChange"
      @interaction-start="handleInteractionStart"
      @interaction-end="handleInteractionEnd"
      @operation-rejected="handleOperationRejected"
      @pointermove="handlePointerMove"
    >
      <template #item="{ item }">
        <span class="demo-item__label">
          {{ item.i }}<template v-if="item.static"> · Static obstacle</template>
        </span>
      </template>
    </GridLayout>
  </section>
</template>
