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

/**
 * Groups the geometry and sizing options accepted by {@link GridLayoutProps}.
 *
 * @typeParam B - Breakpoint names used by responsive values.
 */
export interface GridConfig<B extends string = DefaultBreakpoint> {
  /**
   * Whether item row heights follow their rendered content by default.
   *
   * Individual layout items may override this with `LayoutItem.autoHeight`.
   *
   * @defaultValue `false`
   */
  autoHeight?: boolean
  /**
   * The number of grid columns.
   *
   * @defaultValue `12`
   */
  colNum?: number
  /**
   * The height of one grid row in pixels.
   *
   * @defaultValue `150`
   */
  rowHeight?: number
  /**
   * The maximum number of rows the layout may occupy.
   *
   * @defaultValue `Infinity`
   */
  maxRows?: number
  /**
   * The horizontal and vertical gaps, either shared or keyed by breakpoint.
   *
   * @defaultValue `[10, 10]`
   */
  gap?: ResponsiveValue<B, readonly [number, number]>
  /**
   * The horizontal and vertical container padding, either shared or keyed by breakpoint.
   *
   * @defaultValue `[0, 0]`
   */
  containerPadding?: ResponsiveValue<B, readonly [number, number]>
  /**
   * Whether the container height follows the layout content.
   *
   * @defaultValue `true`
   */
  autoSize?: boolean
}

/** Groups the drag options accepted by {@link GridLayoutProps}. */
export interface DragConfig {
  /**
   * Whether layout items can be dragged.
   *
   * @defaultValue `true`
   */
  isDraggable?: boolean
  /**
   * The pointer distance required to start dragging, in pixels.
   *
   * @defaultValue `0`
   */
  dragThreshold?: number
  /**
   * Whether the active item stays at the pointer candidate until release.
   *
   * @defaultValue `false`
   */
  restoreOnDrag?: boolean
}

/** Groups the resize options accepted by {@link GridLayoutProps}. */
export interface ResizeConfig {
  /**
   * Whether layout items can be resized.
   *
   * @defaultValue `true`
   */
  isResizable?: boolean
}

/** A normalized external-drop candidate before the application assigns an item id. */
export type DropCandidate = Readonly<Omit<LayoutItem, 'i' | 'moved'>>

/**
 * Describes an external drag candidate before collision and bounds checks run.
 *
 * @typeParam B - Breakpoint names used by the grid.
 */
export interface DropDragOverInput<B extends string = DefaultBreakpoint> {
  /** The native drag event being evaluated. */
  nativeEvent: DragEvent
  /** The pointer position in viewport coordinates. */
  pointer: Readonly<{ clientX: number; clientY: number }>
  /** The candidate position in grid coordinates. */
  grid: Readonly<{ x: number; y: number }>
  /** The candidate item without an application-defined id. */
  candidate: DropCandidate
  /** A snapshot of the currently committed layout. */
  layout: ReadonlyLayout
  /** The active responsive breakpoint, or `null` outside resolved responsive mode. */
  breakpoint: B | null
  /** The number of columns used to evaluate the candidate. */
  cols: number
}

/**
 * Describes an accepted external-drag preview emitted by `GridLayout`.
 *
 * @typeParam B - Breakpoint names used by the grid.
 */
export interface DropDragOverContext<
  B extends string = DefaultBreakpoint,
> extends DropDragOverInput<B> {
  /** The id of this drop evaluation. */
  proposalId: number
  /** The normalized positions of existing items while previewing the candidate. */
  previewLayout: ReadonlyLayout
  /** The index where the application can insert the candidate. */
  insertionIndex: number
}

/**
 * The result of evaluating an external drag candidate.
 *
 * @typeParam B - Breakpoint names used by the grid.
 */
