<script setup lang="ts">
import { ref } from 'vue'

import { GridLayout } from 'grid-layout-plus'

import type { Layout } from 'grid-layout-plus'

const layout = ref<Layout>([
  { x: 0, y: 0, w: 3, h: 2, i: 'a' },
  { x: 3, y: 0, w: 3, h: 3, i: 'b' },
  { x: 6, y: 0, w: 3, h: 2, i: 'c' },
])
</script>

<template>
  <GridLayout v-model:layout="layout" :col-num="12" :row-height="30">
    <template #item="{ item }">
      {{ item.i }}
    </template>
  </GridLayout>
</template>
