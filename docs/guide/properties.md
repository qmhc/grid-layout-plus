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
  isResizable?: boolean
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

### Compactor

The pluggable compaction algorithm interface. A compactor receives a layout and column count, and returns a new compacted layout.

```ts
interface Compactor {
  compact(layout: Layout, cols: number): Layout
  allowOverlap?: boolean
}
```

Built-in compactors:

| Compactor | Description |
| --- | --- |
| `verticalCompactor` | Compacts items upward (default, equivalent to v1 `verticalCompact: true`) |
| `horizontalCompactor` | Compacts items to the left |
| `noCompactor` | No compaction, free-form positioning |
| `fastVerticalCompactor` | Interval-tree accelerated vertical compaction, O(n log n) |
| `fastHorizontalCompactor` | Interval-tree accelerated horizontal compaction, O(n log n) |
| `withOverlap(compactor)` | Wraps any compactor to allow items to overlap |

### PositionStrategy

The pluggable positioning strategy interface. Controls how grid items are positioned in the DOM.

```ts
interface PositionStrategy {
  getStyle(top: number, left: number, width: number, height: number): Record<string, string>
  getRtlStyle(top: number, right: number, width: number, height: number): Record<string, string>
}
```

Built-in strategies:

| Strategy | Description |
| --- | --- |
| `transformStrategy` | Uses CSS `translate3d` for positioning (default) |
| `absoluteStrategy` | Uses CSS `top`/`left` for positioning |
| `scaledStrategy(scale)` | Applies a scaling factor to positions and sizes |

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

### DropConfig

```ts
interface DropConfig {
  isDroppable?: boolean
  dropItem?: { w: number; h: number }
}
```

## GridLayout

### layout

- type: `Layout`
- required

This is the initial layout of the grid.

The value must be an array. Each item must have `i`, `x`, `y`, `w` and `h` properties. Please refer to the documentation for `GridItem` below for more information.

### responsive-layouts

- type: `Partial<ResponsiveLayout>`
- default: `{}`

This is the initial layouts of the grid per breakpoint if `responsive` is set to `true`.

The keys of the object are breakpoint names and each value is an array as defined by `layout` prop, e.g. `{ lg: [layout items], md: [layout items] }`.

Setting the prop after the creation of the GridLayout has no effect.

