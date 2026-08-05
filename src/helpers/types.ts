/** The axis along which a compactor resolves layout gaps and collision displacement. */
export type CompactType = 'vertical' | 'horizontal'

/** Determines how an operation handles collisions with existing items. */
export type CollisionMode = 'push' | 'prevent' | 'overlap'

/** Defines a layout compaction extension. */
export interface Compactor {
  /** The displacement axis. Custom compactors default to vertical behavior when omitted. */
  readonly type?: CompactType
  /**
   * Returns a detached, compacted layout without mutating `layout`.
   *
   * @param layout - The validated layout to compact.
   * @param cols - The positive number of grid columns.
   */
  compact(layout: ReadonlyLayout, cols: number): Layout
  /** @deprecated Use `GridLayout` with `collisionMode="overlap"` instead. */
  readonly allowOverlap?: boolean
}

/** A CSS declaration subset returned by a {@link PositionStrategy}. */
export type PositionStyle = Readonly<
  Partial<Record<'position' | 'top' | 'left' | 'right' | 'width' | 'height' | 'transform', string>>
>

/** Defines how grid geometry is converted into LTR and RTL positioning styles. */
export interface PositionStrategy {
  /** Whether the returned styles position items with CSS transforms. */
  readonly usesCssTransforms: boolean
  /**
   * The positive CSS scale applied by an ancestor, used to map pointer coordinates back into the
   * grid coordinate system.
   *
   * @defaultValue `1`
   */
  readonly transformScale?: number
  /** Returns positioning styles for a left-to-right grid. */
  getStyle(top: number, left: number, width: number, height: number): PositionStyle
  /** Returns positioning styles for a right-to-left grid. */
  getRtlStyle(top: number, right: number, width: number, height: number): PositionStyle
}

/** The calculated dimensions and gaps of one grid cell, in pixels. */
export interface GridCellDimensions {
  /** The width of one column in pixels. */
  cellWidth: number
  /** The height of one row in pixels. */
  cellHeight: number
  /** The horizontal gap in pixels. */
  gapX: number
  /** The vertical gap in pixels. */
  gapY: number
}

/** Input accepted by {@link calcGridCellDimensions}. */
export interface CalcGridCellDimensionsInput {
  /** The grid container width in pixels. */
  readonly containerWidth: number
  /** The positive number of grid columns. */
  readonly cols: number
  /** The horizontal and vertical gaps in pixels. */
  readonly gap: readonly [number, number]
  /** The horizontal and vertical container padding in pixels. */
  readonly containerPadding: readonly [number, number]
  /** The height of one grid row in pixels. */
  readonly rowHeight: number
}

/** Identifies an edge or corner that can start pointer resizing. */
export type ResizeHandleAxis = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

/** Geometry required to convert between grid coordinates and viewport pixels. */
export interface GridGeometry {
  /** The grid container width in pixels. */
  width: number
  /** The positive number of grid columns. */
  cols: number
  /** The height of one grid row in pixels. */
  rowHeight: number
  /** The horizontal and vertical gaps in pixels. */
  gap: readonly [number, number]
  /** The horizontal and vertical container padding in pixels. */
  containerPadding: readonly [number, number]
  /** Whether inline coordinates are measured from the right edge. */
  rtl: boolean
  /** The combined positive CSS scale used to normalize pointer deltas. */
  effectiveScale: number
}

/** A logical pixel rectangle whose horizontal origin is the inline-start edge. */
export interface PixelRect {
  /** The block-start offset in pixels. */
  top: number
  /** The inline-start offset in pixels. */
  inlineStart: number
  /** The width in pixels. */
  width: number
  /** The height in pixels. */
  height: number
}

/** The geometry fields read from a DOM client rectangle. */
export interface ReadonlyClientRect {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
  readonly width: number
  readonly height: number
}

/** Required grid coordinates, size, and identity for a layout item. */
export interface LayoutItemRequired {
  /** Width in grid columns. */
  w: number
  /** Height in grid rows. */
  h: number
  /** Zero-based column coordinate. */
  x: number
  /** Zero-based row coordinate. */
  y: number
  /** A non-empty string or safe integer that is unique within the layout. */
  i: number | string
}

