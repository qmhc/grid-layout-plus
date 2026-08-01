import type {
  Breakpoint,
  Breakpoints,
  Compactor,
  LayoutItem,
  LayoutOperationReason,
  PositionStrategy,
  ReadonlyLayoutItem,
} from './types'

/** @internal GridLayout 与 GridItem 之间的注入上下文，不属于公共包 API。 */
export interface LayoutInstance {
  responsive: boolean
  lastBreakpoint: Breakpoint
  cols: Breakpoints
  colNum: number
  rowHeight: number
  width: number | null
  margin: number[]
  containerPadding: readonly [number, number]
  isDraggable: boolean
  isResizable: boolean
  isBounded: boolean
  useStyleCursor: boolean
  maxRows: number
  isMirrored: boolean
  compactor: Compactor
  positionStrategy: PositionStrategy
  positionStyleRevision: number
  positionStyleReady: boolean
  isDroppable: boolean
  dropItem: { w: number; h: number }
  dragThreshold: number
  increaseItem: (item: any) => void
  decreaseItem: (item: any) => void
  updateItem: (item: any, previousId: LayoutItem['i']) => void
  getLayoutItem: (id: LayoutItem['i']) => ReadonlyLayoutItem | undefined
  getItemZIndex: (id: number | string) => number | undefined
  getPositionStyle: (id: LayoutItem['i']) => Readonly<Record<string, string>>
  handleItemConfigChange: (item: any, type: 'drag' | 'resize', error?: unknown) => void
  rejectItemInteraction: (
    type: 'drag' | 'resize',
    id: LayoutItem['i'],
    reason: LayoutOperationReason,
    nativeEvent: Event | null,
    error?: unknown,
  ) => void
}
