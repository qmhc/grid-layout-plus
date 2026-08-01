---
title: Core API
description: Use Grid Layout Plus validation, normalization, compaction, collision, and geometry functions without Vue or the DOM.
---

# Core API

The stable Core API contains pure layout and geometry functions. It does not depend on Vue, browser DOM APIs, or component CSS.

```ts
import { normalizeLayout, verticalCompactor } from 'grid-layout-plus/core'
```

These exports are also available from `grid-layout-plus`, but the `/core` entry is preferable for algorithm-only, server-side, and non-UI code because it does not inject component CSS.

All stable functions treat Layout arguments as readonly. Functions that produce a Layout return an independent mutable copy; always use the returned value.

## Validate and normalize

### validateLayout

```ts
function validateLayout(layout: ReadonlyLayout, contextName?: string): void
```

Validates Layout structure, ids, coordinates, dimensions, constraints, and additional plain data. It throws `GridLayoutValidationError` and does not apply column, collision, or compaction rules.

### normalizeLayout

```ts
function normalizeLayout(
  layout: ReadonlyLayout,
  options: Readonly<{
    cols: number
    maxRows?: number
    collisionMode?: CollisionMode
    compactor?: Compactor
  }>
): Layout
```

Applies bounds, maximum-row, collision, placement, and compaction rules in one operation.

```ts
const normalized = normalizeLayout(layout, {
  cols: 12,
  maxRows: 40,
  collisionMode: 'push',
  compactor: verticalCompactor
})
```

### cloneLayout

```ts
function cloneLayout(layout: ReadonlyLayout): Layout
```

Returns a mutable deep clone of the Layout. Additional `LayoutItem` data must satisfy the same cloneable plain-data contract as component input.

## Query a Layout

| Function                          | Return                            | Purpose                                       |
| --------------------------------- | --------------------------------- | --------------------------------------------- |
| `bottom(layout)`                  | `number`                          | Maximum bottom grid coordinate.               |
| `collides(first, second)`         | `boolean`                         | Half-open rectangle collision test.           |
| `getFirstCollision(layout, item)` | `ReadonlyLayoutItem \| undefined` | First colliding item in Layout order.         |
| `getAllCollisions(layout, item)`  | `readonly ReadonlyLayoutItem[]`   | All colliding items in Layout order.          |
| `sortLayoutItemsByRowCol(layout)` | `readonly ReadonlyLayoutItem[]`   | Stable top-to-bottom, left-to-right ordering. |

Query functions validate their inputs and do not mutate them.

## Bounds and legacy primitives

```ts
function correctBounds(
  layout: ReadonlyLayout,
  bounds: Readonly<{ cols: number }>,
  allowOverlap?: boolean
): Layout

function compact(
  layout: ReadonlyLayout,
  verticalCompact?: boolean,
  minPositions?: CompactMinPositions
): Layout
```

`correctBounds` fits items into the configured column boundary. `compact` is the low-level deterministic vertical compaction primitive used by the standard compactor. New integrations should normally use `normalizeLayout` or a `Compactor`.

`moveElement` remains exported for compatibility but is deprecated. Use `useGridLayout` when an operation must enforce the complete configuration, or `normalizeLayout` for a pure one-off calculation.

## Compactors

```ts
interface Compactor {
  readonly type?: 'vertical' | 'horizontal'
  compact(layout: ReadonlyLayout, cols: number): Layout
}
```

| Export                    | Behavior                                                               |
| ------------------------- | ---------------------------------------------------------------------- |
| `verticalCompactor`       | Compacts upward; the default.                                          |
| `horizontalCompactor`     | Compacts left and wraps when a row is full.                            |
| `noCompactor`             | Preserves placement after validation.                                  |
| `fastVerticalCompactor`   | Same output as the vertical compactor with indexed candidate lookup.   |
| `fastHorizontalCompactor` | Same output as the horizontal compactor with indexed candidate lookup. |

`withOverlap(compactor)` is deprecated. Use `collisionMode: 'overlap'` instead. See [Properties](./properties#compactor) for the extension contract.

## Position strategies

| Export                  | Behavior                                                 |
| ----------------------- | -------------------------------------------------------- |
| `transformStrategy`     | Generates CSS transform positioning; the default.        |
| `absoluteStrategy`      | Generates absolute `top` and `left`/`right` positioning. |
| `scaledStrategy(scale)` | Uses transform styles and corrects pointer scale.        |

Custom strategies must implement `PositionStrategy`. Invalid styles or thrown errors are reported as extension failures.

## Geometry conversion

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
```

| Function                          | Conversion                                                 |
| --------------------------------- | ---------------------------------------------------------- |
| `calcGridCellDimensions(input)`   | Container width and spacing to cell dimensions.            |
| `gridToPixelRect(item, geometry)` | Grid coordinates to a logical pixel rectangle.             |
| `pointerToGridPosition(input)`    | Viewport pointer and anchor to unclamped grid coordinates. |
| `pixelSizeToGridSize(input)`      | Pixel dimensions to unclamped grid dimensions.             |

The geometry functions use logical inline coordinates, understand RTL and scale, validate that numeric inputs are finite, and return frozen result objects. Apply application-specific bounds after pointer or size conversion.

## Errors

Invalid input throws `GridLayoutValidationError`. A custom compactor or position strategy that throws or returns an invalid value produces `GridLayoutExtensionError`. See [Operation contracts](./contracts#errors) for their fields.
