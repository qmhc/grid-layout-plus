---
title: Composables
description: Use Grid Layout Plus layout management, responsive layout state, and container-width observation without rendering its components.
---

# Composables

The composables let custom renderers use the same validated layout and responsive behavior. Import them from `grid-layout-plus`.

## useGridLayout

Use `useGridLayout` when your application renders its own DOM but still needs Grid Layout Plus placement, collision, compaction, and interaction rules.

```ts
interface UseGridLayoutOptions {
  layout: Ref<Layout> | ReadonlyLayout
  cols: MaybeRefOrGetter<number>
  rowHeight?: MaybeRefOrGetter<number>
  margin?: MaybeRefOrGetter<readonly [number, number]>
  containerPadding?: MaybeRefOrGetter<readonly [number, number]>
  maxRows?: MaybeRefOrGetter<number>
  compactor?: MaybeRefOrGetter<Compactor>
  collisionMode?: MaybeRefOrGetter<CollisionMode>
  isDraggable?: MaybeRefOrGetter<boolean>
  isResizable?: MaybeRefOrGetter<boolean>
  restoreOnDrag?: MaybeRefOrGetter<boolean>
  bringToFrontOnInteract?: MaybeRefOrGetter<boolean>
  onLayoutChange?: (layout: ReadonlyLayout, reason: LayoutChangeReason) => void
  onOperationRejected?: (payload: OperationRejectedPayload) => void
  onInteractionEnd?: (payload: InteractionTerminalPayload) => void
  onError?: (error: GridLayoutRuntimeError) => void
}
```

### Layout ownership

- Pass a writable `Ref<Layout>` to have accepted operations replace its value.
- Pass a plain `ReadonlyLayout` to let the composable keep internal state.
- This ownership mode is fixed when the composable is created.
- Config values wrapped in refs or getters remain reactive.

```ts
import { computed, ref } from 'vue'
import { useGridLayout } from 'grid-layout-plus'

import type { Layout } from 'grid-layout-plus'

const layout = ref<Layout>([{ i: 'summary', x: 0, y: 0, w: 2, h: 2 }])
const cols = ref(12)

const grid = useGridLayout({
  layout,
  cols,
  rowHeight: 30,
  containerPadding: [10, 10]
})

const items = computed(() => grid.layout.value)
const result = grid.moveItem('summary', 2, 0)
if (result.status === 'rejected') {
  console.warn(result.reason)
}
```

### Returned state and operations

| Member              | Type or purpose                                                                 |
| ------------------- | ------------------------------------------------------------------------------- |
| `layout`            | Readonly ref containing the committed Layout.                                   |
| `placeholder`       | Latest accepted interaction candidate, or `null`.                               |
| `dragState`         | Typed drag state and token.                                                     |
| `resizeState`       | Typed resize state and token.                                                   |
| `isInteracting`     | Whether a drag or resize interaction is active.                                 |
| `containerRows`     | Current number of occupied rows.                                                |
| `containerHeight`   | Calculated content height in pixels.                                            |
| one-off operations  | `setLayout`, `moveItem`, `resizeItem`, `addItem`, `removeItem`, layer APIs.     |
| interaction methods | `beginInteraction`, `updateInteraction`, `endInteraction`, `cancelInteraction`. |

One-off operations return `LayoutOperationResult` and commit accepted changes synchronously. Continuous interactions use the opaque token returned by `beginInteraction`; do not create or reuse tokens yourself.

See [Operation contracts](./contracts) for results and terminal states, and the [Composable API example](../example/composable-api) for custom rendering.

## useResponsiveLayout

`useResponsiveLayout` keeps a writable current Layout and a writable breakpoint map synchronized with width and responsive configuration.

```ts
interface UseResponsiveLayoutOptions<B extends string = DefaultBreakpoint> {
  breakpoints: MaybeRefOrGetter<Breakpoints<B>>
  cols: MaybeRefOrGetter<Readonly<Record<B, number>>>
  width: MaybeRefOrGetter<number | null>
  layout: Ref<Layout>
  layouts: Ref<ResponsiveLayoutsInput<B>>
  initialFallback: ReadonlyLayout
  compactor?: MaybeRefOrGetter<Compactor>
  collisionMode?: MaybeRefOrGetter<CollisionMode>
  maxRows?: MaybeRefOrGetter<number>
  onError?: (error: GridLayoutRuntimeError) => void
}
```

```ts
import { ref } from 'vue'
import { useResponsiveLayout } from 'grid-layout-plus'

import type { Layout, ResponsiveLayoutsInput } from 'grid-layout-plus'

type AppBreakpoint = 'mobile' | 'desktop'

const width = ref<number | null>(null)
const layout = ref<Layout>([])
const layouts = ref<ResponsiveLayoutsInput<AppBreakpoint>>({})

const responsive = useResponsiveLayout({
  breakpoints: { mobile: 0, desktop: 1024 },
  cols: { mobile: 2, desktop: 12 },
  width,
  layout,
  layouts,
  initialFallback: [{ i: 'summary', x: 0, y: 0, w: 2, h: 2 }]
})
```

The composable writes `layout` and `layouts` together. Updating only one while a width is resolved reports `code: 'partial-responsive-update'` through `onError`, and the last valid pair is restored. `initialFallback` is sampled when the composable is created and is used to fill missing breakpoint layouts.

Returned refs:

| Ref                 | Meaning                                                           |
| ------------------- | ----------------------------------------------------------------- |
| `state`             | `unresolved`, `resolved-zero`, or `resolved`.                     |
| `currentBreakpoint` | Active breakpoint, or `null` before width resolution.             |
| `currentCols`       | Columns for the active breakpoint, or `null`.                     |
| `currentLayout`     | Readonly snapshot of the current Layout.                          |
| `completeLayouts`   | Complete breakpoint map after width resolution, otherwise `null`. |

## useContainerWidth

`useContainerWidth` resolves either an explicit width or the content-box width reported by `ResizeObserver`.

```ts
interface UseContainerWidthOptions {
  explicitWidth?: MaybeRefOrGetter<number | undefined>
  onError?: (error: GridLayoutRuntimeError) => void
}

function useContainerWidth(
  el: Readonly<Ref<HTMLElement | null>>,
  options?: Readonly<UseContainerWidthOptions>
): {
  width: Readonly<Ref<number | null>>
  state: Readonly<Ref<'unresolved' | 'resolved-zero' | 'resolved'>>
}
```

```ts
import { ref } from 'vue'
import { useContainerWidth } from 'grid-layout-plus'

const container = ref<HTMLElement | null>(null)
const { width, state } = useContainerWidth(container)
```

When `explicitWidth` is defined, observation stops and that non-negative value is used. When it becomes `undefined`, the composable returns to observation. It disconnects the observer when its Vue effect scope is disposed. Observer and validation failures are sent to `onError`; when no measurement is available, the state remains `unresolved`.
