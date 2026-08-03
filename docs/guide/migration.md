---
title: Migration from v1
description: Migrate Grid Layout Plus v1 projects to the controlled v2 API and update code that relies on removed or deprecated behavior.
---

# Migration from v1

This page covers the incompatible changes when upgrading Grid Layout Plus from v1 to v2.
It uses the latest v1 release, `v1.1.1`, as its baseline. Read only the sections relevant
to your project.

## `Layout` is now controlled

This change affects projects that rely on `GridLayout` mutating the `Layout` array in
place.

v1 mutated the provided `Layout` array and its items directly. v2 treats it as readonly
input: `GridLayout` emits a new `Layout`, and the update is committed only after the parent
writes it back.

Store the layout in a writable ref and bind `v-model:layout`:

```vue
<script setup lang="ts">
import { ref } from 'vue'

import type { Layout } from 'grid-layout-plus'

const layout = ref<Layout>([
  { i: 'summary', x: 0, y: 0, w: 2, h: 2 }
])
</script>

<template>
  <GridLayout v-model:layout="layout" />
</template>
```

Projects that already use this pattern do not need changes. Passing `:layout` without
handling `update:layout` remains valid for readonly rendering, but it cannot persist
changes from drag, resize, or public methods.

When array identity must be preserved, replace the array contents in place in an
`update:layout` listener. See [Layout data](./usage#layout-data).

## General changes

### Grid spacing and container padding

The `margin` prop and configuration field have been removed. Rename them to `gap`:

```vue
<!-- v1 -->
<GridLayout :margin="[10, 10]" />

<!-- v2 -->
<GridLayout :gap="[10, 10]" />
```

`gap` controls only the space between rows and columns. When `containerPadding` is
omitted, its v2 default is `[0, 0]`; it no longer inherits the spacing value. To retain
v1's default outer inset, set both values explicitly:

```vue
<GridLayout :gap="[10, 10]" :container-padding="[10, 10]" />
```

### Compaction and positioning props

This change only affects projects that explicitly set `vertical-compact`,
`use-css-transforms`, or `transform-scale`.

v2 replaces these props with compactors and positioning strategies:

| v1 prop                       | v2 replacement                                     |
| ----------------------------- | -------------------------------------------------- |
| `:vertical-compact="true"`    | `:compactor="verticalCompactor"` (default)         |
| `:vertical-compact="false"`   | `:compactor="noCompactor"`                         |
| `:use-css-transforms="true"`  | `:position-strategy="transformStrategy"` (default) |
| `:use-css-transforms="false"` | `:position-strategy="absoluteStrategy"`            |
| `:transform-scale="scale"`    | `:position-strategy="scaledStrategy(scale)"`       |

The defaults remain vertical compaction and CSS transforms. Projects that explicitly
passed `true` can delete the corresponding prop. Projects that disabled compaction,
disabled transforms, or set a scale must use the replacement in the table.

See [`compactor`](./properties#grid-layout-compactor) and
[`position-strategy`](./properties#position-strategy) for the built-in implementations
and imports.

### GridItem data ownership

This change only affects projects that render `GridItem` manually through the default
slot. Projects using the `item` slot do not need changes.

In v1, projects commonly passed coordinates, dimensions, and constraints to `GridItem`.
In v2, `GridItem.i` is only a registration key. Geometry, `static`, min/max constraints,
`isDraggable`, `isResizable`, and `zIndex` are read from the `LayoutItem` with the same `i`
in the parent `Layout`.

```vue
<GridItem
  v-for="item in layout"
  :key="item.i"
  :i="item.i"
>
  {{ item.i }}
</GridItem>
```

These mirror props remain in `GridItemProps` for compatibility but are deprecated. Once
`GridItem` is registered to a valid parent layout, they do not override the matching
`LayoutItem`. `isBounded`, drag and resize selectors, `preserveAspectRatio`, interact
options, and `dragThreshold` remain `GridItem` props.

### `Layout` validation

This change affects layouts containing coordinate, dimension, `i`, or constraint values
that v1 accepted but v2 rejects.

v2 requires coordinates and dimensions to be safe integers. Coordinates cannot be
negative, and dimensions must be positive. Each `i` must be unique and must be either a
non-empty string or a safe integer other than `-0`. Min/max relationships must also be
valid.

An invalid initial `Layout` or configuration throws `GridLayoutValidationError`
synchronously. If an invalid prop is provided later, `GridLayout` emits `error` and keeps
the last valid `Layout`. Invalid arguments passed to public methods return a result with
`status: 'rejected'`. Do not depend on error message text; read the error object's `code`,
`path`, and `cause`.

### `Layout` events

This change only affects handlers that mutate event arguments or depend on when an event
is emitted.

`Layout` event arguments in v2 are independent readonly snapshots. `update:layout`,
`layout-updated`, and `breakpoint-changed` also receive `LayoutUpdateMeta`, which contains
the `revision` and `source`. Handlers that only read the original v1 arguments can remain
unchanged.

`layout-updated` is emitted only after an interaction, public method call, or external
replacement has been committed. It is not emitted for rejected or cancelled updates, or
when the parent does not write the update back. See [Events](./events).

### `restoreOnDrag` behavior

This change only affects projects that explicitly set `restore-on-drag="true"`.

The default remains `false`. With `true`, v2 keeps the active item at the candidate
position under the pointer while dragging, but the final compaction after release may
still move it. Recheck the placeholder and final position after upgrading.

### External and cross-grid drag

The v1 external-drag demo called internal component fields such as `getItem()` and `dragEvent()`. Those fields are not public in v2. Configure native drop with `DropConfig.createItem`; the component creates a controlled insertion proposal and emits `drop` only after confirmation. Remove listeners that splice `result.candidate` into `previewLayout` manually.

```ts
const dropConfig: DropConfig = {
  isDroppable: true,
  createItem: () => ({ i: createUniqueId(), x: 0, y: 0, w: 1, h: 1 }),
}
```

For moves between grids, give both grids the same `transferConfig.group` and bind both Layouts with `v-model:layout`. Cross-grid transfer is move-only in v2 and requires both controlled models to confirm.

## Removed APIs

### Internal fields on the GridLayout component ref

This change only affects projects that access the `GridLayout` component ref directly.

The v1 `state`, `getItem()`, `dragEvent()`, `resizeEvent()`, and `layoutUpdate()` fields
have been removed. The v2 component ref exposes only `root` and the `setLayout()`,
`moveItem()`, `resizeItem()`, `addItem()`, `removeItem()`, `bringToFront()`, and
`sendToBack()` commands.

Read current state from the controlled `Layout` and component events. Call the
corresponding method for a one-off change. For a custom continuous drag or resize flow,
use the interaction API returned by `useGridLayout`.

The `LayoutInstance` type exported from the v1 root was marked `@internal` and is no longer
exported in v2. Use `GridLayoutExpose` for a component ref and `UseGridLayoutReturn` for
headless state.

## Deprecated APIs

These APIs still work in v2 but will be removed in a future release:

- `prevent-collision`: use
  [`collision-mode="prevent"`](./properties#collision-mode).
- `Breakpoint`: use `DefaultBreakpoint` or provide a custom breakpoint generic to the
  responsive APIs.
- `ResponsiveLayout`: use `ResponsiveLayoutsInput` or `CompleteResponsiveLayouts`,
  depending on whether the value is input or complete state.
- `moveElement`: calls that depend only on its legacy behavior can remain. Use
  `normalizeLayout` or `useGridLayout` when the operation must also handle bounds,
  collision mode, and compaction.

## Advanced

The following changes apply only to less common integrations.

### Responsive `Layout`

In responsive mode, v2 emits the current `Layout` and the complete set of breakpoint
layouts with the same `revision`. To persist responsive layouts, bind both models and
write them back in the same Vue update cycle:

```vue
<GridLayout
  v-model:layout="layout"
  v-model:responsive-layouts="responsiveLayouts"
  responsive
/>
```

### DOM boundary for manual GridItem rendering

A manually rendered `GridItem` must stay inside its owning `GridLayout` root and use that
root directly as its CSS containing block (`offsetParent`).

If a v1 project uses `Teleport` to move an item outside the root or inserts a positioned
wrapper between them, change the DOM structure. v2 rejects these registrations instead of
calculating geometry and handling pointer interactions against the wrong containing block.

### Direct layout helper imports

v1 did not expose its layout algorithms from the package root, and `es/helpers/*` and
`lib/helpers/*` were not stable API entry points. If a project imported one of the layout
helpers that remains supported in v2 through these paths, switch to the package root or
`grid-layout-plus/core`:

```ts
import { compact, normalizeLayout } from 'grid-layout-plus/core'
```

Stable v2 core functions do not mutate the input `Layout`. Always use the returned
`Layout`:

```ts
layout.value = normalizeLayout(layout.value, {
  cols: 12,
  maxRows: 40,
  collisionMode: 'push',
})
```

The third argument of `compact` is now a `ReadonlyMap`; the plain object accepted by v1 is
no longer supported. Numeric and string `i` values remain distinct:

```ts
const minPositions = new Map([
  [1, { y: 0 }],
  ['1', { y: 2 }],
])

layout.value = compact(layout.value, false, minPositions)
```

### Additional `LayoutItem` data

This change affects projects that store custom data on `LayoutItem`. Additional values
must be cloneable plain data. v2 rejects functions, class instances, `Symbol` values,
cycles, accessor properties, and non-finite numbers.

Move non-cloneable values to an external map keyed by `i`, and keep only plain data on
`LayoutItem`.

## Migrating from an earlier v1 release

Review the changes from your current version through `v1.1.1` in the
[CHANGELOG](https://github.com/qmhc/grid-layout-plus/blob/main/CHANGELOG.md), then proceed
with the changes on this page.
