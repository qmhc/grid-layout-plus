<script setup lang="ts">
import { ref } from 'vue'

import { GridLayout } from 'grid-layout-plus'

import type { Layout } from 'grid-layout-plus'

const layout = ref<Layout>([
  { i: 'auto', x: 0, y: 0, w: 6, h: 1 },
  { i: 'fixed', x: 6, y: 0, w: 6, h: 2, autoHeight: false },
])
const paragraphs = ref(['Initial content'])
</script>

<template>
  <button type="button" @click="paragraphs.push(`Dynamic line ${paragraphs.length + 1}`)">
    Add content
  </button>

  <GridLayout v-model:layout="layout" auto-height :row-height="30">
    <template #item="{ item }">
      <article>
        <strong>{{ item.i }}</strong>
        <p
          v-for="paragraph in item.i === 'auto' ? paragraphs : ['Fixed-height item']"
          :key="paragraph"
        >
          {{ paragraph }}
        </p>
      </article>
    </template>
  </GridLayout>
</template>
