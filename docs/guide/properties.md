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
interface LayoutItem extends LayoutItemRequired {
  minW?: number,
  minH?: number,
  maxW?: number,
  maxH?: number,
  moved?: boolean,
  static?: boolean,
  isDraggable?: boolean,
  isResizable?: boolean,
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
  colNum?: number
  rowHeight?: number
  maxRows?: number
  margin?: ResponsiveValue<B, readonly [number, number]>
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

interface DropConfig<B extends string = DefaultBreakpoint> {
  isDroppable?: boolean
  dropItem?: Readonly<{ w: number; h: number }>
  onDragOver?(
    context: Readonly<DropDragOverInput<B>>,
  ): false | Readonly<{ w?: number; h?: number }>
}
```

`candidate` intentionally has no business id. `previewLayout` contains only the normalized positions of existing items.

### Geometry types

```ts
interface GridGeometry {
  width: number
  cols: number
  rowHeight: number
  margin: readonly [number, number]
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

### max-rows

- type: `number`
- default: `Infinity`

The maximum number of rows.

### margin

- type: `ResponsiveValue<B, readonly [number, number]>`
- default: `[10, 10]`

The horizontal and vertical gaps between items, in pixels. Pass exactly two numbers: `[horizontal, vertical]`. In responsive mode, you can instead pass a complete breakpoint map.

### container-padding

- type: `ResponsiveValue<B, readonly [number, number]>`
- default: the resolved `margin`

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

Enables native HTML5 drag-and-drop into the grid from external elements. Use together with [`drop-item`](#drop-item) and the [drop events](./events#drop-drag-over).

`GridLayout` only evaluates and previews an external drop. It does not create a business id, insert the candidate, or emit `update:layout`. The `drop` listener must insert the accepted candidate and write back the Layout.

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
  colNum?: number
  rowHeight?: number
  maxRows?: number
  margin?: ResponsiveValue<B, readonly [number, number]>
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
}
```

### drop-config

- type: `DropConfig`
- default: `undefined`

A grouped configuration object for drop-related props. An explicitly provided individual prop takes precedence; otherwise the grouped value is used.

```ts
interface DropConfig<B extends string = DefaultBreakpoint> {
  isDroppable?: boolean
  dropItem?: Readonly<{ w: number; h: number }>
  onDragOver?(
    context: Readonly<DropDragOverInput<B>>,
  ): false | Readonly<{ w?: number; h?: number }>
}
```

`onDragOver` receives the current candidate and committed Layout. Return `false` to reject it, or return `w` and/or `h` to change its size. After a size change, the component recalculates the candidate around the same pointer before checking collisions and bounds.

Programmatic layout and layer operations are documented in [Methods](./methods).

## GridItem

`GridItem` must be a descendant of `GridLayout`. Its `i` prop associates it with the matching `LayoutItem`; the parent Layout owns geometry, constraints, static state, per-item drag and resize flags, and layer order.

### i

- type: `number | string`
- required

The item's unique identifier. It must match exactly one `LayoutItem.i` in the parent Layout.

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

Pass-through options for the grid item's [interact.js draggable configuration](https://interactjs.io/docs/draggable/).

### resize-option

- type: `Readonly<Record<string, unknown>>`
- default: `{}`

Pass-through options for the grid item's [interact.js resizable configuration](https://interactjs.io/docs/resizable/).

### drag-threshold

- type: `number`
- default: `undefined`

The minimum drag distance for this item, in pixels. When omitted, it inherits [`drag-threshold`](#drag-threshold) from `GridLayout`.

### Deprecated compatibility props

`x`, `y`, `w`, `h`, `min-w`, `min-h`, `max-w`, `max-h`, `static`, `is-draggable`, `is-resizable`, and `z-index` remain optional `GridItem` props for v1 compatibility. Inside a valid `GridLayout`, they do not override the matching `LayoutItem`. Put these values in the parent `layout` instead.

## GridBackground

`GridBackground` draws grid lines behind the items. When it is rendered inside `GridLayout`, geometry props inherit from the parent unless explicitly provided.

| Prop           | Type                        | Default                               | Description                        |
| -------------- | --------------------------- | ------------------------------------- | ---------------------------------- |
| `cols`         | `number`                    | parent `colNum`, otherwise `12`       | Number of columns.                 |
| `row-height`   | `number`                    | parent `rowHeight`, otherwise `150`   | Row height in pixels.              |
| `margin`       | `readonly [number, number]` | parent `margin`, otherwise `[10, 10]` | Horizontal and vertical gaps.      |
| `width`        | `number`                    | parent width, otherwise `0`           | Drawing width in pixels.           |
| `rows`         | `number`                    | fills the available height            | Optional number of rows to draw.   |
| `color`        | `string`                    | `rgba(0,0,0,0.1)`                     | Grid-line color.                   |
| `stroke-width` | `number`                    | `1`                                   | Non-negative line width in pixels. |

See the [Grid Background example](../example/grid-background) for usage.

## Slots

The default slot accepts manually rendered `GridItem` components. The `item` slot lets `GridLayout` create them and exposes this scope:

```ts
interface GridLayoutSlotScope {
  item: ReadonlyLayoutItem
  index: number
  style: Readonly<Record<string, string>>
  isDragging: boolean
  isResizing: boolean
}
```

See [Render items](./usage#render-items) for both patterns.
