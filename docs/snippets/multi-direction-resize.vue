<script setup lang="ts">
import { ref } from 'vue'

import { GridItem, GridLayout } from 'grid-layout-plus'

import type { Layout, ResizeConfig } from 'grid-layout-plus'

const resizeConfig: ResizeConfig = {
  handles: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'],
}

const layout = ref<Layout>([
  { x: 0, y: 0, w: 6, h: 3, i: 'all' },
  { x: 6, y: 0, w: 6, h: 3, i: 'limited', resizeHandles: ['e', 's', 'se'] },
])
</script>

<template>
  <GridLayout
    v-model:layout="layout"
    :is-draggable="false"
    :resize-config="resizeConfig"
    :row-height="30"
  >
    <GridItem v-for="item in layout" :key="item.i" :i="item.i">
      {{ item.i }}
    </GridItem>
  </GridLayout>
</template>