export type DropEvaluationResult<B extends string = DefaultBreakpoint> =
  | {
      /** Indicates that the candidate passed callback, collision, and bounds checks. */
      status: 'accepted'
      /** The id of the accepted drop evaluation. */
      proposalId: number
      /** The breakpoint used to evaluate the candidate. */
      breakpoint: B | null
      /** The accepted candidate without an application-defined id. */
      candidate: DropCandidate
      /** The normalized positions of existing items while previewing the candidate. */
      previewLayout: ReadonlyLayout
      /** The index where the application can insert the candidate. */
      insertionIndex: number
      /** The native drag event that produced the result. */
      nativeEvent: DragEvent
    }
  | {
      /** Indicates that the candidate was not accepted. */
      status: 'rejected'
      /** The rule or extension failure that rejected the candidate. */
      reason:
        | 'callback-rejected'
        | 'invalid-input'
        | 'collision'
        | 'out-of-bounds'
        | 'max-rows'
        | 'no-position'
        | 'extension-error'
        | 'extension-invalid-result'
      /** The native drag event that produced the result. */
      nativeEvent: DragEvent
    }

/** An external item factory receives the last accepted preview at release time. */
export type DropCreateItemContext<B extends string = DefaultBreakpoint> = Readonly<
  Extract<DropEvaluationResult<B>, { status: 'accepted' }>
>

/** Reports an external item after its controlled insertion has committed. */
export interface DropCommitResult<B extends string = DefaultBreakpoint> {
  /** Indicates that both controlled models accepted the insertion. */
  status: 'committed'
  /** The preview proposal that produced this insertion. */
  proposalId: number
  /** The responsive breakpoint that received the item, or `null`. */
  breakpoint: B | null
  /** The complete item created by the application at the committed grid geometry. */
  item: ReadonlyLayoutItem
  /** The normalized layout committed by the parent component. */
  layout: ReadonlyLayout
  /** The controlled transaction revision. */
  revision: number
}

/**
 * Configures native HTML drag-and-drop into a `GridLayout`.
 *
 * @typeParam B - Breakpoint names used by the grid.
 */
export interface DropConfig<B extends string = DefaultBreakpoint> {
  /**
   * Whether the grid evaluates items dragged from outside the component.
   *
   * @defaultValue `false`
   */
  isDroppable?: boolean
  /**
   * The default candidate size in grid units.
   *
   * @defaultValue `{ w: 1, h: 1 }`
   */
  dropItem?: Readonly<{ w: number; h: number }>
  /**
   * Creates the complete application item when an accepted preview is released.
   *
   * Candidate `x`, `y`, `w`, and `h` are authoritative and replace the corresponding values
   * returned by this callback. Return `false` to reject the drop explicitly.
   *
   * @param context - The last accepted and normalized preview.
   * @returns A complete item with a unique application id, or `false` to reject it.
   */
  createItem(context: DropCreateItemContext<B>): ReadonlyLayoutItem | false
  /**
   * Reviews or resizes an external drag candidate before layout rules are applied.
   *
   * @param context - The pointer, candidate, layout, and responsive state for this evaluation.
   * @returns `false` to reject the candidate, or dimensions to override its size.
   */
  onDragOver?(context: Readonly<DropDragOverInput<B>>): false | Readonly<{ w?: number; h?: number }>
}

/** Configures item moves between `GridLayout` instances in the same document. */
export interface TransferConfig {
  /** Only grids with the same non-empty group accept transfers from each other. */
  group: string
}

/** Reports a cross-grid move after both controlled layouts have committed. */
export interface GridTransferResult {
  /** Indicates that both the source removal and target insertion committed. */
  status: 'committed'
  /** The complete item at its committed target geometry. */
  item: ReadonlyLayoutItem
  /** The source grid layout after removal. */
  sourceLayout: ReadonlyLayout
  /** The target grid layout after insertion. */
  targetLayout: ReadonlyLayout
  /** The source grid's controlled transaction revision. */
  sourceRevision: number
  /** The target grid's controlled transaction revision. */
  targetRevision: number
  /** The active source breakpoint, or `null`. */
  sourceBreakpoint: string | null
  /** The active target breakpoint, or `null`. */
  targetBreakpoint: string | null
}

/**
 * Props accepted by the `GridLayout` component.
 *
 * Explicit flat props take precedence over their grouped configuration counterparts.
 *
 * @typeParam B - Breakpoint names used by responsive props.
 */
