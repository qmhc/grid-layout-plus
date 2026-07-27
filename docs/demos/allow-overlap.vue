<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

import type { CollisionMode } from 'grid-layout-plus'

const allowOverlap = ref(true)

const collisionMode = computed<CollisionMode>(() => {
  return allowOverlap.value ? 'overlap' : 'push'
})

const layout = reactive([
  { x: 0, y: 0, w: 4, h: 3, i: '0' },
  { x: 2, y: 1, w: 4, h: 3, i: '1' },
  { x: 6, y: 0, w: 3, h: 2, i: '2' },
  { x: 7, y: 1, w: 3, h: 3, i: '3' },
  { x: 0, y: 5, w: 2, h: 2, i: '4' },
  { x: 3, y: 5, w: 2, h: 2, i: '5' },
])
</script>

<template>
  <div style="margin-bottom: 10px">
    <label>
      <input v-model="allowOverlap" type="checkbox" />
      Allow Overlap
    </label>
  </div>
  <GridLayout v-model:layout="layout" :collision-mode="collisionMode" :row-height="30">
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
