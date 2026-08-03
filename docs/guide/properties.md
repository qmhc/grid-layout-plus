---
title: Properties
description: Find details about GridLayout, GridItem, and GridBackground props, layout types, defaults, and extension interfaces.
---

# Properties

## Types

### LayoutItemRequired

```ts
interface LayoutItemRequired {
  w: number,
  h: number,
  x: number,
  y: number,
  i: number | string
}
```

### LayoutItem

```ts
type ResizeHandleAxis = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

interface LayoutItem extends LayoutItemRequired {
  minW?: number,
  minH?: number,
  maxW?: number,
  maxH?: number,
  moved?: boolean,
  static?: boolean,
  isDraggable?: boolean,
  isResizable?: boolean,
  resizeHandles?: readonly ResizeHandleAxis[],
  autoHeight?: boolean,
  zIndex?: number
}
```

### Layout

```ts
type Layout = Array<LayoutItem>
```

### DefaultBreakpoint and Breakpoints

```ts
type DefaultBreakpoint = 'xxs' | 'xs' | 'sm' | 'md' | 'lg'
type Breakpoints<B extends string = DefaultBreakpoint> = Readonly<Record<B, number>>
```

`Breakpoint` is a deprecated alias for `DefaultBreakpoint`. New code can use the default breakpoint names or pass a custom string union as `B`.

### Responsive layouts

```ts
type ResponsiveLayoutsInput<B extends string = DefaultBreakpoint> = Partial<
  Readonly<Record<B, ReadonlyLayout>>
>

type CompleteResponsiveLayouts<B extends string = DefaultBreakpoint> = Readonly<
  Record<B, ReadonlyLayout>
>

type ResponsiveValue<B extends string, T> = T | Readonly<Record<B, T>>
```

`ResponsiveLayoutsInput` is the partial breakpoint map accepted by `GridLayout`. `CompleteResponsiveLayouts` is the complete breakpoint map emitted after normalization. `ResponsiveValue` accepts either one value or a complete breakpoint map. The legacy `ResponsiveLayout` type is deprecated.

### CollisionMode

```ts
type CollisionMode = 'push' | 'prevent' | 'overlap'
```

### Compactor

A compactor receives a layout and column count, then returns a new layout with its gaps resolved.

```ts
interface Compactor {
  readonly type?: 'vertical' | 'horizontal'
  compact(layout: ReadonlyLayout, cols: number): Layout
  /** @deprecated Use GridLayout collisionMode="overlap" */
  allowOverlap?: boolean
}
```

Built-in compactors:

| Compactor                 | Description                                                                |
| ------------------------- | -------------------------------------------------------------------------- |
| `verticalCompactor`       | Compacts items upward (default, equivalent to v1 `verticalCompact: true`)  |
| `horizontalCompactor`     | Compacts items to the left and wraps when a row is full                    |
| `noCompactor`             | No compaction, free-form positioning                                       |
| `fastVerticalCompactor`   | Interval-indexed vertical compaction optimized for sparse candidate sets   |
| `fastHorizontalCompactor` | Interval-indexed horizontal compaction optimized for sparse candidate sets |
| `withOverlap(compactor)`  | Deprecated compatibility wrapper for the old overlap API                   |

The indexed compactors return the same Layout as the standard versions. Collision-query cost depends on how many candidates the interval index returns, so they do not claim an unconditional `O(n log n)` bound. Run `pnpm benchmark` to compare the fixed sparse, dense, large-coordinate, static-item, and candidate-count datasets. Benchmark timings are measurements, not unit-test thresholds.

### PositionStrategy

A positioning strategy converts grid geometry into DOM styles.

```ts
type PositionStyle = Readonly<
  Partial<
    Record<
      'position' | 'top' | 'left' | 'right' | 'width' | 'height' | 'transform',
      string
    >
  >
>

interface PositionStrategy {
  readonly usesCssTransforms: boolean
  readonly transformScale?: number
  getStyle(top: number, left: number, width: number, height: number): PositionStyle
  getRtlStyle(top: number, right: number, width: number, height: number): PositionStyle
}
```

Built-in strategies:

