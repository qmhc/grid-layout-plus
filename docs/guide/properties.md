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

### Breakpoint

```ts
type Breakpoint = 'xxs' | 'xs' | 'sm' | 'md' | 'lg'
```

### Breakpoints

```ts
type Breakpoints = Record<Breakpoint, number>
```

### ResponsiveLayout

```ts
type ResponsiveLayout = Record<Breakpoint, Layout>
```

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
interface GridConfig {
  colNum?: number
  rowHeight?: number
  maxRows?: number
  margin?: number[]
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

- type: `Layout`
- required

The grid layout. Each array item must include `i`, `x`, `y`, `w`, and `h`. See [GridItem](#griditem) for the item-level properties.

With the default `collision-mode="push"`, Grid Layout Plus validates and compacts the layout before the first render. It does not mutate the input array or its items. Use `v-model:layout` to receive the normalized layout.

### responsive-layouts

- type: `Partial<ResponsiveLayout>`
- default: `{}`

The initial layout for each breakpoint when `responsive` is `true`. Each key is a breakpoint name and each value follows the `layout` format, for example `{ lg: [layout items], md: [layout items] }`.

Changing this prop after `GridLayout` is created has no effect.

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

- type: `number[]`
- default: `[10, 10]`

The horizontal and vertical gaps between items, in pixels. Pass exactly two numbers: `[horizontal, vertical]`.

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

- type: `Breakpoints`
- default: `{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }`

The width thresholds used by responsive mode.

See also [responsiveLayouts](#responsive-layouts) and [cols](#cols)

### cols

- type: `Breakpoints`
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
interface GridConfig {
  colNum?: number
  rowHeight?: number
  maxRows?: number
  margin?: number[]
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

### Layer methods

`GridLayout` exposes `bringToFront(id)` and `sendToBack(id)`. Both methods update and normalize `LayoutItem.zIndex`. If the order changes, they emit `layout-updated` and return `true`.

## GridItem

### i

- type: `number | string`
- required

The item's unique identifier.

### x

- type: `number`
- required

The item's initial column. It must be a non-negative integer.

### y

- type: `number`
- required

The item's initial row. It must be a non-negative integer.

### w

- type: `number`
- required

The initial item width in columns. It must be a positive integer.

### h

- type: `number`
- required

The initial item height in rows. It must be a positive integer.

### min-w

- type: `number`
- default: `1`

The minimum width in columns. If `w` is smaller, it is clamped to `min-w`.

### min-h

- type: `number`
- default: `1`

The minimum height in rows. If `h` is smaller, it is clamped to `min-h`.

### max-w

- type: `number`
- default: `Infinity`

The maximum width in columns. If `w` is larger, it is clamped to `max-w`.

### max-h

- type: `number`
- default: `Infinity`

The maximum height in rows. If `h` is larger, it is clamped to `max-h`.

### is-draggable

- type: `boolean`
- default: `null`

Whether the item can be dragged. `null` inherits the value from `GridLayout`.

### is-resizable

- type: `boolean`
- default: `null`

Whether the item can be resized. `null` inherits the value from `GridLayout`.

### is-bounded

- type: `boolean`
- default: `null`

During a pointer drag, keeps the item's pixel rectangle inside the `GridLayout` root. `null` inherits the value from `GridLayout`. This prop does not constrain resizing.

### static

- type: `boolean`
- default: `false`

Whether the item is static. A static item cannot be dragged, resized, or pushed by other items.

### z-index

- type: `number`
- default: `undefined`

Sets the item layer order as an integer. Higher values render in front. Layer methods may normalize these values while preserving their relative order.

### drag-ignore-from

- type: `string`
- default: `'a, button'`

Selectors for descendants that must not start dragging.

See `ignoreFrom` in the [interact.js documentation](http://interactjs.io/docs/#ignorable-selectors).

### drag-allow-from

- type: `string`
- default: `null`

Selectors for descendants that may start dragging.

If `null`, any descendant can start dragging unless it matches `drag-ignore-from`.

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

- type: `Record<string, any>`
- default: `{}`

Pass-through options for the grid item's [interact.js draggable configuration](https://interactjs.io/docs/draggable/).

### resize-option

- type: `Record<string, any>`
- default: `{}`

Pass-through options for the grid item's [interact.js resizable configuration](https://interactjs.io/docs/resizable/).

### drag-threshold

- type: `number`
- default: `null`

The minimum drag distance for this item, in pixels. `null` inherits [`drag-threshold`](#drag-threshold) from `GridLayout`.
