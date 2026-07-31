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

export { GridLayoutExtensionError, GridLayoutValidationError } from './core/errors'

export { normalizeLayout } from './core/normalize'

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
export {
  calcGridCellDimensions,
  gridToPixelRect,
  pixelSizeToGridSize,
  pointerToGridPosition,
} from './core/utils'

// 导出类型
export type {
  AcceptedLayoutOperationResult,
  Breakpoint,
  Breakpoints,
  CalcGridCellDimensionsInput,
  CollisionMode,
  CompactMinPositions,
  CompactType,
  Compactor,
  DeepReadonly,
  GridCellDimensions,
  GridGeometry,
  GridLayoutExtensionCode,
  GridLayoutExtensionSource,
  GridLayoutValidationCode,
  Layout,
  LayoutItem,
  LayoutOperationReason,
  LayoutOperationResult,
  LayoutOperationResultBase,
  NormalizeLayoutOptions,
  PositionStrategy,
  PixelRect,
  ReadonlyClientRect,
  ReadonlyLayout,
  ReadonlyLayoutItem,
  RejectedLayoutOperationResult,
  ResponsiveLayout,
} from './helpers/types'
