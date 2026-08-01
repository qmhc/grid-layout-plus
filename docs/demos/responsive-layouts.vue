<script setup lang="ts">
import { computed, ref } from 'vue'

import type {
  Breakpoint,
  Layout,
  LayoutUpdateMeta,
  ReadonlyLayout,
  ResponsiveLayoutsInput,
  WidthChangedPayload,
} from 'grid-layout-plus'

const defaultCols: Record<Breakpoint, number> = {
  lg: 12,
  md: 10,
  sm: 6,
  xs: 4,
  xxs: 2,
}
const explicitPresets = new Set<Breakpoint>(['md', 'lg'])

function createResponsiveLayouts(): ResponsiveLayoutsInput {
  return {
    md: [
      { x: 0, y: 0, w: 2, h: 2, i: '0' },
      { x: 2, y: 0, w: 2, h: 3, i: '1' },
      { x: 4, y: 0, w: 2, h: 2, i: '2' },
      { x: 6, y: 0, w: 2, h: 3, i: '3' },
      { x: 8, y: 0, w: 2, h: 2, i: '4' },
      { x: 0, y: 3, w: 2, h: 2, i: '5' },
    ],
    lg: [
      { x: 0, y: 0, w: 2, h: 2, i: '0' },
      { x: 2, y: 0, w: 2, h: 3, i: '1' },
      { x: 4, y: 0, w: 2, h: 2, i: '2' },
      { x: 6, y: 0, w: 2, h: 3, i: '3' },
      { x: 8, y: 0, w: 2, h: 2, i: '4' },
      { x: 10, y: 0, w: 2, h: 3, i: '5' },
    ],
  }
}

function cloneLayout(layout: ReadonlyLayout): Layout {
  return layout.map(item => ({ ...item }))
}

const responsiveLayouts = ref<ResponsiveLayoutsInput>(createResponsiveLayouts())
const layout = ref(cloneLayout(responsiveLayouts.value.lg ?? []))
const containerWidth = ref(0)
const currentBreakpoint = ref<Breakpoint | null>(null)
const currentCols = ref(12)
const lastAction = ref('Waiting for container measurement')

const layoutSource = computed(() => {
  if (!currentBreakpoint.value) return 'Waiting'
  return explicitPresets.has(currentBreakpoint.value) ? 'Explicit preset' : 'Generated fallback'
})

function handleWidthChanged(payload: WidthChangedPayload) {
  containerWidth.value = Math.round(payload.width)
  currentBreakpoint.value = payload.committed.breakpoint
  currentCols.value = payload.committed.cols
}

function handleBreakpointChanged(
  breakpoint: Breakpoint | null,
  nextLayout: ReadonlyLayout,
  _meta: LayoutUpdateMeta,
) {
  currentBreakpoint.value = breakpoint
  currentCols.value = breakpoint ? defaultCols[breakpoint] : 12
  lastAction.value = breakpoint
    ? `${breakpoint} loaded · ${nextLayout.length} items`
    : 'Responsive mode inactive'
}

function resetDemo() {
  responsiveLayouts.value = createResponsiveLayouts()
  lastAction.value = 'Presets restored'
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <Tag class="demo-state demo-state--accent" type="primary" simple circle>
        Responsive layouts
      </Tag>
      <Tag class="demo-state" simple circle> {{ lastAction }} </Tag>
      <Button button-type="button" @click="resetDemo"> Reset presets </Button>
    </div>
    <dl class="demo-metrics">
      <div class="demo-metric">
        <dt>Width</dt>
        <dd>{{ containerWidth }}px</dd>
      </div>
      <div class="demo-metric">
        <dt>Breakpoint</dt>
        <dd>{{ currentBreakpoint ?? 'measuring' }}</dd>
      </div>
      <div class="demo-metric">
        <dt>Columns</dt>
        <dd>{{ currentCols }}</dd>
      </div>
      <div class="demo-metric">
        <dt>Layout source</dt>
        <dd>{{ layoutSource }}</dd>
      </div>
      <div class="demo-metric">
        <dt>Items</dt>
        <dd>{{ layout.length }}</dd>
      </div>
    </dl>
    <GridLayout
      v-model:layout="layout"
      v-model:responsive-layouts="responsiveLayouts"
      class="demo-grid"
      :row-height="30"
      responsive
      @breakpoint-changed="handleBreakpointChanged"
      @width-changed="handleWidthChanged"
    >
      <template #item="{ item }">
        <span class="demo-item__label">{{ item.i }}</span>
      </template>
    </GridLayout>
  </section>
</template>
