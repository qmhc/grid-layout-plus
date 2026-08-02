<script setup lang="ts">
import { ref } from 'vue'

import type { Layout } from 'grid-layout-plus'

const bounded = ref(true)

function createLayout(): Layout {
  return [
    { x: 0, y: 0, w: 3, h: 2, i: '0' },
    { x: 3, y: 0, w: 3, h: 2, i: '1' },
    { x: 6, y: 0, w: 3, h: 2, i: '2' },
    { x: 9, y: 0, w: 3, h: 2, i: '3' },
  ]
}

const layout = ref(createLayout())

function resetLayout() {
  layout.value = createLayout()
}
</script>

<template>
  <section class="demo-root demo-shell bounded-demo">
    <div class="demo-toolbar">
      <Checkbox v-model:checked="bounded"> is-bounded </Checkbox>
      <Tag
        :class="['demo-state', bounded ? 'demo-state--success' : 'demo-state--warning']"
        :type="bounded ? 'success' : 'warning'"
        simple
        circle
      >
        {{ bounded ? 'Bounded: on' : 'Bounded: off' }}
      </Tag>
      <Button button-type="button" @click="resetLayout"> Reset layout </Button>
    </div>
    <GridLayout
      v-model:layout="layout"
      class="demo-grid bounded-grid"
      :auto-size="false"
      :is-bounded="bounded"
      :is-resizable="false"
      :gap="[10, 10]"
      :row-height="50"
    >
      <template #item="{ item }">
        <span class="demo-item__label">{{ item.i }}</span>
      </template>
    </GridLayout>
  </section>
</template>

<style scoped>
.bounded-demo {
  min-height: 620px;
}

.bounded-grid.vgl-layout {
  height: 320px;
  border: 2px dashed var(--demo-accent, #2859b8);
}
</style>
