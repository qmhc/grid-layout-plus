<script setup lang="ts">
import { nextTick, ref } from 'vue'

import { horizontalCompactor, verticalCompactor } from 'grid-layout-plus'

import type { Layout } from 'grid-layout-plus'

type CompactMode = 'vertical' | 'horizontal'

const compactors = { vertical: verticalCompactor, horizontal: horizontalCompactor }
const compactOptions = [
  { label: 'Horizontal', value: 'horizontal' },
  { label: 'Vertical', value: 'vertical' },
]

function createLayout(): Layout {
  return [
    { x: 0, y: 0, w: 2, h: 2, i: '0' },
    { x: 3, y: 1, w: 2, h: 3, i: '1' },
    { x: 6, y: 0, w: 2, h: 2, i: '2' },
    { x: 9, y: 2, w: 2, h: 3, i: '3' },
    { x: 3, y: 6, w: 2, h: 2, i: '4' },
    { x: 8, y: 6, w: 2, h: 2, i: '5' },
  ]
}

const compactMode = ref<CompactMode>('horizontal')
const layout = ref(createLayout())
const lastAction = ref('Horizontal compaction applied')

async function handleModeChange(value: string | number | boolean) {
  if (value !== 'horizontal' && value !== 'vertical') return
  const nextMode = value as CompactMode
  layout.value = createLayout()
  await nextTick()
  compactMode.value = nextMode
  lastAction.value = `${nextMode} compaction applied`
}

async function resetDemo() {
  if (compactMode.value === 'horizontal') {
    compactMode.value = 'vertical'
    await nextTick()
  }
  layout.value = createLayout()
  await nextTick()
  compactMode.value = 'horizontal'
  lastAction.value = 'Reset · horizontal compaction'
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <div class="demo-control">
        <span class="demo-control__label">Compaction direction</span>
        <Select
          :value="compactMode"
          :options="compactOptions"
          aria-label="Compaction direction"
          @change="handleModeChange"
        ></Select>
      </div>
      <Tag class="demo-state demo-state--accent" type="primary" simple circle>
        Direction: {{ compactMode }}
      </Tag>
      <Tag class="demo-state" simple circle> {{ lastAction }} </Tag>
      <Button button-type="button" @click="resetDemo"> Reset demo </Button>
    </div>
    <GridLayout
      v-model:layout="layout"
      class="demo-grid"
      :compactor="compactors[compactMode]"
      :row-height="30"
    >
      <template #item="{ item }">
        <span class="demo-item__label">{{ item.i }}</span>
      </template>
    </GridLayout>
  </section>
</template>
