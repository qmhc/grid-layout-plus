<script setup lang="ts">
import { computed, ref, useAttrs, watch } from 'vue'

import { useResizeObserver } from '@vueuse/core'

const props = defineProps({
  h: {
    type: Number,
    required: true
  },
  rowHeight: {
    type: Number,
    default: 30
  },
  margin: {
    type: Array,
    default: () => [10, 10]
  },
  minH: {
    type: Number,
    default: 1
  },
  maxH: {
    type: Number,
    default: Infinity
  }
})
const attrs = useAttrs()

const emit = defineEmits(['update:h'])

const contentRef = ref(null)
const contentHeight = ref(0)

const calculatedRows = computed(() => {
  if (contentHeight.value <= 0) return props.minH

  const marginY = props.margin[1]
  const rows = Math.ceil((contentHeight.value + marginY) / (props.rowHeight + marginY))

  return Math.min(Math.max(rows, props.minH), props.maxH)
})

useResizeObserver(contentRef, entries => {
  const entry = entries[0]
  if (entry) {
    contentHeight.value = entry.contentRect.height
  }
})

watch(
  () => calculatedRows.value,
  newRows => {
    if (newRows !== props.h) {
      emit('update:h', newRows)
    }
  }
)
</script>

<template>
  <GridItem v-bind="{ ...attrs, ...props }">
    <div ref="contentRef">
      <slot></slot>
    </div>
  </GridItem>
</template>