export interface GridLayoutProps<B extends string = DefaultBreakpoint> {
  /**
   * Whether item row heights follow their rendered content by default.
   *
   * Individual layout items may override this with `LayoutItem.autoHeight`.
   * The controlled layout must commit emitted height proposals.
   *
   * @defaultValue `false`
   */
  autoHeight?: boolean
  /**
   * Whether the container height follows the layout content.
   *
   * @defaultValue `true`
   */
  autoSize?: boolean
  /**
   * The number of grid columns.
   *
   * @defaultValue `12`
   */
  colNum?: number
  /**
   * The height of one grid row in pixels.
   *
   * @defaultValue `150`
   */
  rowHeight?: number
  /**
   * The maximum number of rows the layout may occupy.
   *
   * @defaultValue `Infinity`
   */
  maxRows?: number
  /**
   * The horizontal and vertical gaps, either shared or keyed by breakpoint.
   *
   * @defaultValue `[10, 10]`
   */
  gap?: ResponsiveValue<B, readonly [number, number]>
  /**
   * The horizontal and vertical container padding, either shared or keyed by breakpoint.
   *
   * @defaultValue `[0, 0]`
   */
  containerPadding?: ResponsiveValue<B, readonly [number, number]>
  /** An explicit container width in pixels; otherwise the root element is observed. */
  width?: number
  /**
   * Whether layout items can be dragged.
   *
   * @defaultValue `true`
   */
  isDraggable?: boolean
  /**
   * Whether layout items can be resized.
   *
   * @defaultValue `true`
   */
  isResizable?: boolean
  /**
   * Whether the grid mirrors its horizontal direction.
   *
   * @defaultValue `false`
   */
  isMirrored?: boolean
  /**
   * Whether pointer dragging stays within the grid root.
   *
   * @defaultValue `false`
   */
  isBounded?: boolean
  /**
   * Whether the active item stays at the pointer candidate until release.
   *
   * @defaultValue `false`
   */
  restoreOnDrag?: boolean
  /** The controlled layout. Each item id must be unique. */
  layout: ReadonlyLayout
  /**
   * Whether layout selection follows the container width.
   *
   * @defaultValue `false`
   */
  responsive?: boolean
  /**
   * Author-provided layouts keyed by breakpoint.
   *
   * @defaultValue `{}`
   */
  responsiveLayouts?: ResponsiveLayoutsInput<B>
  /**
   * Minimum container widths keyed by breakpoint.
   *
   * @defaultValue `{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }`
   */
  breakpoints?: Breakpoints<B>
  /**
   * Column counts keyed by breakpoint.
   *
   * @defaultValue `{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }`
   */
  cols?: Readonly<Record<B, number>>
  /**
   * How layout operations handle item collisions.
   *
   * @defaultValue `'push'`
   */
  collisionMode?: CollisionMode
  /**
   * Whether collisions block movement and resizing instead of moving other items.
   *
   * @defaultValue `false`
   * @deprecated Use `collisionMode: 'prevent'` instead.
   */
  preventCollision?: boolean
  /**
   * Whether an interaction raises its item above other items in overlap mode.
   *
   * @defaultValue `true`
   */
  bringToFrontOnInteract?: boolean
  /**
   * Whether the component changes cursor styles during interactions.
   *
   * @defaultValue `true`
   */
  useStyleCursor?: boolean

  /**
   * The algorithm used to remove layout gaps.
   *
   * @defaultValue `verticalCompactor`
   */
  compactor?: Compactor
  /**
   * The strategy used to convert item geometry into CSS styles.
   *
   * @defaultValue `transformStrategy`
   */
  positionStrategy?: PositionStrategy
  /**
   * Whether the grid evaluates items dragged from outside the component.
   *
   * @defaultValue `false`
   */
  isDroppable?: boolean
  /**
   * The default size of an external-drop candidate in grid units.
   *
   * @defaultValue `{ w: 1, h: 1 }`
   */
  dropItem?: Readonly<{ w: number; h: number }>
  /**
   * The pointer distance required to start dragging, in pixels.
   *
   * @defaultValue `0`
   */
  dragThreshold?: number

