<script setup lang="ts">
import { computed, inject } from 'vue'

import { LAYOUT_KEY } from '../helpers/common'
import { calcGridCellDimensions } from '../core/utils'

/** Props accepted by the `GridBackground` component. */
export interface GridBackgroundProps {
  /**
   * The number of columns to draw.
   *
   * @defaultValue The parent `GridLayout` value, or `12`.
   */
  cols?: number
  /**
   * The height of one drawn row in pixels.
   *
   * @defaultValue The parent `GridLayout` value, or `150`.
   */
  rowHeight?: number
  /**
   * The horizontal and vertical gaps between drawn cells.
   *
   * @defaultValue The parent `GridLayout` value, or `[10, 10]`.
   */
  gap?: readonly [number, number]
  /**
   * The horizontal and vertical padding around the drawn grid.
   *
   * @defaultValue The parent `GridLayout` value, or `[0, 0]`.
   */
  containerPadding?: readonly [number, number]
  /**
   * The drawing width in pixels.
   *
   * @defaultValue The parent `GridLayout` width, or `0`.
   */
  width?: number
  /** The number of rows to draw; when omitted, the background fills the available height. */
  rows?: number
  /**
   * The grid-line color.
   *
   * @defaultValue `'rgba(0,0,0,0.1)'`
   */
  color?: string
  /**
   * The non-negative grid-line width in pixels.
   *
   * @defaultValue `1`
   */
  strokeWidth?: number
}

const props = withDefaults(defineProps<GridBackgroundProps>(), {
  color: 'rgba(0,0,0,0.1)',
  strokeWidth: 1,
})

const layout = inject(LAYOUT_KEY, null)

const resolvedCols = computed(() => props.cols ?? layout?.colNum ?? 12)
const resolvedRowHeight = computed(() => props.rowHeight ?? layout?.rowHeight ?? 150)
const resolvedGap = computed<[number, number]>(() => {
  const gap = props.gap ?? layout?.gap ?? [10, 10]
  return [gap[0], gap[1]]
})
const resolvedContainerPadding = computed<[number, number]>(() => {
  const padding = props.containerPadding ?? layout?.containerPadding ?? [0, 0]
  return [padding[0], padding[1]]
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
      gap: resolvedGap.value,
      containerPadding: resolvedContainerPadding.value,
      rowHeight: resolvedRowHeight.value,
    })
    const patternWidth = cellDims.cellWidth + cellDims.gapX
    const patternHeight = cellDims.cellHeight + cellDims.gapY
    const positionX = resolvedContainerPadding.value[0] + cellDims.cellWidth + cellDims.gapX / 2
    const positionY = resolvedContainerPadding.value[1] + cellDims.cellHeight + cellDims.gapY / 2
    const rows =
      typeof props.rows === 'number' && Number.isFinite(props.rows) && props.rows > 0
        ? props.rows
        : null
    const height =
      rows === null
        ? '100%'
        : resolvedContainerPadding.value[1] * 2 +
          cellDims.cellHeight * rows +
          cellDims.gapY * Math.max(0, rows - 1)
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
