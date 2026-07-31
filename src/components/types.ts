import type {
  AcceptedLayoutOperationResult,
  Breakpoints,
  CollisionMode,
  Compactor,
  CompleteResponsiveLayouts,
  DefaultBreakpoint,
  LayoutItem,
  LayoutOperationResult,
  PositionStrategy,
  ReadonlyLayout,
  ReadonlyLayoutItem,
  ResponsiveLayoutsInput,
  ResponsiveValue,
} from '../helpers/types'
import type { Ref, VNodeChild } from 'vue'
import type {
  GridLayoutRuntimeError,
  InteractionTerminalPayload,
  OperationRejectedPayload,
} from '../composables/useGridLayout'

export interface GridConfig<B extends string = DefaultBreakpoint> {
  colNum?: number
  rowHeight?: number
  maxRows?: number
  margin?: ResponsiveValue<B, readonly [number, number]>
  containerPadding?: ResponsiveValue<B, readonly [number, number]>
  autoSize?: boolean
}

export interface DragConfig {
  isDraggable?: boolean
  dragThreshold?: number
  restoreOnDrag?: boolean
}

export interface ResizeConfig {
  isResizable?: boolean
}

export type DropCandidate = Readonly<Omit<LayoutItem, 'i' | 'moved'>>

export interface DropDragOverInput<B extends string = DefaultBreakpoint> {
  nativeEvent: DragEvent
  pointer: Readonly<{ clientX: number; clientY: number }>
  grid: Readonly<{ x: number; y: number }>
  candidate: DropCandidate
  layout: ReadonlyLayout
  breakpoint: B | null
  cols: number
}

export interface DropDragOverContext<
  B extends string = DefaultBreakpoint,
> extends DropDragOverInput<B> {
  proposalId: number
  previewLayout: ReadonlyLayout
  insertionIndex: number
}

export type DropEvaluationResult<B extends string = DefaultBreakpoint> =
  | {
      status: 'accepted'
      proposalId: number
      breakpoint: B | null
      candidate: DropCandidate
      previewLayout: ReadonlyLayout
      insertionIndex: number
      nativeEvent: DragEvent
    }
  | {
      status: 'rejected'
      reason:
        | 'callback-rejected'
        | 'invalid-input'
        | 'collision'
        | 'out-of-bounds'
        | 'max-rows'
        | 'no-position'
        | 'extension-error'
        | 'extension-invalid-result'
      nativeEvent: DragEvent
    }

export interface DropConfig<B extends string = DefaultBreakpoint> {
  isDroppable?: boolean
  dropItem?: Readonly<{ w: number; h: number }>
  onDragOver?(context: Readonly<DropDragOverInput<B>>): false | Readonly<{ w?: number; h?: number }>
}

export interface GridLayoutProps<B extends string = DefaultBreakpoint> {
  autoSize?: boolean
  colNum?: number
  rowHeight?: number
  maxRows?: number
  margin?: ResponsiveValue<B, readonly [number, number]>
  containerPadding?: ResponsiveValue<B, readonly [number, number]>
  width?: number
  isDraggable?: boolean
  isResizable?: boolean
  isMirrored?: boolean
  isBounded?: boolean
  restoreOnDrag?: boolean
  layout: ReadonlyLayout
  responsive?: boolean
  responsiveLayouts?: ResponsiveLayoutsInput<B>
  breakpoints?: Breakpoints<B>
  cols?: Readonly<Record<B, number>>
  /** 元素发生碰撞时的布局策略 */
  collisionMode?: CollisionMode
  /** @deprecated 请改用 collisionMode="prevent" */
  preventCollision?: boolean
  /** 重叠模式下交互开始时是否将当前元素置顶 */
  bringToFrontOnInteract?: boolean
  useStyleCursor?: boolean

  /** 可插拔压缩器（默认 verticalCompactor） */
  compactor?: Compactor
  /** 可插拔定位策略（默认 transformStrategy） */
  positionStrategy?: PositionStrategy
  /** 是否允许外部拖入 */
  isDroppable?: boolean
  /** 外部拖入元素的默认尺寸 */
  dropItem?: Readonly<{ w: number; h: number }>
  /** 拖拽阈值（像素） */
  dragThreshold?: number

  /** 分组配置对象 */
  gridConfig?: GridConfig<B>
  dragConfig?: DragConfig
  resizeConfig?: ResizeConfig
  dropConfig?: DropConfig<B>
}

export interface GridItemProps {
  i: number | string
  /** @deprecated 在 GridLayout 内由父级 Layout 决定。 */
  x?: number
  /** @deprecated 在 GridLayout 内由父级 Layout 决定。 */
  y?: number
  /** @deprecated 在 GridLayout 内由父级 Layout 决定。 */
  w?: number
  /** @deprecated 在 GridLayout 内由父级 Layout 决定。 */
  h?: number
  /** @deprecated 在 GridLayout 内由父级 Layout 决定。 */
  static?: boolean
  /** @deprecated 在 GridLayout 内由父级 Layout 决定。 */
  minH?: number
  /** @deprecated 在 GridLayout 内由父级 Layout 决定。 */
  minW?: number
  /** @deprecated 在 GridLayout 内由父级 Layout 决定。 */
  maxH?: number
  /** @deprecated 在 GridLayout 内由父级 Layout 决定。 */
  maxW?: number
  /** @deprecated 在 GridLayout 内由父级 Layout 决定。 */
  zIndex?: number
  /** @deprecated 在 GridLayout 内由父级 Layout 决定。 */
  isDraggable?: boolean
  /** @deprecated 在 GridLayout 内由父级 Layout 决定。 */
  isResizable?: boolean
  isBounded?: boolean
  dragIgnoreFrom?: string
  dragAllowFrom?: string
  resizeIgnoreFrom?: string
  preserveAspectRatio?: boolean
  dragOption?: Readonly<Record<string, unknown>>
  resizeOption?: Readonly<Record<string, unknown>>

