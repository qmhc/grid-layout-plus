<script setup lang="ts">
import { ref } from 'vue'

import { GridLayout } from 'grid-layout-plus'

import type { Layout, TransferConfig } from 'grid-layout-plus'

const transferConfig: TransferConfig = { group: 'dashboard' }
const left = ref<Layout>([{ i: 'a', x: 0, y: 0, w: 2, h: 2 }])
const right = ref<Layout>([{ i: 'b', x: 0, y: 0, w: 2, h: 2 }])
</script>

<template>
  <GridLayout v-model:layout="left" :transfer-config="transferConfig">
    <template #item="{ item }">
      {{ item.i }}
    </template>
  </GridLayout>
  <GridLayout v-model:layout="right" :transfer-config="transferConfig">
    <template #item="{ item }">
      {{ item.i }}
    </template>
  </GridLayout>
</template>
