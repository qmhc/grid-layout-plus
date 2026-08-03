export type CompactType = 'vertical' | 'horizontal'

/** 元素发生碰撞时的布局策略 */
export type CollisionMode = 'push' | 'prevent' | 'overlap'

/** 压缩器接口 */
export interface Compactor {
  /** 碰撞避让方向；自定义压缩器不声明时保持垂直避让的兼容行为 */
  readonly type?: CompactType
  /** 对布局执行压缩，返回新布局（不修改输入） */
  compact(layout: ReadonlyLayout, cols: number): Layout
  /** @deprecated 请改用 GridLayout 的 collisionMode="overlap" */
  readonly allowOverlap?: boolean
}

/** 定位策略接口 */
export type PositionStyle = Readonly<
  Partial<Record<'position' | 'top' | 'left' | 'right' | 'width' | 'height' | 'transform', string>>
>

export interface PositionStrategy {
  readonly usesCssTransforms: boolean
  /** 父容器的 CSS 缩放比例，用于将指针坐标还原到布局坐标系 */
  readonly transformScale?: number
  getStyle(top: number, left: number, width: number, height: number): PositionStyle
  getRtlStyle(top: number, right: number, width: number, height: number): PositionStyle
}

/** 网格单元格尺寸 */
export interface GridCellDimensions {
  cellWidth: number
  cellHeight: number
  gapX: number
  gapY: number
}

export interface CalcGridCellDimensionsInput {
  readonly containerWidth: number
  readonly cols: number
  readonly gap: readonly [number, number]
  readonly containerPadding: readonly [number, number]
  readonly rowHeight: number
}

export interface GridGeometry {
  width: number
  cols: number
  rowHeight: number
  gap: readonly [number, number]
  containerPadding: readonly [number, number]
  rtl: boolean
  effectiveScale: number
}

export interface PixelRect {
  top: number
  inlineStart: number
  width: number
  height: number
}

export interface ReadonlyClientRect {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
  readonly width: number
  readonly height: number
}

export interface LayoutItemRequired {
  w: number
  h: number
  x: number
  y: number
  i: number | string
}

export interface LayoutItem extends LayoutItemRequired {
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
  moved?: boolean
  static?: boolean
  isDraggable?: boolean
  isResizable?: boolean
  /**
   * Whether this item's row height follows its rendered content.
   *
   * Overrides the parent `GridLayout.autoHeight` default when defined. The required `h` remains
   * the initial, SSR, and measurement-fallback height.
   *
   * @defaultValue `false`
   */
  autoHeight?: boolean
  /** 元素层级；数值越大越靠前 */
  zIndex?: number
}

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T

export type ReadonlyLayoutItem = DeepReadonly<LayoutItem>
export type ReadonlyLayout = readonly ReadonlyLayoutItem[]
export type Layout = Array<LayoutItem>

export type LayoutOperationReason =
  | 'item-not-found'
  | 'interaction-active'
  | 'static-item'
  | 'disabled'
  | 'collision'
  | 'out-of-bounds'
  | 'max-rows'
  | 'invalid-input'
  | 'external-update'
  | 'external-not-committed'
  | 'superseded'
  | 'config-changed'
  | 'cancelled'
  | 'extension-error'
  | 'extension-invalid-result'

export interface LayoutOperationResultBase {
  operation: 'set' | 'move' | 'resize' | 'add' | 'remove' | 'layer'
  id: LayoutItem['i'] | null
  previousLayout: ReadonlyLayout
  layout: ReadonlyLayout
  candidate: ReadonlyLayoutItem | null
}

export type LayoutOperationResult =
  | (LayoutOperationResultBase & {
      status: 'accepted'
      reason: 'applied'
    })
  | (LayoutOperationResultBase & {
      status: 'unchanged'
      reason: 'same-value'
    })
  | (LayoutOperationResultBase & {
      status: 'rejected'
      reason: LayoutOperationReason
    })

export type AcceptedLayoutOperationResult = Extract<LayoutOperationResult, { status: 'accepted' }>
export type RejectedLayoutOperationResult = Extract<LayoutOperationResult, { status: 'rejected' }>

export type CompactMinPositions = ReadonlyMap<
  LayoutItem['i'],
  Readonly<{
    y: number
  }>
>

export interface NormalizeLayoutOptions {
  readonly cols: number
  readonly maxRows?: number
  readonly collisionMode?: CollisionMode
  readonly compactor?: Compactor
}

export type GridLayoutValidationCode = 'invalid-layout' | 'invalid-config'
export type GridLayoutExtensionCode = 'extension-error' | 'extension-invalid-result'
export type GridLayoutExtensionSource = 'compactor' | 'position-strategy' | 'drop-config'

export type DefaultBreakpoint = 'xxs' | 'xs' | 'sm' | 'md' | 'lg'
/** @deprecated 使用 DefaultBreakpoint 或调用方自定义断点泛型。 */
export type Breakpoint = DefaultBreakpoint
export type Breakpoints<B extends string = DefaultBreakpoint> = Readonly<Record<B, number>>
export type ResponsiveValue<B extends string, T> = T | Readonly<Record<B, T>>
export type ResponsiveLayoutsInput<B extends string = DefaultBreakpoint> = Partial<
  Readonly<Record<B, ReadonlyLayout>>
>
export type CompleteResponsiveLayouts<B extends string = DefaultBreakpoint> = Readonly<
  Record<B, ReadonlyLayout>
>
/** @deprecated 使用 ResponsiveLayoutsInput 或 CompleteResponsiveLayouts。 */
export type ResponsiveLayout = Record<DefaultBreakpoint, Layout>
