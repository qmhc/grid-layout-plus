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

const patternWidth = computed(() => cellDims.value.cellWidth + cellDims.value.marginX)
const patternHeight = computed(() => cellDims.value.cellHeight + cellDims.value.marginY)

const svgHeight = computed(() => {
  if (props.rows != null && props.rows > 0) {
    return patternHeight.value * props.rows + cellDims.value.marginY
  }
  return '100%'
})
</script>

<template>
  <svg
    class="vgl-background"
    :width="resolvedWidth"
    :height="svgHeight"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <pattern
        id="vgl-grid-pattern"
        :width="patternWidth"
        :height="patternHeight"
        patternUnits="userSpaceOnUse"
        :x="cellDims.marginX / 2"
        :y="cellDims.marginY / 2"
      >
        <rect
          :x="cellDims.marginX / 2"
          :y="cellDims.marginY / 2"
          :width="cellDims.cellWidth"
          :height="cellDims.cellHeight"
          fill="none"
          :stroke="props.color"
          :stroke-width="props.strokeWidth"
        />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#vgl-grid-pattern)" />
  </svg>
</template>