  /** Grouped grid geometry and sizing options. */
  gridConfig?: GridConfig<B>
  /** Grouped drag options. */
  dragConfig?: DragConfig
  /** Grouped resize options. */
  resizeConfig?: ResizeConfig
  /** Grouped external-drop options. */
  dropConfig?: DropConfig<B>
  /** Enables moving items between grids in the same non-empty group. */
  transferConfig?: TransferConfig
}

/** Props accepted by the `GridItem` component. */
export interface GridItemProps {
  /** The id of the matching item in the parent layout. */
  i: number | string
  /** @deprecated `GridLayout` reads `x` from the matching `LayoutItem`. */
  x?: number
  /** @deprecated `GridLayout` reads `y` from the matching `LayoutItem`. */
  y?: number
  /** @deprecated `GridLayout` reads `w` from the matching `LayoutItem`. */
  w?: number
  /** @deprecated `GridLayout` reads `h` from the matching `LayoutItem`. */
  h?: number
  /** @deprecated `GridLayout` reads `static` from the matching `LayoutItem`. */
  static?: boolean
  /** @deprecated `GridLayout` reads `minH` from the matching `LayoutItem`. */
  minH?: number
  /** @deprecated `GridLayout` reads `minW` from the matching `LayoutItem`. */
  minW?: number
  /** @deprecated `GridLayout` reads `maxH` from the matching `LayoutItem`. */
  maxH?: number
  /** @deprecated `GridLayout` reads `maxW` from the matching `LayoutItem`. */
  maxW?: number
  /** @deprecated `GridLayout` reads `zIndex` from the matching `LayoutItem`. */
  zIndex?: number
  /** @deprecated `GridLayout` reads `isDraggable` from the matching `LayoutItem`. */
  isDraggable?: boolean
  /** @deprecated `GridLayout` reads `isResizable` from the matching `LayoutItem`. */
  isResizable?: boolean
  /**
   * Whether this item's row height follows its single rendered content root.
   *
   * The matching `LayoutItem.autoHeight` takes precedence, followed by this prop and the parent
   * `GridLayout.autoHeight` default.
   */
  autoHeight?: boolean
  /** Whether pointer dragging stays within the grid root; inherits the parent value when omitted. */
  isBounded?: boolean
  /**
   * CSS selectors for descendants that must not start dragging.
   *
   * @defaultValue `'a, button'`
   */
  dragIgnoreFrom?: string
  /** CSS selectors for descendants that may start dragging. */
  dragAllowFrom?: string
  /**
   * CSS selectors for descendants that must not start resizing.
   *
   * @defaultValue `'a, button'`
   */
  resizeIgnoreFrom?: string
  /**
   * Whether resizing preserves the item's current aspect ratio.
   *
   * @defaultValue `false`
   */
  preserveAspectRatio?: boolean
  /**
   * Additional options passed to the Interact.js draggable configuration.
   *
   * @defaultValue `{}`
   */
  dragOption?: Readonly<Record<string, unknown>>
  /**
   * Additional options passed to the Interact.js resizable configuration.
   *
   * @defaultValue `{}`
   */
  resizeOption?: Readonly<Record<string, unknown>>

  /** The pointer distance required to start dragging this item, in pixels. */
  dragThreshold?: number

  /** @internal Set when `GridLayout` creates the item for its `item` slot. */
  internal?: boolean

  /** @internal Excludes placeholder nodes from `LayoutItem` registration. */
  decorative?: boolean
}