  /** 拖拽阈值（覆盖 GridLayout 的默认值） */
  dragThreshold?: number

  /** @internal 由 GridLayout 的 item slot 创建。 */
  internal?: boolean

  /** @internal 占位节点不参与 LayoutItem 注册。 */
  decorative?: boolean
}

export interface GridItemEmits {
  (
    event: 'container-resized',
    id: LayoutItem['i'],
    h: number,
    w: number,
    pixelHeight: string,
    pixelWidth: string,
  ): void
  (
    event: 'resize' | 'resized',
    id: LayoutItem['i'],
    h: number,
    w: number,
    pixelHeight: number,
    pixelWidth: number,
  ): void
  (event: 'move' | 'moved', id: LayoutItem['i'], x: number, y: number): void
}

export interface LayoutUpdateMeta {
  revision: number
  source:
    | 'interaction'
    | 'programmatic'
    | 'responsive'
    | 'width'
    | 'config'
    | 'external'
    | 'drop-commit'
}

export interface ResponsiveWidthState<B extends string = DefaultBreakpoint> {
  breakpoint: B | null
  cols: number
  margin: readonly [number, number]
  containerPadding: readonly [number, number]
}

export interface WidthChangedPayload<B extends string = DefaultBreakpoint> {
  width: number
  state: 'resolved-zero' | 'resolved'
  source: 'explicit' | 'observer'
  responsive: boolean
  candidate: ResponsiveWidthState<B>
  committed: ResponsiveWidthState<B>
}

export type LayoutTransactionReceipt =
  | {
      status: 'pending'
      revision: number
      proposal: AcceptedLayoutOperationResult
    }
  | Extract<LayoutOperationResult, { status: 'unchanged' | 'rejected' }>

export interface InteractionStartPayload {
  type: 'drag' | 'resize'
  id: LayoutItem['i']
  revision: null
  oldItem: ReadonlyLayoutItem
  item: ReadonlyLayoutItem
  layout: ReadonlyLayout
  placeholder: null
  nativeEvent: Event
}

export interface InteractionChangePayload {
  type: 'drag' | 'resize'
  id: LayoutItem['i']
  revision: number
  oldItem: ReadonlyLayoutItem
  item: ReadonlyLayoutItem
  layout: ReadonlyLayout
  placeholder: ReadonlyLayoutItem
  nativeEvent: Event | null
}

export interface GridLayoutSlotScope {
  item: ReadonlyLayoutItem
  index: number
  style: Readonly<Record<string, string>>
  isDragging: boolean
  isResizing: boolean
}

export interface GridLayoutSlots {
  item?(scope: GridLayoutSlotScope): VNodeChild
  default?(): VNodeChild
}

export interface GridLayoutExpose {
  root: Readonly<Ref<HTMLElement | null>>
  setLayout(layout: ReadonlyLayout): LayoutTransactionReceipt
  moveItem(id: LayoutItem['i'], x: number, y: number): LayoutTransactionReceipt
  resizeItem(id: LayoutItem['i'], w: number, h: number): LayoutTransactionReceipt
  addItem(item: ReadonlyLayoutItem): LayoutTransactionReceipt
  removeItem(id: LayoutItem['i']): LayoutTransactionReceipt
  bringToFront(id: LayoutItem['i']): LayoutTransactionReceipt
  sendToBack(id: LayoutItem['i']): LayoutTransactionReceipt
}

export interface GridLayoutEmits<B extends string = DefaultBreakpoint> {
  (event: 'update:layout', layout: ReadonlyLayout, meta: LayoutUpdateMeta): void
  (event: 'layout-before-mount', layout: ReadonlyLayout): void
  (event: 'layout-mounted', layout: ReadonlyLayout): void
  (event: 'layout-ready', layout: ReadonlyLayout): void
  (event: 'layout-updated', layout: ReadonlyLayout, meta: LayoutUpdateMeta): void
  (
    event: 'breakpoint-changed',
    breakpoint: B | null,
    layout: ReadonlyLayout,
    meta: LayoutUpdateMeta,
  ): void
  (event: 'drop-drag-over', context: DropDragOverContext<B>, nativeEvent: DragEvent): void
  (
    event: 'drop',
    result: Extract<DropEvaluationResult<B>, { status: 'accepted' }>,
    nativeEvent: DragEvent,
  ): void
  (event: 'drop-drag-leave', nativeEvent: DragEvent): void
  (
    event: 'update:responsive-layouts',
    layouts: CompleteResponsiveLayouts<B>,
    meta: LayoutUpdateMeta,
  ): void
  (event: 'width-changed', payload: WidthChangedPayload<B>, meta: LayoutUpdateMeta): void
  (event: 'interaction-start', payload: InteractionStartPayload): void
  (event: 'interaction-change', payload: InteractionChangePayload): void
  (event: 'interaction-end', payload: InteractionTerminalPayload): void
  (event: 'operation-rejected', payload: OperationRejectedPayload): void
  (event: 'error', payload: GridLayoutRuntimeError): void
}