| Strategy                | Description                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| `transformStrategy`     | Uses CSS `translate3d` for positioning (default)                      |
| `absoluteStrategy`      | Uses CSS `top`/`left` for positioning                                 |
| `scaledStrategy(scale)` | Corrects pointer coordinates for a parent scaled with CSS `transform` |

`usesCssTransforms` is required. If provided, `transformScale` must be a positive finite number. Drag, resize, and external drop all use it when converting pointer coordinates.

### GridConfig

```ts
interface GridConfig<B extends string = DefaultBreakpoint> {
  autoHeight?: boolean
  colNum?: number
  rowHeight?: number
  maxRows?: number
  gap?: ResponsiveValue<B, readonly [number, number]>
  containerPadding?: ResponsiveValue<B, readonly [number, number]>
  autoSize?: boolean
}
```

### DragConfig

```ts
interface DragConfig {
  isDraggable?: boolean
  dragThreshold?: number
  restoreOnDrag?: boolean
}
```

### ResizeConfig

```ts
interface ResizeConfig {
  isResizable?: boolean
  handles?: readonly ResizeHandleAxis[]
}
```

### Drop types

```ts
type DropCandidate = Readonly<Omit<LayoutItem, 'i' | 'moved'>>

interface DropDragOverInput<B extends string = DefaultBreakpoint> {
  nativeEvent: DragEvent
  pointer: Readonly<{ clientX: number; clientY: number }>
  grid: Readonly<{ x: number; y: number }>
  candidate: DropCandidate
  layout: ReadonlyLayout
  breakpoint: B | null
  cols: number
}

interface DropDragOverContext<
  B extends string = DefaultBreakpoint,
> extends DropDragOverInput<B> {
  proposalId: number
  previewLayout: ReadonlyLayout
  insertionIndex: number
}

type DropEvaluationResult<B extends string = DefaultBreakpoint> =
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

type DropCreateItemContext<B extends string = DefaultBreakpoint> = Readonly<
  Extract<DropEvaluationResult<B>, { status: 'accepted' }>
>

interface DropCommitResult<B extends string = DefaultBreakpoint> {
  status: 'committed'
  proposalId: number
  breakpoint: B | null
  item: ReadonlyLayoutItem
  layout: ReadonlyLayout
  revision: number
}

interface DropConfig<B extends string = DefaultBreakpoint> {
  isDroppable?: boolean
  dropItem?: Readonly<{ w: number; h: number }>
  createItem(context: DropCreateItemContext<B>): ReadonlyLayoutItem | false
  onDragOver?(
    context: Readonly<DropDragOverInput<B>>,
  ): false | Readonly<{ w?: number; h?: number }>
}
```

`candidate` intentionally has no business id. `createItem` supplies the complete business item at release time; candidate `x`, `y`, `w`, and `h` override the factory geometry. Factory constraints that would change this accepted geometry are rejected as `extension-invalid-result`. The component proposes the insertion and emits `drop` only after the controlled Layout confirms it.

### Transfer types

```ts
interface TransferConfig {
  group: string
}
```

Grids in the same document accept item moves only when their non-empty `group` values match.

### Geometry types

```ts
interface GridGeometry {
  width: number
  cols: number
  rowHeight: number
  gap: readonly [number, number]
  containerPadding: readonly [number, number]
  rtl: boolean
  effectiveScale: number
}

interface PixelRect {
  top: number
  inlineStart: number
  width: number
  height: number
}

interface ReadonlyClientRect {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
  readonly width: number
  readonly height: number
}
```

The DOM-free `gridToPixelRect`, `pointerToGridPosition`, and `pixelSizeToGridSize` functions are exported from both `grid-layout-plus` and `grid-layout-plus/core`. They use the same scale- and RTL-aware geometry conversion as the drag, resize, and external-drop features.

## GridLayout

### layout

- type: `ReadonlyLayout`
- required