/** Events emitted by the `GridItem` component. */
export interface GridItemEmits {
  /**
   * Reports a rendered size change caused by a container update.
   *
   * @param event - The emitted event name.
   * @param id - The item id.
   * @param h - The new height in grid rows.
   * @param w - The new width in grid columns.
   * @param pixelHeight - The new CSS height.
   * @param pixelWidth - The new CSS width.
   */
  (
    event: 'container-resized',
    id: LayoutItem['i'],
    h: number,
    w: number,
    pixelHeight: string,
    pixelWidth: string,
  ): void
  /**
   * Reports an in-progress or completed resize.
   *
   * @param event - Whether the resize is in progress or complete.
   * @param id - The item id.
   * @param h - The new height in grid rows.
   * @param w - The new width in grid columns.
   * @param pixelHeight - The new height in pixels.
   * @param pixelWidth - The new width in pixels.
   */
  (
    event: 'resize' | 'resized',
    id: LayoutItem['i'],
    h: number,
    w: number,
    pixelHeight: number,
    pixelWidth: number,
  ): void
  /**
   * Reports an in-progress or completed move.
   *
   * @param event - Whether the move is in progress or complete.
   * @param id - The item id.
   * @param x - The new column coordinate.
   * @param y - The new row coordinate.
   */
  (event: 'move' | 'moved', id: LayoutItem['i'], x: number, y: number): void
}

/** Identifies the component transaction associated with a layout update. */
export interface LayoutUpdateMeta {
  /** The monotonically increasing transaction revision. */
  revision: number
  /** The action that produced the layout update. */
  source:
    | 'interaction'
    | 'programmatic'
    | 'responsive'
    | 'width'
    | 'config'
    | 'external'
    | 'drop-commit'
    | 'transfer'
    | 'auto-height'
}

/**
 * The responsive values selected for a resolved container width.
 *
 * @typeParam B - Breakpoint names used by the responsive configuration.
 */
export interface ResponsiveWidthState<B extends string = DefaultBreakpoint> {
  /** The active breakpoint, or `null` before responsive resolution. */
  breakpoint: B | null
  /** The active column count. */
  cols: number
  /** The active horizontal and vertical gaps. */
  gap: readonly [number, number]
  /** The active horizontal and vertical container padding. */
  containerPadding: readonly [number, number]
}

/**
 * Describes an explicit or observed container-width update.
 *
 * @typeParam B - Breakpoint names used by the responsive configuration.
 */
export interface WidthChangedPayload<B extends string = DefaultBreakpoint> {
  /** The resolved container width in pixels. */
  width: number
  /** Whether the resolved width is zero or can produce renderable geometry. */
  state: 'resolved-zero' | 'resolved'
  /** The source of the width value. */
  source: 'explicit' | 'observer'
  /** Whether responsive mode was enabled for this evaluation. */
  responsive: boolean
  /** The responsive state selected by the new width. */
  candidate: ResponsiveWidthState<B>
  /** The responsive state currently committed by the component. */
  committed: ResponsiveWidthState<B>
}

/** The immediate result returned by a public `GridLayout` command. */
export type LayoutTransactionReceipt =
  | {
      /** Indicates that the component emitted a proposal and is waiting for controlled prop confirmation. */
      status: 'pending'
      /** The revision assigned to the pending proposal. */
      revision: number
      /** The accepted operation proposed to the parent component. */
      proposal: AcceptedLayoutOperationResult
    }
  | Extract<LayoutOperationResult, { status: 'unchanged' | 'rejected' }>

/** Describes the start of a native drag or resize interaction. */
export interface InteractionStartPayload {
  /** The interaction kind. */
  type: 'drag' | 'resize'
  /** The id of the active item. */
  id: LayoutItem['i']
  /** No revision exists until the interaction produces an accepted candidate. */
  revision: null
  /** The item snapshot from before the interaction. */
  oldItem: ReadonlyLayoutItem
  /** The item snapshot at interaction start. */
  item: ReadonlyLayoutItem
  /** The committed layout at interaction start. */
  layout: ReadonlyLayout
  /** No placeholder exists until the interaction changes the layout. */
  placeholder: null
  /** The native event that started the interaction. */
  nativeEvent: Event
}

