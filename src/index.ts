import './style.scss'

export { default as GridLayout } from './components/grid-layout.vue'
export { default as GridItem } from './components/grid-item.vue'
export { default as GridBackground } from './components/grid-background.vue'

export type * from './components/types'
export type * from './helpers/types'

// 组合式函数 API
export { useContainerWidth } from './composables/useContainerWidth'
export { useGridLayout } from './composables/useGridLayout'
export { useResponsiveLayout } from './composables/useResponsiveLayout'

export type {
  GridDragState,
  GridInteractionCandidate,
  GridInteractionStart,
  GridInteractionStartResult,
  GridInteractionToken,
  GridLayoutRuntimeError,
  GridResizeState,
  InteractionCancelReason,
  InteractionCommandResult,
  InteractionTerminalBase,
  InteractionTerminalPayload,
  LayoutChangeReason,
  OperationRejectedReason,
  OperationRejectedPayload,
  UseGridLayoutOptions,
  UseGridLayoutReturn,
} from './composables/useGridLayout'
export type {
  UseResponsiveLayoutOptions,
  UseResponsiveLayoutReturn,
} from './composables/useResponsiveLayout'
export type {
  UseContainerWidthOptions,
  UseContainerWidthReturn,
} from './composables/useContainerWidth'

// 核心算法 API
export {
  bottom,
  cloneLayout,
  collides,
  compact,
  correctBounds,
  getAllCollisions,
  getFirstCollision,
  moveElement,
  normalizeLayout,
  sortLayoutItemsByRowCol,
  validateLayout,
  GridLayoutExtensionError,
  GridLayoutValidationError,
  fastHorizontalCompactor,
  fastVerticalCompactor,
  horizontalCompactor,
  noCompactor,
  verticalCompactor,
  withOverlap,
  absoluteStrategy,
  scaledStrategy,
  transformStrategy,
  calcGridCellDimensions,
  gridToPixelRect,
  pixelSizeToGridSize,
  pointerToGridPosition,
} from './core'
