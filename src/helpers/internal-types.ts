import type {
  Breakpoint,
  Breakpoints,
  Compactor,
  LayoutItem,
  LayoutOperationReason,
  PositionStrategy,
  ReadonlyLayoutItem,
} from './types'

/** @internal GridItem 向 GridLayout 注册的内部实例。 */
export interface GridItemRegistration {
  i: LayoutItem['i']
  internal?: boolean
  wrapper?: HTMLElement
  state: {
    registered: boolean
    resizable?: boolean
    style: Record<string, string>
  }
  resetInteractionState(type?: 'drag' | 'resize'): void
  finishDragInteraction(item: Pick<ReadonlyLayoutItem, 'x' | 'y'> | null): void
  finishResizeInteraction(item: Pick<ReadonlyLayoutItem, 'x' | 'y' | 'w' | 'h'> | null): void
  refreshPositionStyle(): void
  disableInteractionBinding(type?: 'drag' | 'resize'): void
}

/** @internal GridLayout 与 GridItem 之间的注入上下文，不属于公共包 API。 */
export interface LayoutInstance {
  responsive: boolean
  lastBreakpoint: Breakpoint
  cols: Breakpoints
  colNum: number
  rowHeight: number
  width: number | null
  gap: number[]
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
  increaseItem: (item: GridItemRegistration) => void
  decreaseItem: (item: GridItemRegistration) => void
  updateItem: (item: GridItemRegistration, previousId: LayoutItem['i']) => void
  getLayoutItem: (id: LayoutItem['i']) => ReadonlyLayoutItem | undefined
  getItemZIndex: (id: number | string) => number | undefined
  getPositionStyle: (id: LayoutItem['i']) => Readonly<Record<string, string>>
  handleItemConfigChange: (
    item: GridItemRegistration,
    type: 'drag' | 'resize',
    error?: unknown,
  ) => void
  rejectItemInteraction: (
    type: 'drag' | 'resize',
    id: LayoutItem['i'],
    reason: LayoutOperationReason,
    nativeEvent: Event | null,
    error?: unknown,
  ) => void
}
