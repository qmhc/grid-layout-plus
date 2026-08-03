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

interface ExternalSource {
  key: string
  label: string
  detail: string
  w: number
  h: number
  blocked?: boolean
}

const sources: readonly ExternalSource[] = [
  { key: 'note', label: 'Note', detail: '2 × 2 payload', w: 2, h: 2 },
  { key: 'wide', label: 'Wide card', detail: '4 × 2 payload', w: 4, h: 2 },
  {
    key: 'blocked',
    label: 'Restricted card',
    detail: 'Rejected by source policy',
    w: 3,
    h: 2,
    blocked: true,
  },
]

function createLayout(): Layout {
  return [
    { x: 0, y: 0, w: 3, h: 2, i: '0' },
    { x: 3, y: 0, w: 3, h: 3, i: '1' },
    { x: 6, y: 0, w: 3, h: 2, i: '2' },
    { x: 9, y: 0, w: 3, h: 3, i: '3' },
  ]
}

const layout = ref(createLayout())
const activeSource = ref<ExternalSource | null>(null)
const status = ref('Choose a source and drag it into the target')
const statusTone = ref<StatusTone>('neutral')
const candidate = ref('None')
let nextId = 1
let droppedInGesture = false

const statusTypeByTone = {
  neutral: 'default',
  accent: 'primary',
  success: 'success',
  warning: 'warning',
} as const
const dropConfig: DropConfig = {
  isDroppable: true,
  dropItem: { w: 2, h: 2 },
  onDragOver() {
    const source = activeSource.value
    if (!source || source.blocked) return false
    return { w: source.w, h: source.h }
  },
  createItem() {
    const source = activeSource.value
    if (!source) return false
    return { i: `external-${nextId++}`, x: 0, y: 0, w: source.w, h: source.h }
  },
}

const statusType = computed(() => statusTypeByTone[statusTone.value])
const statusClass = computed(() => {
  return {
    'demo-state--accent': statusTone.value === 'accent',
    'demo-state--success': statusTone.value === 'success',
    'demo-state--warning': statusTone.value === 'warning',
  }
})

function handleSourceDragStart(source: ExternalSource, event: DragEvent) {
  activeSource.value = source
  droppedInGesture = false
  if (source.blocked) {
    status.value = 'Restricted by source policy · no drop candidate'
    statusTone.value = 'warning'
    candidate.value = 'None'
  } else {
    status.value = `Dragging ${source.label}`
    statusTone.value = 'accent'
    candidate.value = `${source.w} × ${source.h}`
  }
  event.dataTransfer?.setData(
    'application/x-grid-layout-plus',
    JSON.stringify({ type: source.key, w: source.w, h: source.h }),
  )
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
}

function handleDropDragOver(context: DropDragOverContext) {
  const source = activeSource.value
  candidate.value = `${context.candidate.w} × ${context.candidate.h} at (${context.candidate.x}, ${context.candidate.y})`
  status.value = source ? `${source.label} accepted by target` : 'Candidate accepted'
  statusTone.value = 'accent'
}

function handleOperationRejected(payload: OperationRejectedPayload) {
  if (payload.operation !== 'drop') return
  status.value = `Rejected · ${payload.reason}`
  statusTone.value = 'warning'
  candidate.value = 'None'
}

function handleDrop(result: DropCommitResult) {
  const source = activeSource.value
  if (!source) return

  const id = String(result.item.i)
  droppedInGesture = true
  status.value = `Dropped ${source.label} · ${id}`
  statusTone.value = 'success'
  candidate.value = `${result.item.w} × ${result.item.h} at (${result.item.x}, ${result.item.y})`
}

function handleDropDragLeave() {
  if (statusTone.value === 'warning') return
  status.value = 'Left target · nothing added'
  statusTone.value = 'neutral'
  candidate.value = 'None'
}

function handleSourceDragEnd() {
  if (!droppedInGesture && statusTone.value === 'accent') {
    status.value = 'Drag ended outside the target'
    statusTone.value = 'neutral'
    candidate.value = 'None'
  }
  activeSource.value = null
}

function resetDemo() {
  layout.value = createLayout()
  activeSource.value = null
  status.value = 'Reset · choose a source'
  statusTone.value = 'neutral'
  candidate.value = 'None'
  nextId = 1
  droppedInGesture = false
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <Tag class="demo-state demo-state--accent" type="primary" simple circle>
        Custom external payloads
      </Tag>
      <Tag class="demo-state" :class="statusClass" :type="statusType" simple circle>
        {{ status }}
      </Tag>
      <Button button-type="button" @click="resetDemo"> Reset demo </Button>
    </div>
    <div class="demo-drop-workspace">
      <Card class="demo-panel" title="External sources" shadow="never">
        <template #extra>
          <Tag class="demo-state" simple circle> {{ sources.length }} payloads </Tag>
        </template>
        <div class="demo-drop-sources">
          <div
            v-for="source in sources"
            :key="source.key"
            class="demo-drag-source"
            :class="{ 'demo-drag-source--blocked': source.blocked }"
            :data-source="source.key"
            draggable="true"
            @dragstart="handleSourceDragStart(source, $event)"
            @dragend="handleSourceDragEnd"
          >
            <strong>{{ source.label }}</strong>
            <small>{{ source.detail }}</small>
          </div>
        </div>
      </Card>
      <Card class="demo-panel" title="Drop target" shadow="never">
        <template #extra>
          <Tag class="demo-state" simple circle> Candidate: {{ candidate }} </Tag>
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