/** Describes one item in a grid layout. */
export interface LayoutItem extends LayoutItemRequired {
  /** Minimum width in grid columns. */
  minW?: number
  /** Minimum height in grid rows. */
  minH?: number
  /** Maximum width in grid columns. */
  maxW?: number
  /** Maximum height in grid rows. */
  maxH?: number
  /** Internal compatibility marker used by legacy mutable movement helpers. */
  moved?: boolean
  /** Whether user and programmatic movement must leave the item fixed. */
  static?: boolean
  /** Overrides the parent drag capability for this item. */
  isDraggable?: boolean
  /** Overrides the parent resize capability for this item. */
  isResizable?: boolean
  /**
   * Resize handles enabled for this item.
   *
   * Overrides `GridLayout.resizeConfig.handles` when defined. An empty array disables pointer
   * resize handles without disabling programmatic resize operations.
   *
   * @defaultValue `undefined`
   */
  resizeHandles?: readonly ResizeHandleAxis[]
  /**
   * Whether this item's row height follows its rendered content.
   *
   * Overrides the parent `GridLayout.autoHeight` default when defined. The required `h` remains
   * the initial, SSR, and measurement-fallback height.
   *
   * @defaultValue `false`
   */
  autoHeight?: boolean
  /** The stacking order; larger values render closer to the front. */
  zIndex?: number
}

/** Recursively marks object properties and array entries as readonly. */
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T

/** A layout item whose properties and nested metadata are deeply readonly. */
export type ReadonlyLayoutItem = DeepReadonly<LayoutItem>
/** A readonly layout whose item metadata is also deeply readonly. */
export type ReadonlyLayout = readonly ReadonlyLayoutItem[]
/** A mutable array of mutable layout items. */
export type Layout = Array<LayoutItem>

/** A stable reason for rejecting or cancelling a layout operation. */
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

/** Fields shared by accepted, unchanged, and rejected layout operation results. */
export interface LayoutOperationResultBase {
  /** The operation that produced the result. */
  operation: 'set' | 'move' | 'resize' | 'add' | 'remove' | 'layer'
  /** The target item id, or `null` for layout-wide operations. */
  id: LayoutItem['i'] | null
  /** The committed layout before the operation. */
  previousLayout: ReadonlyLayout
  /** The committed layout retained after the operation. */
  layout: ReadonlyLayout
  /** The affected item snapshot, when the operation exposes one. Remove operations return the removed item. */
  candidate: ReadonlyLayoutItem | null
}

/** The accepted, unchanged, or rejected result of a layout operation. */
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

/** An operation result for a requested change that was applied. */
export type AcceptedLayoutOperationResult = Extract<LayoutOperationResult, { status: 'accepted' }>
/** An operation result for a request that was rejected. */
export type RejectedLayoutOperationResult = Extract<LayoutOperationResult, { status: 'rejected' }>

/** Per-item minimum row coordinates used by non-compacting placement. */
export type CompactMinPositions = ReadonlyMap<
  LayoutItem['i'],
  Readonly<{
    y: number
  }>
>

/** Options accepted by {@link normalizeLayout}. */
export interface NormalizeLayoutOptions {
  /** The positive number of grid columns. */
  readonly cols: number
  /** The positive maximum number of rows, or `Infinity` for no limit. */
  readonly maxRows?: number
  /** How collisions are resolved while normalizing. */
  readonly collisionMode?: CollisionMode
  /** The compactor used after bounds and collision normalization. */
  readonly compactor?: Compactor
}

/** Stable validation error codes thrown by the core API. */
export type GridLayoutValidationCode = 'invalid-layout' | 'invalid-config'
/** Stable extension error codes thrown by the core API. */
export type GridLayoutExtensionCode = 'extension-error' | 'extension-invalid-result'
/** The extension point responsible for a {@link GridLayoutExtensionCode}. */
export type GridLayoutExtensionSource = 'compactor' | 'position-strategy' | 'drop-config'

/** Built-in responsive breakpoint names. */
export type DefaultBreakpoint = 'xxs' | 'xs' | 'sm' | 'md' | 'lg'
/** @deprecated Use {@link DefaultBreakpoint} or a caller-defined breakpoint generic. */
export type Breakpoint = DefaultBreakpoint
/** Maps each breakpoint name to its minimum container width in pixels. */
export type Breakpoints<B extends string = DefaultBreakpoint> = Readonly<Record<B, number>>
/** A shared value or a complete value map keyed by breakpoint. */
export type ResponsiveValue<B extends string, T> = T | Readonly<Record<B, T>>
/** A possibly partial set of caller-authored layouts keyed by breakpoint. */
export type ResponsiveLayoutsInput<B extends string = DefaultBreakpoint> = Partial<
  Readonly<Record<B, ReadonlyLayout>>
>
/** A normalized layout map containing every configured breakpoint. */
export type CompleteResponsiveLayouts<B extends string = DefaultBreakpoint> = Readonly<
  Record<B, ReadonlyLayout>
>
/** @deprecated Use {@link ResponsiveLayoutsInput} or {@link CompleteResponsiveLayouts}. */
export type ResponsiveLayout = Record<DefaultBreakpoint, Layout>