/** Describes an accepted drag or resize candidate during an interaction. */
export interface InteractionChangePayload {
  /** The interaction kind. */
  type: 'drag' | 'resize'
  /** The id of the active item. */
  id: LayoutItem['i']
  /** The revision assigned to this candidate. */
  revision: number
  /** The item snapshot from before the interaction. */
  oldItem: ReadonlyLayoutItem
  /** The active item at the candidate position or size. */
  item: ReadonlyLayoutItem
  /** The normalized layout proposed by this candidate. */
  layout: ReadonlyLayout
  /** The placeholder rendered for this candidate. */
  placeholder: ReadonlyLayoutItem
  /** The latest native event, when available. */
  nativeEvent: Event | null
}

/** Values passed to the `GridLayout` item slot. */
export interface GridLayoutSlotScope {
  /** The layout item being rendered. */
  item: ReadonlyLayoutItem
  /** The item's index in layout order. */
  index: number
  /** The positioning styles calculated for the item. */
  style: Readonly<Record<string, string>>
  /** Whether this item is currently being dragged. */
  isDragging: boolean
  /** Whether this item is currently being resized. */
  isResizing: boolean
}

/** Slots accepted by the `GridLayout` component. */
export interface GridLayoutSlots {
  /** Renders the content of a `GridItem` created by `GridLayout`. */
  item?(scope: GridLayoutSlotScope): VNodeChild
  /** Renders manually managed `GridItem` descendants. */
  default?(): VNodeChild
}

/** Public fields and commands exposed by a `GridLayout` component ref. */
export interface GridLayoutExpose {
  /** A readonly ref to the component's root element. */
  root: Readonly<Ref<HTMLElement | null>>
  /**
   * Validates and proposes a replacement layout.
   *
   * @param layout - The complete layout to propose.
   * @returns A controlled transaction receipt.
   */
  setLayout(layout: ReadonlyLayout): LayoutTransactionReceipt
  /**
   * Proposes new grid coordinates for one item.
   *
   * @param id - The id of the item to move.
   * @param x - The proposed column coordinate.
   * @param y - The proposed row coordinate.
   * @returns A controlled transaction receipt.
   */
  moveItem(id: LayoutItem['i'], x: number, y: number): LayoutTransactionReceipt
  /**
   * Proposes a new grid size for one item.
   *
   * @param id - The id of the item to resize.
   * @param w - The proposed width in grid columns.
   * @param h - The proposed height in grid rows.
   * @returns A controlled transaction receipt.
   */
  resizeItem(id: LayoutItem['i'], w: number, h: number): LayoutTransactionReceipt
  /**
   * Validates and proposes inserting an item.
   *
   * @param item - The complete item to insert, including a unique id.
   * @returns A controlled transaction receipt.
   */
  addItem(item: ReadonlyLayoutItem): LayoutTransactionReceipt
  /**
   * Proposes removing an item.
   *
   * @param id - The id of the item to remove.
   * @returns A controlled transaction receipt.
   */
  removeItem(id: LayoutItem['i']): LayoutTransactionReceipt
  /**
   * Proposes moving an item to the highest layer in overlap mode.
   *
   * @param id - The id of the item to raise.
   * @returns A controlled transaction receipt.
   */
  bringToFront(id: LayoutItem['i']): LayoutTransactionReceipt
  /**
   * Proposes moving an item to the lowest layer in overlap mode.
   *
   * @param id - The id of the item to lower.
   * @returns A controlled transaction receipt.
   */
  sendToBack(id: LayoutItem['i']): LayoutTransactionReceipt
}

/**
 * Events emitted by the `GridLayout` component.
 *
 * @typeParam B - Breakpoint names used by responsive events.
 */
