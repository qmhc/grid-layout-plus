import './style.scss'

export { default as GridLayout } from './components/grid-layout.vue'
export { default as GridItem } from './components/grid-item.vue'
export { default as GridBackground } from './components/grid-background.vue'

export type * from './components/types'
export type * from './helpers/types'

// Composable API
export { useContainerWidth } from './composables/useContainerWidth'
export { useGridLayout } from './composables/useGridLayout'
export { useResponsiveLayout } from './composables/useResponsiveLayout'

export type { UseGridLayoutOptions, UseGridLayoutReturn } from './composables/useGridLayout'
export type {
  UseResponsiveLayoutOptions,
  UseResponsiveLayoutReturn,
} from './composables/useResponsiveLayout'

// CoreAPI
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
} from './core'