The grid layout. Each array item must include `i`, `x`, `y`, `w`, and `h`. See [`LayoutItem`](#layoutitem) for the optional item-level fields.

With the default `collision-mode="push"`, Grid Layout Plus validates and compacts the layout before the first render. It does not mutate the input array or its items. Use `v-model:layout` to receive the normalized layout.

### responsive-layouts

- type: `ResponsiveLayoutsInput<B>`
- default: `{}`

The author-provided layout for each breakpoint when `responsive` is `true`. Each key is a breakpoint name and each value follows the `layout` format, for example `{ lg: [layout items], md: [layout items] }`.

This prop is reactive. In controlled responsive mode, bind both `v-model:layout` and `v-model:responsive-layouts`; updates for the current Layout and the complete breakpoint map share one revision and must be written back in the same Vue update cycle.

See also [responsive](#responsive), [breakpoints](#breakpoints) and [cols](#cols).

### col-num

- type: `number`
- default: `12`

The number of grid columns. It must be a positive integer.

### row-height

- type: `number`
- default: `150`

The height of one row in pixels.

`LayoutItem.h` is the number of rows an item spans, not a pixel value. Its rendered height is
`h * rowHeight + (h - 1) * gap[1]`; spanning multiple rows also spans the gaps between them.

### max-rows

- type: `number`
- default: `Infinity`

The maximum number of rows.

### gap

- type: `ResponsiveValue<B, readonly [number, number]>`
- default: `[10, 10]`

The horizontal and vertical gaps between items, in pixels. Pass exactly two numbers: `[horizontal, vertical]`. In responsive mode, you can instead pass a complete breakpoint map.

### container-padding

- type: `ResponsiveValue<B, readonly [number, number]>`
- default: `[0, 0]`

The horizontal and vertical padding inside the layout container, in pixels. Pass `[horizontal, vertical]` or, in responsive mode, a complete breakpoint map.

### width

- type: `number`
- default: `undefined`

An explicit non-negative container width in pixels. When omitted, `GridLayout` observes its root element with `ResizeObserver`. A value of `0` is a resolved width with no renderable geometry, not an unresolved measurement.

### is-draggable

- type: `boolean`
- default: `true`

Whether items can be dragged.

### is-resizable

- type: `boolean`
- default: `true`

Whether items can be resized.

### is-mirrored

- type: `boolean`
- default: `false`

Whether to mirror the grid's horizontal direction.

### is-bounded

- type: `boolean`
- default: `false`

During a pointer drag, keeps the item's pixel rectangle inside the `GridLayout` root. It does not constrain resizing or replace layout, collision, or `maxRows` rules.

### auto-size

- type: `boolean`
- default: `true`

Whether the container height follows the layout content.

### auto-height

- type: `boolean`
- default: `false`

Whether item row heights follow their rendered content by default. Set `LayoutItem.autoHeight` to
`true` or `false` to override this value for one item. The required `LayoutItem.h` remains the
initial SSR height and the fallback when content cannot be measured.

An enabled `GridItem` must render exactly one content element. Grid Layout Plus observes that
element's border-box with one shared `ResizeObserver`, adds the `GridItem` padding and border, and
calculates:

```ts
h = Math.ceil((contentHeight + gap[1]) / (rowHeight + gap[1]))
```

The content element's margins are not measured. Hidden or zero-height content keeps the current
`h`. If `ResizeObserver` is unavailable, the current `h` is retained and an `error` with
`source: 'auto-height'` is emitted.

Measured changes are batched once per animation frame and emitted through the normal controlled
`update:layout` transaction with `meta.source === 'auto-height'`. Use `v-model:layout`; in responsive
mode, also use `v-model:responsive-layouts`. Until the proposal is written back, the previous
height stays committed.

`minH`, `maxH`, `maxRows`, `collisionMode`, and the active compactor still apply. Static and
non-resizable items may follow content height. Pointer resizing becomes width-only, and combining
auto height with `preserve-aspect-ratio` is reported as an invalid configuration.

### restore-on-drag

- type: `boolean`
- default: `false`

By default, the placeholder and emitted Layout show the Compactor result that will be committed on release. Set this to `true` to keep the active item at the pointer candidate while dragging. The final Compactor pass may still adjust the Layout after release.

### prevent-collision

- type: `boolean`
- default: `false`

Deprecated. Use [`collision-mode="prevent"`](#collision-mode) instead.

### collision-mode

- type: `'push' | 'prevent' | 'overlap'`
- default: `'push'`

Controls how drag and resize operations handle collisions:

- `push`: moves colliding items away and applies the configured compactor.
- `prevent`: keeps other items fixed and prevents the active item from occupying their space.
- `overlap`: allows free placement without moving other items and pauses automatic compaction.

An explicitly provided `collision-mode` takes precedence over the deprecated `prevent-collision` and `withOverlap()` APIs. Switching from `overlap` to another mode applies the configured compactor once to resolve overlaps.

### bring-to-front-on-interact

- type: `boolean`
- default: `true`

When `collision-mode="overlap"`, moves an item to the front when dragging or resizing starts. Set it to `false` when layer order is managed externally.

### responsive

- type: `boolean`
- default: `false`

Whether the layout responds to container-width changes.

See also [responsiveLayouts](#responsive-layouts), [breakpoints](#breakpoints) and [cols](#cols).

### breakpoints

- type: `Breakpoints<B>`
- default: `{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }`

The width thresholds used by responsive mode.

See also [responsiveLayouts](#responsive-layouts) and [cols](#cols)

### cols

- type: `Readonly<Record<B, number>>`
- default: `{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }`

The number of columns at each breakpoint.

### use-style-cursor

- type: `boolean`
- default: `true`

Whether Grid Layout Plus updates the cursor style during interactions. Set it to `false` if dynamic cursor styling causes drag issues.

**This property is not reactive.**

### compactor {#grid-layout-compactor}

- type: `Compactor`
- default: `verticalCompactor`

Sets the compaction algorithm for the layout. Import a built-in compactor from `grid-layout-plus`:

```ts
import { horizontalCompactor, noCompactor, verticalCompactor } from 'grid-layout-plus'
```

Compactors are paused while `collision-mode="overlap"` is active. `withOverlap(compactor)` remains available for compatibility but is deprecated.

### position-strategy

- type: `PositionStrategy`
- default: `transformStrategy`

Sets the positioning strategy for grid items. Import a built-in strategy from `grid-layout-plus`:

```ts
import { absoluteStrategy, scaledStrategy, transformStrategy } from 'grid-layout-plus'
```

Use `scaledStrategy(scale)` when an ancestor is rendered with the same CSS `transform: scale(...)`. The strategy keeps layout styles unchanged and converts drag, resize, and external drop pointer coordinates back to the unscaled grid coordinate system.

### is-droppable

- type: `boolean`
- default: `false`

Enables native HTML5 drag-and-drop into the grid from external elements. Configure [`drop-config`](#drop-config) with a required `createItem` factory. The component previews the candidate, proposes the created item through `update:layout`, and emits `drop` only after the parent confirms the controlled Layout.

### drop-item

- type: `{ w: number, h: number }`
- default: `{ w: 1, h: 1 }`

The default grid-unit size for items dropped from outside. It applies only when [`is-droppable`](#is-droppable) is `true`.

### drag-threshold

- type: `number`
- default: `0`

The minimum pointer movement, in pixels, before dragging starts. Increase it to reduce accidental drags. An item can override this value with its own `drag-threshold`.

### grid-config

- type: `GridConfig`
- default: `undefined`

A grouped configuration object for grid-related props. An explicitly provided individual prop takes precedence; otherwise the grouped value is used.

```ts
interface GridConfig<B extends string = DefaultBreakpoint> {
  autoHeight?: boolean
  colNum?: number
  rowHeight?: number
  maxRows?: number
  gap?: ResponsiveValue<B, readonly [number, number]>
  containerPadding?: ResponsiveValue<B, readonly [number, number]>
  autoSize?: boolean
}
```

### drag-config

- type: `DragConfig`
- default: `undefined`

A grouped configuration object for drag-related props. An explicitly provided individual prop takes precedence; otherwise the grouped value is used.

```ts
interface DragConfig {
  isDraggable?: boolean
  dragThreshold?: number
  restoreOnDrag?: boolean
}
```

### resize-config

- type: `ResizeConfig`
- default: `undefined`

A grouped configuration object for resize-related props. An explicitly provided `is-resizable` prop takes precedence; otherwise the grouped value is used.

```ts
interface ResizeConfig {
  isResizable?: boolean
  handles?: readonly ResizeHandleAxis[]
}
```

`handles` selects the edges and corners that render pointer handles. It accepts `n`, `ne`, `e`,
`se`, `s`, `sw`, `w`, and `nw`, and defaults to `['se']` for backward compatibility. Duplicate
directions are ignored after their first occurrence.

Set `LayoutItem.resizeHandles` to override the grid setting for one item. An empty array hides all
pointer resize handles for that item without changing the programmatic resize API. Updates to either
configuration take effect reactively; if the changed item is currently resizing, that interaction is
cancelled before the handles are rebound.

The enabled directions remain authoritative when handle visuals are customized. Use the
[`resize-handle` slot](#slots) to replace the visual content for each rendered direction; the slot
does not add or remove handles.

Directions follow the rendered grid: east and west swap sides in RTL or mirrored mode. With
content-driven `autoHeight`, pure north and south handles are omitted because pointer resizing cannot
set the height; diagonal handles remain available for width changes.

North and west resizing keeps the active item's opposite edge or corner anchored under the pointer.
In `push` collision mode, the placeholder and surrounding items preview the configured Compactor's
terminal Layout independently of that pointer geometry. Releasing the pointer places the active item
at the placeholder without another compaction or surrounding-item reflow.

### drop-config

- type: `DropConfig`
- default: `undefined`

A grouped configuration object for drop-related props. An explicitly provided individual prop takes precedence; otherwise the grouped value is used.

```ts
interface DropConfig<B extends string = DefaultBreakpoint> {
  isDroppable?: boolean
  dropItem?: Readonly<{ w: number; h: number }>
  createItem(context: DropCreateItemContext<B>): ReadonlyLayoutItem | false
  onDragOver?(
    context: Readonly<DropDragOverInput<B>>,
  ): false | Readonly<{ w?: number; h?: number }>
}
```

`onDragOver` receives the current candidate and committed Layout. Return `false` to reject it, or return `w` and/or `h` to change its size. `createItem` returns the complete application item or `false`; the accepted candidate geometry remains authoritative.

### transfer-config

- type: `TransferConfig`
- default: `undefined`

Enables move-only cross-grid dragging between grids in the same document and group. The target previews the incoming item without mutating either controlled model. On release, the source proposes removal and the target proposes insertion; both confirmations are required. A one-sided rejection triggers a compensating proposal on the confirmed side. Copy mode, nested-grid transfer, and preserving mounted component state across Teleport boundaries are not included.

Programmatic layout and layer operations are documented in [Methods](./methods).

## GridItem

`GridItem` must be a descendant of `GridLayout`. Its `i` prop associates it with the matching `LayoutItem`; the parent Layout owns geometry, constraints, static state, per-item drag and resize flags, resize handles, and layer order.

### i

- type: `number | string`
- required

The item's unique identifier. It must match exactly one `LayoutItem.i` in the parent Layout.

### auto-height

- type: `boolean`
- default: parent `GridLayout.autoHeight`

Enables content-driven row height when the matching `LayoutItem.autoHeight` is omitted. Prefer the
Layout field when the setting is part of persisted layout data. See [`GridLayout.auto-height`](#auto-height)
for the content-root, measurement, controlled-update, and resize contracts.

### is-bounded

- type: `boolean`
- default: `undefined`

During a pointer drag, keeps the item's pixel rectangle inside the `GridLayout` root. When omitted, it inherits `GridLayout.isBounded`. This prop does not constrain resizing.

### drag-ignore-from

- type: `string`
- default: `'a, button'`

Selectors for descendants that must not start dragging.

See `ignoreFrom` in the [interact.js documentation](http://interactjs.io/docs/#ignorable-selectors).

### drag-allow-from

- type: `string`
- default: `undefined`

Selectors for descendants that may start dragging.

When omitted, any descendant can start dragging unless it matches `drag-ignore-from`.

See `allowFrom` in the [interact.js documentation](http://interactjs.io/docs/#ignorable-selectors).

### resize-ignore-from

- type: `string`
- default: `'a, button'`

Selectors for descendants that must not start resizing.

See `ignoreFrom` in the [interact.js documentation](http://interactjs.io/docs/#ignorable-selectors).

### preserve-aspect-ratio

- type: `boolean`
- default: `false`

Whether the item keeps its aspect ratio while resizing.

### drag-option

- type: `Readonly<Record<string, unknown>>`
- default: `{}`

Validated options for the grid item's [interact.js draggable configuration](https://interactjs.io/docs/draggable/). Supported keys are `lockAxis`, `startAxis`, `mouseButtons`, `hold`, and `autoScroll`.

### resize-option

- type: `Readonly<Record<string, unknown>>`
- default: `{}`

Validated options for the grid item's [interact.js resizable configuration](https://interactjs.io/docs/resizable/). Supported keys are `mouseButtons`, `hold`, and `autoScroll`.

This option does not accept `edges`. Configure directions with `resizeConfig.handles` or
`LayoutItem.resizeHandles`, and customize their rendered visuals with the [`resize-handle`
slot](#slots).

### drag-threshold

- type: `number`
- default: `undefined`

The minimum drag distance for this item, in pixels. When omitted, it inherits [`drag-threshold`](#drag-threshold) from `GridLayout`.

### Deprecated compatibility props

`x`, `y`, `w`, `h`, `min-w`, `min-h`, `max-w`, `max-h`, `static`, `is-draggable`, `is-resizable`, and `z-index` remain optional `GridItem` props for v1 compatibility. Inside a valid `GridLayout`, they do not override the matching `LayoutItem`. Put these values in the parent `layout` instead.

## GridBackground

`GridBackground` draws grid lines behind the items. When it is rendered inside `GridLayout`, geometry props inherit from the parent unless explicitly provided.

| Prop                | Type                        | Default                                      | Description                        |
| ------------------- | --------------------------- | -------------------------------------------- | ---------------------------------- |
| `cols`              | `number`                    | parent `colNum`, otherwise `12`              | Number of columns.                 |
| `row-height`        | `number`                    | parent `rowHeight`, otherwise `150`          | Row height in pixels.              |
| `gap`               | `readonly [number, number]` | parent `gap`, otherwise `[10, 10]`           | Horizontal and vertical gaps.      |
| `container-padding` | `readonly [number, number]` | parent `containerPadding`, otherwise `[0,0]` | Padding around the drawn grid.     |
| `width`             | `number`                    | parent width, otherwise `0`                  | Drawing width in pixels.           |
| `rows`              | `number`                    | fills the available height                   | Optional number of rows to draw.   |
| `color`             | `string`                    | `rgba(0,0,0,0.1)`                            | Grid-line color.                   |
| `stroke-width`      | `number`                    | `1`                                          | Non-negative line width in pixels. |

See the [Grid Background example](../example/grid-background) for usage.

## Slots

The default slot accepts manually rendered `GridItem` components. The `item` slot lets `GridLayout`
create them and exposes this scope:

```ts
interface GridLayoutSlotScope {
  item: ReadonlyLayoutItem
  index: number
  style: Readonly<Record<string, string>>
  isDragging: boolean
  isResizing: boolean
}
```

The `resize-handle` slot customizes the visual content inside every enabled pointer resize handle:

```ts
interface GridItemResizeHandleSlotScope {
  readonly axis: ResizeHandleAxis
  readonly direction: ResizeHandleAxis
}

interface GridLayoutResizeHandleSlotScope extends GridItemResizeHandleSlotScope {
  readonly item: ReadonlyLayoutItem
  readonly index: number
}
```

`axis` is the direction selected by `resizeConfig.handles` or `LayoutItem.resizeHandles`.
`direction` is the physical direction after RTL or mirrored rendering; use it when an arrow or icon
must point toward the rendered side. In left-to-right layouts the two values are identical.

Grid Layout Plus keeps ownership of the outer handle element, its position, pointer hit area, cursor,
and resize binding. Slot content is visual and pointer-only. Returning no content does not disable the
direction; remove it from `handles` instead. Handles omitted by `autoHeight` are not rendered and do
not invoke the slot.

When `GridLayout` creates items through its `item` slot, provide the sibling `resize-handle` slot on
`GridLayout`:

```vue
<GridLayout v-model:layout="layout" :resize-config="{ handles: ['n', 'e', 'se'] }">
  <template #item="{ item }">{{ item.i }}</template>
  <template #resize-handle="{ item, axis, direction }">
    <CustomHandle :item="item" :axis="axis" :direction="direction" />
  </template>
</GridLayout>
```

When rendering `GridItem` manually in the default slot, provide the same named slot directly on each
`GridItem`; its scope contains `axis` and `direction`.

See [Render items](./usage#render-items) for both item-rendering patterns and the [Custom Resize
Handles example](../example/custom-resize-handles) for a complete slot implementation.
