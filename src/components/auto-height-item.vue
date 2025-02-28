<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useResizeObserver } from '@vueuse/core'
import GridItem from './grid-item.vue'

const props = defineProps({
  isDraggable: {
    type: Boolean,
    default: null
  },
  isResizable: {
    type: Boolean,
    default: null
  },
  isBounded: {
    type: Boolean,
    default: null
  },
  static: {
    type: Boolean,
    default: false
  },
  minH: {
    type: Number,
    default: 1
  },
  minW: {
    type: Number,
    default: 1
  },
  maxH: {
    type: Number,
    default: Infinity
  },
  maxW: {
    type: Number,
    default: Infinity
  },
  x: {
    type: Number,
    required: true
  },
  y: {
    type: Number,
    required: true
  },
  w: {
    type: Number,
    required: true
  },
  h: {
    type: Number,
    required: true
  },
  i: {
    type: [Number, String],
    required: true
  },
  dragIgnoreFrom: {
    type: String,
    default: 'a, button'
  },
  dragAllowFrom: {
    type: String,
    default: null
  },
  resizeIgnoreFrom: {
    type: String,
    default: 'a, button'
  },
  preserveAspectRatio: {
    type: Boolean,
    default: false
  },
  dragOption: {
    type: Object,
    default: () => ({})
  },
  resizeOption: {
    type: Object,
    default: () => ({})
  },
  rowHeight: {
    type: Number,
    default: 30
  },
  margin: {
    type: Array,
    default: () => [10, 10]
  }
})

const emit = defineEmits(['update:h'])

const contentRef = ref<HTMLDivElement | null>(null)
const contentHeight = ref(0)

const calculatedRows = computed(() => {
  if (contentHeight.value <= 0) return props.minH
  const marginY = props.margin[1] as number
  const rows = Math.ceil((contentHeight.value + marginY) / (props.rowHeight + marginY))
  return Math.min(Math.max(rows, props.minH), props.maxH)
})

const observer = useResizeObserver(contentRef, entries => {
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

onMounted(() => {
  if (contentRef.value) {
    const height = contentRef.value.clientHeight
    if (height > 0) {
      contentHeight.value = height
    }
  }
})
onBeforeUnmount(() => {
  observer && observer.stop()
})
</script>

<template>
  <GridItem v-bind="{ ...props }">
    <div ref="contentRef">
      <slot></slot>
    </div>
  </GridItem>
</template>
