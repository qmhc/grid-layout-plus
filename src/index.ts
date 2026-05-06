import './style.scss'

export { default as GridLayout } from './components/grid-layout.vue'
export { default as GridItem } from './components/grid-item.vue'

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
