/**
 * 核心算法独立导出入口。
 * 所有导出均为纯函数或类型，不依赖 Vue 运行时或浏览器 DOM API。
 */

// 从 helpers/common.ts 重新导出纯函数
export {
  bottom,
  cloneLayout,
  collides,
  compact,
  correctBounds,
  getAllCollisions,
  getFirstCollision,
  moveElement,
  sortLayoutItemsByRowCol,
  validateLayout,
} from './helpers/common'

// 导出 Compactor 相关
export {
  fastHorizontalCompactor,
  fastVerticalCompactor,
  horizontalCompactor,
  noCompactor,
  verticalCompactor,
  withOverlap,
} from './core/compactors'

// 导出 PositionStrategy 相关
export { absoluteStrategy, scaledStrategy, transformStrategy } from './core/position-strategies'

// 导出工具函数
export { calcGridCellDimensions } from './core/utils'

// 导出类型
export type {
  Breakpoint,
  Breakpoints,
  CompactType,
  Compactor,
  GridCellDimensions,
  Layout,
  LayoutItem,
  PositionStrategy,
  ResponsiveLayout,
} from './helpers/types'
