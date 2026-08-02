<script setup lang="ts">
import { ref } from 'vue'

import type { Layout } from 'grid-layout-plus'

function createLayout(): Layout {
  return [
    { x: 0, y: 0, w: 2, h: 2, i: '0' },
    { x: 2, y: 0, w: 2, h: 3, i: '1', static: true },
    { x: 4, y: 0, w: 2, h: 2, i: '2' },
    { x: 6, y: 0, w: 2, h: 3, i: '3' },
    { x: 8, y: 0, w: 2, h: 2, i: '4' },
    { x: 10, y: 0, w: 2, h: 3, i: '5' },
  ]
}

const layout = ref(createLayout())

function resetDemo() {
  layout.value = createLayout()
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <Tag class="demo-state demo-state--accent" type="primary" simple circle>
        CSS-only grid lines
      </Tag>
      <Tag class="demo-state" simple circle> 12 columns </Tag>
      <Tag class="demo-state" simple circle> 40px row pitch </Tag>
      <Button button-type="button" @click="resetDemo"> Reset layout </Button>
    </div>
    <GridLayout v-model:layout="layout" class="demo-grid css-grid-lines" :row-height="30">
      <template #item="{ item }">
        <span class="demo-item__label">{{ `${item.i}${item.static ? ' · Static' : ''}` }}</span>
      </template>
    </GridLayout>
  </section>
</template>

<style scoped>
.css-grid-lines.vgl-layout::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  content: '';
  background-image:
    linear-gradient(to right, var(--demo-border-subtle) 1px, transparent 1px),
    linear-gradient(to bottom, var(--demo-border-subtle) 1px, transparent 1px);
  background-repeat: repeat;
  background-position: -5px -5px;
  background-size: calc((100% + 10px) / 12) 40px;
}
</style>
