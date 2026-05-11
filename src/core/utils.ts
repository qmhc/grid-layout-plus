import type { GridCellDimensions } from '../helpers/types'

/**
 * 计算网格单元格的精确尺寸。
 *
 * cellWidth = (containerWidth - marginX * (cols + 1)) / cols
 * cellHeight = rowHeight
 */
export function calcGridCellDimensions(params: {
  containerWidth: number,
  cols: number,
  margin: [number, number],
  rowHeight: number,
}): GridCellDimensions {
  const { containerWidth, cols, margin, rowHeight } = params
  const marginX = margin[0]
  const marginY = margin[1]

  const cellWidth = cols <= 0
    ? 0
    : Math.max(0, (containerWidth - marginX * (cols + 1)) / cols)

  return {
    cellWidth,
    cellHeight: rowHeight,
    marginX,
    marginY,
  }
}
