<script setup lang="ts">
import { computed, inject } from 'vue'

import { LAYOUT_KEY } from '../helpers/common'
import { calcGridCellDimensions } from '../core/utils'

export interface GridBackgroundProps {
  cols?: number,
  rowHeight?: number,
  margin?: [number, number],
  width?: number,
  rows?: number,
  color?: string,
  strokeWidth?: number,
}

const props = withDefaults(defineProps<GridBackgroundProps>(), {
  color: 'rgba(0,0,0,0.1)',
  strokeWidth: 1,
})

const layout = inject(LAYOUT_KEY, null)

const resolvedCols = computed(() => props.cols ?? layout?.colNum ?? 12)
const resolvedRowHeight = computed(() => props.rowHeight ?? layout?.rowHeight ?? 150)
const resolvedMargin = computed<[number, number]>(
  () => (props.margin ?? (layout?.margin as [number, number] | undefined) ?? [10, 10]),
)
const resolvedWidth = computed(() => props.width ?? layout?.width ?? 0)

const cellDims = computed(() =>
  calcGridCellDimensions({
    containerWidth: resolvedWidth.value,
    cols: resolvedCols.value,
    margin: resolvedMargin.value,
    rowHeight: resolvedRowHeight.value,
  }),
)

const patternWidth = computed(() => Math.max(0, cellDims.value.cellWidth + cellDims.value.marginX))
const patternHeight = computed(() => Math.max(0, cellDims.value.cellHeight + cellDims.value.marginY))

const svgHeight = computed(() => {
  if (props.rows != null && props.rows > 0) {
    return patternHeight.value * props.rows + cellDims.value.marginY
  }
  return '100%'
})
</script>

<template>
  <div
    v-if="resolvedWidth > 0"
    class="vgl-background"
    :style="{
      width: resolvedWidth + 'px',
      height: typeof svgHeight === 'number' ? svgHeight + 'px' : svgHeight,
      backgroundImage: `linear-gradient(to right, ${props.color} ${props.strokeWidth}px, transparent ${props.strokeWidth}px), linear-gradient(to bottom, ${props.color} ${props.strokeWidth}px, transparent ${props.strokeWidth}px)`,
      backgroundSize: `${patternWidth}px ${patternHeight}px`,
      backgroundPosition: `${cellDims.cellWidth + cellDims.marginX * 1.5}px ${cellDims.cellHeight + cellDims.marginY * 1.5}px`,
    }"
  ></div>
</template>