See also [responsive](#responsive), [breakpoints](#breakpoints) and [cols](#cols).

### col-num

- type: `number`
- default: `12`

Says how many columns the grid has. The value should be a *natural number*.

### row-height

- type: `number`
- default: `150`

Says what is a height of a single row in pixels.

### max-rows

- type: `number`
- default: `Infinity`

Says what is a maximal number of rows in the grid.

### margin

- type: `number[]`
- default: `[10, 10]`

Says what are the margins of elements inside the grid.

The value must be a number array with size two. Each value is expressed in pixels. The first value is horizontal margin, the second value is vertical margin.

### is-draggable

- type: `boolean`
- default: `true`

Says if the grids items are draggable.

### is-resizable

- type: `boolean`
- default: `true`

Says if the grids items are resizable.

### is-mirrored

- type: `boolean`
- default: `false`

Says if the RTL/LTR should be reversed.

### is-bounded

- type: `boolean`
- default: `false`

Says if the grid items are bounded to the container when dragging.

### auto-size

- type: `boolean`
- default: `true`

Says if the container height should swells and contracts to fit contents.

### vertical-compact

> ⚠️ **Deprecated** — Use [`compactor`](#compactor) instead. Pass `verticalCompactor` (default) or `noCompactor` to control compaction behavior.

- type: `boolean`
- default: `true`

Says if the layout should be compact vertically.

### restore-on-drag

- type: `boolean`
- default: `false`

Says if the moved grid items should be restored after an item has been dragged over.

### prevent-collision

- type: `boolean`
- default: `false`

Says whether to prevent items collision. When `true`, the items can only be dropped to the blank space.

### use-css-transforms

> ⚠️ **Deprecated** — Use [`positionStrategy`](#position-strategy) instead. Pass `transformStrategy` (default) or `absoluteStrategy`.

- type: `boolean`
- default: `true`

Says if the CSS `transition-property: transform;` should be used.

### responsive

- type: `boolean`
- default: `false`

Says if the layout should be responsive to window width.

See also [responsiveLayouts](#responsive-layouts), [breakpoints](#breakpoints) and [cols](#cols).

### breakpoints

- type: `Breakpoints`
- default: `{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }`

Breakpoints defined for responsive layout.

See also [responsiveLayouts](#responsive-layouts) and [cols](#cols)

### cols

- type: `Breakpoints`
- default: `{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }`

Defines number of columns for each breakpoint.

### use-style-cursor

- type: `boolean`
- default: `true`

Says if set the cursor style dynamically. When dragging freezes, setting this value to `false` may alleviate problems.

**This property is not reactive.**

### transform-scale

> ⚠️ **Deprecated** — Use [`positionStrategy`](#position-strategy) with `scaledStrategy(scale)` instead.

- type: `number`
- default: `1`

Sets a scaling factor to the size of the grid items, `1` means 100%.

### compactor

- type: `Compactor`
- default: `verticalCompactor`

Sets the compaction algorithm for the layout. Import a built-in compactor from `grid-layout-plus`:

```ts
import { horizontalCompactor, noCompactor, verticalCompactor, withOverlap } from 'grid-layout-plus'
```

Use `withOverlap(compactor)` to allow items to overlap while still applying compaction.

### position-strategy

- type: `PositionStrategy`
- default: `transformStrategy`

Sets the positioning strategy for grid items. Import a built-in strategy from `grid-layout-plus`:

```ts
import { absoluteStrategy, scaledStrategy, transformStrategy } from 'grid-layout-plus'
```

Use `scaledStrategy(scale)` when the grid is rendered inside a scaled container.

### is-droppable

- type: `boolean`
- default: `false`

Enables native HTML5 drag-and-drop into the grid from external elements. Use together with [`drop-item`](#drop-item) and the [drop events](./events#drop-drag-over).

### drop-item

- type: `{ w: number, h: number }`
- default: `{ w: 1, h: 1 }`

Sets the default size (in grid units) for items dropped from outside the grid. Only effective when [`is-droppable`](#is-droppable) is `true`.

### drag-threshold

- type: `number`
- default: `0`

Sets the minimum distance in pixels that the pointer must move before a drag operation starts. Useful for preventing accidental drags. Each item can override this via its own `drag-threshold` prop.

### grid-config

- type: `GridConfig`
- default: `undefined`

A grouped configuration object for grid-related props. When provided, its values override the corresponding individual props (`col-num`, `row-height`, `max-rows`, `margin`, `auto-size`).

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

A grouped configuration object for drag-related props. When provided, its values override the corresponding individual props (`is-draggable`, `drag-threshold`, `restore-on-drag`).

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

A grouped configuration object for resize-related props. When provided, its values override the corresponding individual props (`is-resizable`, `resize-handles`).

```ts
interface ResizeConfig {
  isResizable?: boolean
  resizeHandles?: ResizeHandle[]
}
```

### drop-config

- type: `DropConfig`
- default: `undefined`

A grouped configuration object for drop-related props. When provided, its values override the corresponding individual props (`is-droppable`, `drop-item`).

```ts
interface DropConfig {
  isDroppable?: boolean
  dropItem?: { w: number; h: number }
}
```

## GridItem

### i

- type: `number | string`
- required

This is the unique identifier of the item.

### x

- type: `number`
- required

Says what is a initial horizontal position of the item (in which column it should be placed). The value must be a *whole number*.

### y

- type: `number`
- required

Says what is a initial vertical position of the item (in which row it should be placed). The value must be a *whole number*.

### w

- type: `number`
- required

Says what is a initial width of the item (how many columns should span). The value must be a *whole number*.

### h

- type: `number`
- required

Says what is a initial height of the item (how many rows should span). The value must be a *whole number*.

### min-w

- type: `number`
- default: `1`

Says what is a minimal width of the item. If `w` is smaller then `min-w`, then `w` will be set to `min-w`.

### min-h

- type: `number`
- default: `1`

Says what is a minimal hieght of the item. If `h` is smaller then `min-h`, then `h` will be set to `min-h`.

### max-w

- type: `number`
- default: `Infinity`

Says what is a maximal width of the item. If `w` is bigger then `max-w`, then `w` will be set to `max-w`.

### max-h

- type: `number`
- default: `Infinity`

Says what is a maximal height of the item. If `h` is bigger then `max-h`, then `h` will be set to `max-h`.

### is-draggable

- type: `boolean`
- default: `null`

Says if item is draggable. If `null` then it's inherited from parent.

### is-resizable

- type: `boolean`
- default: `null`

Says if item is resizable. If `null` then it's inherited from parent.

### is-bounded

- type: `boolean`
- default: `null`

Says if the item is bounded to the container when dragging. If  `null` then it's inherited from parent.

### static

- type: `boolean`
- default: `false`

Says if item is static (won't be draggable, resizable or moved by other items).

### drag-ignore-from

- type: `string`
- default: `'a, button'`

Says which elements of the item shouldn't trigger drag event of the item. The value is `css-like` selector string.

For more info please refer to `ignoreFrom` in [interact.js docs](http://interactjs.io/docs/#ignorable-selectors).

### drag-allow-from

- type: `string`
- default: `null`

Says which elements of the item should trigger drag event of the item. The value is `css-like` selector string.

If `null`, can trigger drag by any element of the item (excluding `drag-ignore-from`).

For more info please refer to `allowFrom` in [interact.js docs](http://interactjs.io/docs/#ignorable-selectors).

### resize-ignore-from

- type: `string`
- default: `'a, button'`

Says which elements of the item shouldn't trigger resize event of the item. The value is `css-like` selector string.

For more info please refer to `ignoreFrom` in [interact.js docs](http://interactjs.io/docs/#ignorable-selectors).

### preserve-aspect-ratio

- type: `boolean`
- default: `false`

If `true`, forces the GridItem to preserve its aspect ratio when resizing.

### drag-option

- type: `Record<string, any>`
- default: `{}`

Passthrough object for the grid item [interact.js draggable configuration](https://interactjs.io/docs/draggable/).

### resize-option

- type: `Record<string, any>`
- default: `{}`

Passthrough object for the grid item [interact.js resizable configuration](https://interactjs.io/docs/resizable/).



### drag-threshold

- type: `number`
- default: `null`

Sets the minimum drag distance in pixels for this item. If `null`, inherits from the parent GridLayout's [`drag-threshold`](#drag-threshold) prop.
