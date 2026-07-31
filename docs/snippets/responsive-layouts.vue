<script setup lang="ts">
import { ref } from 'vue'

import { GridLayout } from 'grid-layout-plus'

import type { Layout, ResponsiveLayoutsInput } from 'grid-layout-plus'

const responsiveLayouts = ref<ResponsiveLayoutsInput>({
  md: [
    { x: 0, y: 0, w: 2, h: 2, i: 'a' },
    { x: 2, y: 0, w: 2, h: 3, i: 'b' },
    { x: 4, y: 0, w: 2, h: 2, i: 'c' },
  ],
  lg: [
    { x: 0, y: 0, w: 3, h: 2, i: 'a' },
    { x: 3, y: 0, w: 3, h: 3, i: 'b' },
    { x: 6, y: 0, w: 3, h: 2, i: 'c' },
  ],
})

const layout = ref<Layout>(responsiveLayouts.value.lg?.map(item => ({ ...item })) ?? [])
</script>

<template>
  <GridLayout
    v-model:layout="layout"
    v-model:responsive-layouts="responsiveLayouts"
    responsive
    :row-height="30"
  >
    <template #item="{ item }">
      {{ item.i }}
    </template>
  </GridLayout>
</template>
