<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

import { absoluteStrategy, scaledStrategy, transformStrategy } from 'grid-layout-plus'

import type { InteractionTerminalPayload, Layout, PositionStrategy } from 'grid-layout-plus'

type StrategyName = 'transform' | 'absolute' | 'scaled'

const scale = 0.75
const strategies: Record<StrategyName, () => PositionStrategy> = {
  transform: () => transformStrategy,
  absolute: () => absoluteStrategy,
  scaled: () => scaledStrategy(scale),
}
const strategyOptions = [
  { label: 'Transform', value: 'transform' },
  { label: 'Absolute', value: 'absolute' },
  { label: 'Scaled container (75%)', value: 'scaled' },
]

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

const strategyName = ref<StrategyName>('transform')
const layout = ref(createLayout())
const lastAction = ref('None')

const currentStrategy = computed(() => strategies[strategyName.value]())
const implementation = computed(() => {
  if (strategyName.value === 'absolute') {
    return { fields: 'top / left', scale: '1×', summary: 'Absolute CSS positioning' }
  }
  if (strategyName.value === 'scaled') {
    return { fields: 'transform', scale: `${scale}×`, summary: 'Scale-aware transforms' }
  }
  return { fields: 'translate3d', scale: '1×', summary: 'GPU-friendly transforms' }
})
const scaledContainerStyle = computed(() => {
  if (strategyName.value !== 'scaled') return
  return {
    width: `${100 / scale}%`,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  }
})

function handleStrategyChange() {
  lastAction.value = `Switched to ${strategyName.value}`
}

function handleInteractionEnd(payload: InteractionTerminalPayload) {
  lastAction.value = `${payload.type} ${payload.status} · logical coordinates committed`
}

async function resetDemo() {
  strategyName.value = 'transform'
  await nextTick()
  layout.value = createLayout()
  lastAction.value = 'Reset · transform strategy'
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <div class="demo-control">
        <span class="demo-control__label">Position strategy</span>
        <Select
          v-model:value="strategyName"
          :options="strategyOptions"
          aria-label="Position strategy"
          @change="handleStrategyChange"
        ></Select>
      </div>
      <Tag class="demo-state demo-state--accent" type="primary" simple circle>
        {{ implementation.summary }}
      </Tag>
      <Tag class="demo-state" simple circle> Last action: {{ lastAction }} </Tag>
      <Button button-type="button" @click="resetDemo"> Reset demo </Button>
    </div>
    <dl class="demo-metrics">
      <div class="demo-metric">
        <dt>Position fields</dt>
        <dd>{{ implementation.fields }}</dd>
      </div>
      <div class="demo-metric">
        <dt>Visual scale</dt>
        <dd>{{ implementation.scale }}</dd>
      </div>
      <div class="demo-metric">
        <dt>Logical grid</dt>
        <dd>12 columns</dd>
      </div>
    </dl>
    <div class="strategy-stage">
      <div :style="scaledContainerStyle">
        <GridLayout
          v-model:layout="layout"
          class="demo-grid"
          :position-strategy="currentStrategy"
          :row-height="30"
          @interaction-end="handleInteractionEnd"
        >
          <template #item="{ item }">
            <span class="demo-item__label">{{ `${item.i} · (${item.x}, ${item.y})` }}</span>
          </template>
        </GridLayout>
      </div>
    </div>
  </section>
</template>

<style scoped>
.strategy-stage {
  min-width: 0;
  overflow: hidden;
  background: var(--demo-canvas);
  border: 1px solid var(--demo-border-subtle);
  border-radius: 8px;
}
</style>