export interface GridLayoutEmits<B extends string = DefaultBreakpoint> {
  /**
   * Proposes a controlled layout update.
   *
   * @param event - The emitted event name.
   * @param layout - The proposed normalized layout.
   * @param meta - The transaction revision and source.
   */
  (event: 'update:layout', layout: ReadonlyLayout, meta: LayoutUpdateMeta): void
  /**
   * Reports the normalized layout before the component mounts.
   *
   * @param event - The emitted event name.
   * @param layout - The normalized initial layout.
   */
  (event: 'layout-before-mount', layout: ReadonlyLayout): void
  /**
   * Reports the committed layout after the component mounts.
   *
   * @param event - The emitted event name.
   * @param layout - The committed layout.
   */
  (event: 'layout-mounted', layout: ReadonlyLayout): void
  /**
   * Reports that the first renderable layout is ready.
   *
   * @param event - The emitted event name.
   * @param layout - The ready layout.
   */
  (event: 'layout-ready', layout: ReadonlyLayout): void
  /**
   * Reports a layout after its controlled proposal has committed.
   *
   * @param event - The emitted event name.
   * @param layout - The committed layout.
   * @param meta - The transaction revision and source.
   */
  (event: 'layout-updated', layout: ReadonlyLayout, meta: LayoutUpdateMeta): void
  /**
   * Reports a responsive breakpoint change and its selected layout.
   *
   * @param event - The emitted event name.
   * @param breakpoint - The active breakpoint, or `null` before resolution.
   * @param layout - The layout selected for the breakpoint.
   * @param meta - The transaction revision and source.
   */
  (
    event: 'breakpoint-changed',
    breakpoint: B | null,
    layout: ReadonlyLayout,
    meta: LayoutUpdateMeta,
  ): void
  /**
   * Reports an accepted external-drag preview.
   *
   * @param event - The emitted event name.
   * @param context - The candidate, preview layout, and responsive state.
   * @param nativeEvent - The native drag event.
   */
  (event: 'drop-drag-over', context: DropDragOverContext<B>, nativeEvent: DragEvent): void
  /**
   * Reports an external drop that passed evaluation.
   *
   * @param event - The emitted event name.
   * @param result - The accepted drop result.
   * @param nativeEvent - The native drop event.
   */
  (
    event: 'drop',
    result: DropCommitResult<B>,
    nativeEvent: DragEvent,
  ): void
  /**
   * Reports that an external drag left the grid.
   *
   * @param event - The emitted event name.
   * @param nativeEvent - The native drag-leave event.
   */
  (event: 'drop-drag-leave', nativeEvent: DragEvent): void
  /**
   * Reports a cross-grid move after both controlled layouts commit.
   *
   * The source and target grids each emit this event once with the same result.
   */
  (event: 'transfer', result: GridTransferResult, nativeEvent: Event): void
  /**
   * Proposes a complete controlled responsive-layout map.
   *
   * @param event - The emitted event name.
   * @param layouts - The complete normalized breakpoint map.
   * @param meta - The transaction revision and source shared with the layout proposal.
   */
  (
    event: 'update:responsive-layouts',
    layouts: CompleteResponsiveLayouts<B>,
    meta: LayoutUpdateMeta,
  ): void
  /**
   * Reports an explicit or observed container-width change.
   *
   * @param event - The emitted event name.
   * @param payload - The width source and responsive candidate state.
   * @param meta - The transaction revision and source.
   */
  (event: 'width-changed', payload: WidthChangedPayload<B>, meta: LayoutUpdateMeta): void
  /**
   * Reports the start of a drag or resize interaction.
   *
   * @param event - The emitted event name.
   * @param payload - The initial item, layout, and native event.
   */
  (event: 'interaction-start', payload: InteractionStartPayload): void
  /**
   * Reports an accepted drag or resize candidate.
   *
   * @param event - The emitted event name.
   * @param payload - The candidate item, layout, placeholder, and revision.
   */
  (event: 'interaction-change', payload: InteractionChangePayload): void
  /**
   * Reports the terminal state of a drag or resize interaction.
   *
   * @param event - The emitted event name.
   * @param payload - The committed, unchanged, or cancelled terminal state.
   */
  (event: 'interaction-end', payload: InteractionTerminalPayload): void
  /**
   * Reports an operation rejected by validation, configuration, or layout rules.
   *
   * @param event - The emitted event name.
   * @param payload - The rejected operation and retained layout state.
   */
  (event: 'operation-rejected', payload: OperationRejectedPayload): void
  /**
   * Reports a recoverable runtime error while preserving the last valid state.
   *
   * @param event - The emitted event name.
   * @param payload - The structured runtime error.
   */
  (event: 'error', payload: GridLayoutRuntimeError): void
}
