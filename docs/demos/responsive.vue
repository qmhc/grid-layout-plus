<script setup lang="ts">
import { nextTick, ref } from 'vue'

import type {
  Breakpoint,
  InteractionTerminalPayload,
  Layout,
  LayoutUpdateMeta,
  ReadonlyLayout,
  WidthChangedPayload,
} from 'grid-layout-plus'

const defaultCols: Record<Breakpoint, number> = {
  lg: 12,
  md: 10,
  sm: 6,
  xs: 4,
  xxs: 2,
}
const defaultBreakpoints: ReadonlyArray<readonly [Breakpoint, number]> = [
  ['lg', 1200],
  ['md', 996],
  ['sm', 768],
  ['xs', 480],
  ['xxs', 0],
]

function createLayout(): Layout {
  return [
    { x: 0, y: 0, w: 2, h: 2, i: '0' },
    { x: 2, y: 0, w: 2, h: 3, i: '1' },
    { x: 4, y: 0, w: 2, h: 2, i: '2' },
    { x: 6, y: 0, w: 2, h: 3, i: '3' },
    { x: 8, y: 0, w: 2, h: 2, i: '4' },
    { x: 10, y: 0, w: 2, h: 3, i: '5' },
    { x: 0, y: 3, w: 2, h: 2, i: '6' },
    { x: 2, y: 3, w: 2, h: 2, i: '7' },
    { x: 4, y: 3, w: 2, h: 2, i: '8' },
    { x: 6, y: 3, w: 2, h: 2, i: '9' },
  ]
}

const draggable = ref(true)
const resizable = ref(true)
const responsive = ref(true)
const gridContainer = ref<HTMLElement>()
const layout = ref(createLayout())
const containerWidth = ref(0)
const currentBreakpoint = ref<Breakpoint | null>(null)
const currentCols = ref(12)
const lastAction = ref('Waiting for container measurement')

function resolveBreakpoint(width: number): Breakpoint {
  return defaultBreakpoints.find(([, minimum]) => width >= minimum)?.[0] ?? 'xxs'
}

function applyMeasurement(width: number) {
  containerWidth.value = Math.round(width)
  if (!responsive.value) {
    currentBreakpoint.value = null
    currentCols.value = 12
    return
  }

  const breakpoint = resolveBreakpoint(width)
  currentBreakpoint.value = breakpoint
  currentCols.value = defaultCols[breakpoint]
}

function handleWidthChanged(payload: WidthChangedPayload) {
  applyMeasurement(payload.width)
}

function handleBreakpointChanged(
  breakpoint: Breakpoint | null,
  _nextLayout: ReadonlyLayout,
  _meta: LayoutUpdateMeta,
) {
  currentBreakpoint.value = breakpoint
  currentCols.value = breakpoint ? defaultCols[breakpoint] : 12
  lastAction.value = breakpoint ? `Breakpoint changed to ${breakpoint}` : 'Responsive mode disabled'
}

function handleLayoutReady(_nextLayout: ReadonlyLayout) {
  const width = gridContainer.value?.clientWidth ?? 0
  applyMeasurement(width)
  lastAction.value = currentBreakpoint.value
    ? `Measured · ${currentBreakpoint.value} breakpoint`
    : 'Measured · fixed 12 columns'
}

function handleInteractionEnd(payload: InteractionTerminalPayload) {
  lastAction.value = `${payload.type} ${payload.status} · ${payload.reason}`
}

async function handleResponsiveToggle() {
  lastAction.value = responsive.value
    ? 'Responsive mode enabled · measuring'
    : 'Responsive mode disabled · 12 columns'
  await nextTick()
  applyMeasurement(gridContainer.value?.clientWidth ?? 0)
}

async function resetDemo() {
  draggable.value = true
  resizable.value = true
  responsive.value = false
  await nextTick()
  layout.value = createLayout()
  await nextTick()
  responsive.value = true
  await nextTick()
  applyMeasurement(gridContainer.value?.clientWidth ?? 0)
  lastAction.value = 'Reset · responsive mode enabled'
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <Checkbox v-model:checked="responsive" @change="handleResponsiveToggle">
        Responsive
      </Checkbox>
      <Checkbox v-model:checked="draggable"> Draggable </Checkbox>
      <Checkbox v-model:checked="resizable"> Resizable </Checkbox>
      <Button button-type="button" @click="resetDemo"> Reset demo </Button>
    </div>
    <dl class="demo-metrics">
      <div class="demo-metric">
        <dt>Width</dt>
        <dd>{{ containerWidth }}px</dd>
      </div>
      <div class="demo-metric">
        <dt>Breakpoint</dt>
        <dd>{{ responsive ? (currentBreakpoint ?? 'measuring') : 'off' }}</dd>
      </div>
      <div class="demo-metric">
        <dt>Columns</dt>
        <dd>{{ responsive ? currentCols : 12 }}</dd>
      </div>
      <div class="demo-metric">
        <dt>Items</dt>
        <dd>{{ layout.length }}</dd>
      </div>
    </dl>
    <Tag class="demo-state demo-state--accent" type="primary" simple circle>
      {{ lastAction }}
    </Tag>
    <div ref="gridContainer">
      <GridLayout
        v-model:layout="layout"
        class="demo-grid"
        :is-draggable="draggable"
        :is-resizable="resizable"
        :responsive="responsive"
        :row-height="30"
        @breakpoint-changed="handleBreakpointChanged"
        @interaction-end="handleInteractionEnd"
        @layout-ready="handleLayoutReady"
        @width-changed="handleWidthChanged"
      >
        <template #item="{ item }">
          <span class="demo-item__label">{{ item.i }}</span>
        </template>
      </GridLayout>
    </div>
    <Collapse class="demo-collapse" card>
      <CollapsePanel label="coordinates" title="Current logical coordinates">
        <ul class="demo-coordinate-list" role="list">
          <li v-for="item in layout" :key="item.i">
            <code>{{ item.i }}: [{{ item.x }}, {{ item.y }}, {{ item.w }}, {{ item.h }}]</code>
          </li>
        </ul>
      </CollapsePanel>
    </Collapse>
  </section>
</template>
