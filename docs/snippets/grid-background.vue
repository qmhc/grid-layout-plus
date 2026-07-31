<script setup lang="ts">
import { ref } from 'vue'

import { GridBackground, GridItem, GridLayout } from 'grid-layout-plus'

import type { Layout } from 'grid-layout-plus'

const layout = ref<Layout>([
  { x: 0, y: 0, w: 2, h: 2, i: 'a' },
  { x: 2, y: 0, w: 2, h: 3, i: 'b' },
  { x: 4, y: 0, w: 2, h: 2, i: 'c' },
])
</script>

<template>
  <GridLayout v-model:layout="layout" :col-num="6" :row-height="30">
    <GridBackground color="#64748b" :stroke-width="1"></GridBackground>
    <GridItem v-for="item in layout" :key="item.i" :i="item.i">
      {{ item.i }}
    </GridItem>
  </GridLayout>
</template>
