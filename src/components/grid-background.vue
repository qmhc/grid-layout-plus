<script setup lang="ts">
import { computed, inject } from 'vue'

import { LAYOUT_KEY } from '../helpers/common'
import { calcGridCellDimensions } from '../core/utils'

export interface GridBackgroundProps {
  cols?: number
  rowHeight?: number
  margin?: readonly [number, number]
  width?: number
  rows?: number
  color?: string
  strokeWidth?: number
}

const props = withDefaults(defineProps<GridBackgroundProps>(), {
  color: 'rgba(0,0,0,0.1)',
  strokeWidth: 1,
})

const layout = inject(LAYOUT_KEY, null)

const resolvedCols = computed(() => props.cols ?? layout?.colNum ?? 12)
const resolvedRowHeight = computed(() => props.rowHeight ?? layout?.rowHeight ?? 150)
const resolvedMargin = computed<[number, number]>(() => {
  const margin = props.margin ?? layout?.margin ?? [10, 10]
  return [margin[0], margin[1]]
})
const resolvedWidth = computed(() => props.width ?? layout?.width ?? 0)

const geometry = computed(() => {
  try {
    const width = resolvedWidth.value
    if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) return null
    if (
      typeof props.strokeWidth !== 'number' ||
      !Number.isFinite(props.strokeWidth) ||
      props.strokeWidth < 0
    ) {
      return null
    }
    if (typeof props.color !== 'string') return null

    const cellDims = calcGridCellDimensions({
      containerWidth: width,
      cols: resolvedCols.value,
      margin: resolvedMargin.value,
      rowHeight: resolvedRowHeight.value,
    })
    const patternWidth = cellDims.cellWidth + cellDims.marginX
    const patternHeight = cellDims.cellHeight + cellDims.marginY
    const positionX = cellDims.cellWidth + cellDims.marginX * 1.5
    const positionY = cellDims.cellHeight + cellDims.marginY * 1.5
    const rows =
      typeof props.rows === 'number' && Number.isFinite(props.rows) && props.rows > 0
        ? props.rows
        : null
    const height = rows === null ? '100%' : patternHeight * rows + cellDims.marginY
    if (
      !Number.isFinite(patternWidth) ||
      !Number.isFinite(patternHeight) ||
      !Number.isFinite(positionX) ||
      !Number.isFinite(positionY) ||
      (typeof height === 'number' && !Number.isFinite(height))
    ) {
      return null
    }
    return {
      width,
      height,
      patternWidth: Math.max(0, patternWidth),
      patternHeight: Math.max(0, patternHeight),
      positionX,
      positionY,
    }
  } catch {
    return null
  }
})
</script>

<template>
  <div
    v-if="geometry"
    class="vgl-background"
    :style="{
      width: geometry.width + 'px',
      height: typeof geometry.height === 'number' ? geometry.height + 'px' : geometry.height,
      backgroundImage: `linear-gradient(to right, ${props.color} ${props.strokeWidth}px, transparent ${props.strokeWidth}px), linear-gradient(to bottom, ${props.color} ${props.strokeWidth}px, transparent ${props.strokeWidth}px)`,
      backgroundSize: `${geometry.patternWidth}px ${geometry.patternHeight}px`,
      backgroundPosition: `${geometry.positionX}px ${geometry.positionY}px`,
    }"
  ></div>
</template>
