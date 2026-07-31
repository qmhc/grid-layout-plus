<script setup lang="ts">
import { ref } from 'vue'

import { GridBackground } from 'grid-layout-plus'

import type { Layout } from 'grid-layout-plus'

const defaultColor = '#64748b'

function createLayout(): Layout {
  return [
    { x: 0, y: 0, w: 2, h: 2, i: '0' },
    { x: 2, y: 0, w: 2, h: 3, i: '1' },
    { x: 4, y: 0, w: 2, h: 2, i: '2' },
    { x: 0, y: 3, w: 2, h: 2, i: '3' },
  ]
}

const color = ref(defaultColor)
const strokeWidth = ref(1)
const layout = ref(createLayout())

function handleStrokeWidthChange(value: number) {
  if (!Number.isFinite(value)) {
    strokeWidth.value = 1
  }
}

function resetDemo() {
  color.value = defaultColor
  strokeWidth.value = 1
  layout.value = createLayout()
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <div class="demo-control">
        <span>Line color</span>
        <ColorPicker
          v-model:value="color"
          format="hex"
          show-label
          aria-label="Grid line color"
        ></ColorPicker>
      </div>
      <div class="demo-control">
        <span>Stroke width</span>
        <NumberInput
          v-model:value="strokeWidth"
          class="stroke-input"
          :min="1"
          :max="5"
          :control-attrs="{ 'aria-label': 'Grid line stroke width' }"
          @change="handleStrokeWidthChange"
        ></NumberInput>
        <span>px</span>
      </div>
      <Button button-type="button" @click="resetDemo"> Reset demo </Button>
    </div>
    <dl class="demo-metrics">
      <div class="demo-metric">
        <dt>Renderer</dt>
        <dd>GridBackground</dd>
      </div>
      <div class="demo-metric">
        <dt>Columns</dt>
        <dd>6</dd>
      </div>
      <div class="demo-metric">
        <dt>Row height</dt>
        <dd>30px</dd>
      </div>
    </dl>
    <GridLayout v-model:layout="layout" class="demo-grid" :col-num="6" :row-height="30">
      <GridBackground :color="color" :stroke-width="strokeWidth"></GridBackground>
      <GridItem v-for="item in layout" :key="item.i" v-bind="item">
        <span class="demo-item__label">{{ item.i }}</span>
      </GridItem>
    </GridLayout>
  </section>
</template>

<style scoped>
.stroke-input {
  width: 68px;
}
</style>
