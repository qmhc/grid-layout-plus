<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

import { absoluteStrategy, transformStrategy } from 'grid-layout-plus'

import type { PositionStrategy } from 'grid-layout-plus'

const strategyName = ref<'transform' | 'absolute'>('transform')

const strategies: Record<string, () => PositionStrategy> = {
  transform: () => transformStrategy,
  absolute: () => absoluteStrategy,
}

const currentStrategy = computed(() => strategies[strategyName.value]())

const layout = reactive([
  { x: 0, y: 0, w: 2, h: 2, i: '0' },
  { x: 2, y: 0, w: 2, h: 4, i: '1' },
  { x: 4, y: 0, w: 2, h: 3, i: '2' },
  { x: 6, y: 0, w: 2, h: 3, i: '3' },
  { x: 8, y: 0, w: 2, h: 3, i: '4' },
  { x: 10, y: 0, w: 2, h: 3, i: '5' },
])
</script>

<template>
  <div style="margin-bottom: 10px">
    <label>
      Position Strategy:
      <select v-model="strategyName">
        <option value="transform">Transform (translate3d)</option>
        <option value="absolute">Absolute (top/left)</option>
      </select>
    </label>
  </div>
  <GridLayout
    v-model:layout="layout"
    :position-strategy="currentStrategy"
    :row-height="30"
  >
    <template #item="{ item }">
      <span class="text">{{ item.i }}</span>
    </template>
  </GridLayout>
</template>

<style scoped>
.vgl-layout {
  background-color: #eee;
}

:deep(.vgl-item:not(.vgl-item--placeholder)) {
  background-color: #ccc;
  border: 1px solid black;
}

:deep(.vgl-item--resizing) {
  opacity: 90%;
}

:deep(.vgl-item--static) {
  background-color: #cce;
}

.text {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: auto;
  font-size: 24px;
  text-align: center;
}
</style>
