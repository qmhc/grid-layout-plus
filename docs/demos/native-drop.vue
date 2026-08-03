<script setup lang="ts">
import { computed, ref } from 'vue'

import type {
  DropCommitResult,
  DropConfig,
  DropDragOverContext,
  Layout,
  OperationRejectedPayload,
} from 'grid-layout-plus'

type StatusTone = 'neutral' | 'accent' | 'success' | 'warning'

function createLayout(): Layout {
  return [
    { x: 0, y: 0, w: 2, h: 2, i: '0' },
    { x: 2, y: 0, w: 2, h: 3, i: '1' },
    { x: 4, y: 0, w: 2, h: 2, i: '2' },
    { x: 6, y: 0, w: 2, h: 3, i: '3' },
    { x: 8, y: 0, w: 2, h: 2, i: '4' },
    { x: 10, y: 0, w: 2, h: 3, i: '5' },
  ]
}

const layout = ref(createLayout())
const isDroppable = ref(true)
const dropStatus = ref('Waiting · drag the source into the target')
const statusTone = ref<StatusTone>('neutral')
let nextId = 6
let droppedInGesture = false
const dropConfig = computed<DropConfig>(() => ({
  isDroppable: isDroppable.value,
  dropItem: { w: 2, h: 2 },
  createItem: () => ({ i: String(nextId++), x: 0, y: 0, w: 2, h: 2 }),
}))

const statusTypeByTone = {
  neutral: 'default',
  accent: 'primary',
  success: 'success',
  warning: 'warning',
} as const
const statusType = computed(() => statusTypeByTone[statusTone.value])
const statusClass = computed(() => {
  return {
    'demo-state--accent': statusTone.value === 'accent',
    'demo-state--success': statusTone.value === 'success',
    'demo-state--warning': statusTone.value === 'warning',
  }
})

function handleSourceDragStart(event: DragEvent) {
  droppedInGesture = false
  if (!isDroppable.value) {
    dropStatus.value = 'Disabled · enable the drop target first'
    statusTone.value = 'warning'
  } else {
    dropStatus.value = 'Dragging source'
    statusTone.value = 'accent'
  }
  event.dataTransfer?.setData('text/plain', 'grid item')
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
}

function handleDropDragOver(context: DropDragOverContext) {
  const { x, y } = context.candidate
  dropStatus.value = `Accepted preview · (${x}, ${y})`
  statusTone.value = 'accent'
}

function handleDrop(result: DropCommitResult) {
  const id = String(result.item.i)
  droppedInGesture = true
  dropStatus.value = `Dropped item ${id} · (${result.item.x}, ${result.item.y})`
  statusTone.value = 'success'
}

function handleDropDragLeave() {
  dropStatus.value = 'Left target · nothing added'
  statusTone.value = 'neutral'
}

function handleOperationRejected(payload: OperationRejectedPayload) {
  if (payload.operation !== 'drop') return
  dropStatus.value = `Rejected · ${payload.reason}`
  statusTone.value = 'warning'
}

function handleSourceDragEnd() {
  if (!droppedInGesture && statusTone.value === 'accent') {
    dropStatus.value = 'Drag ended outside the target'
    statusTone.value = 'neutral'
  }
}

function handleDroppableChange() {
  dropStatus.value = isDroppable.value
    ? 'Enabled · drag the source into the target'
    : 'Disabled · drop events will be ignored'
  statusTone.value = isDroppable.value ? 'neutral' : 'warning'
}

function resetDemo() {
  layout.value = createLayout()
  isDroppable.value = true
  dropStatus.value = 'Reset · drop target enabled'
  statusTone.value = 'neutral'
  nextId = 6
  droppedInGesture = false
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <Checkbox v-model:checked="isDroppable" @change="handleDroppableChange">
        Drop target enabled
      </Checkbox>
      <Tag class="demo-state" :class="statusClass" :type="statusType" simple circle>
        {{ dropStatus }}
      </Tag>
      <Button button-type="button" @click="resetDemo"> Reset demo </Button>
    </div>
    <div class="demo-drop-workspace">
      <Card class="demo-panel" title="Native source" shadow="never">
        <div
          class="demo-drag-source"
          data-source="native"
          draggable="true"
          @dragstart="handleSourceDragStart"
          @dragend="handleSourceDragEnd"
        >
          <strong>New grid item</strong>
          <small>Fixed 2 × 2 candidate</small>
        </div>
      </Card>
      <Card class="demo-panel" title="Drop target" shadow="never">
        <template #extra>
          <Tag class="demo-state" simple circle> {{ layout.length }} items </Tag>
        </template>
        <GridLayout
          v-model:layout="layout"
          class="demo-grid"
          :drop-config="dropConfig"
          :row-height="30"
          @drop-drag-over="handleDropDragOver"
          @drop="handleDrop"
          @drop-drag-leave="handleDropDragLeave"
          @operation-rejected="handleOperationRejected"
        >
          <template #item="{ item }">
            <span class="demo-item__label">{{ item.i }}</span>
          </template>
        </GridLayout>
      </Card>
    </div>
  </section>
</template>
