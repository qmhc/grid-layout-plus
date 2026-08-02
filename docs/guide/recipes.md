---
title: Common Tasks
description: Copy complete Grid Layout Plus v2 patterns for controlled, responsive, programmatic, headless, and Core API workflows.
---

# Common Tasks

These recipes show the ownership and success conditions that matter in v2. Start with the shortest path that matches your renderer.

## Render a controlled grid

Keep the Layout in a writable ref and bind it with `v-model:layout`. Each item gets its coordinates and constraints from that array.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { GridLayout } from 'grid-layout-plus'

import type { Layout } from 'grid-layout-plus'

const layout = ref<Layout>([
  { i: 'summary', x: 0, y: 0, w: 4, h: 2, minW: 2 },
  { i: 'activity', x: 4, y: 0, w: 8, h: 3 },
])
</script>

<template>
  <GridLayout v-model:layout="layout" :col-num="12" :row-height="32">
    <template #item="{ item, isDragging, isResizing }">
      <article>
        <strong>{{ item.i }}</strong>
        <span v-if="isDragging || isResizing">Updating…</span>
      </article>
    </template>
  </GridLayout>
</template>
```

Do not pass `x`, `y`, `w`, `h`, or `static` to `GridItem`. Those deprecated compatibility props are not the source of truth inside `GridLayout`.

## Keep responsive Layouts synchronized

Responsive mode controls two values: the current Layout and the map of breakpoint Layouts. Bind both models so Grid Layout Plus can propose them in the same Vue update cycle.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { GridLayout } from 'grid-layout-plus'

import type { Breakpoints, Layout, ResponsiveLayoutsInput } from 'grid-layout-plus'

type AppBreakpoint = 'mobile' | 'desktop'

const breakpoints = { mobile: 0, desktop: 1024 } satisfies Breakpoints<AppBreakpoint>
const cols = { mobile: 4, desktop: 12 } as const
const responsiveLayouts = ref<ResponsiveLayoutsInput<AppBreakpoint>>({
  mobile: [{ i: 'summary', x: 0, y: 0, w: 4, h: 2 }],
  desktop: [{ i: 'summary', x: 0, y: 0, w: 4, h: 2 }],
})
const layout = ref<Layout>(responsiveLayouts.value.desktop?.map(item => ({ ...item })) ?? [])
</script>

<template>
  <GridLayout
    v-model:layout="layout"
    v-model:responsive-layouts="responsiveLayouts"
    responsive
    :breakpoints="breakpoints"
    :cols="cols"
  >
    <template #item="{ item }">{{ item.i }}</template>
  </GridLayout>
</template>
```

Do not update only one model after width resolution. A partial update is rejected with `GridLayoutRuntimeError.code === 'partial-responsive-update'`, and the last valid pair is restored.

## Run a programmatic component command

An accepted component method returns `pending`, emits a controlled proposal, and waits for the parent to write it back. Use `layout-updated` to observe the commit.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { GridLayout } from 'grid-layout-plus'

import type {
  GridLayoutExpose,
  Layout,
  LayoutUpdateMeta,
  OperationRejectedPayload,
  ReadonlyLayout,
} from 'grid-layout-plus'

const grid = ref<GridLayoutExpose | null>(null)
const layout = ref<Layout>([{ i: 'summary', x: 0, y: 0, w: 4, h: 2 }])
const pendingRevision = ref<number | null>(null)

function moveSummary() {
  const receipt = grid.value?.moveItem('summary', 4, 0)
  pendingRevision.value = receipt?.status === 'pending' ? receipt.revision : null
}

function handleLayoutUpdated(_layout: ReadonlyLayout, meta: LayoutUpdateMeta) {
  if (meta.revision === pendingRevision.value) pendingRevision.value = null
}

function handleRejected(payload: OperationRejectedPayload) {
  if (payload.revision === pendingRevision.value) pendingRevision.value = null
  console.warn(payload.reason)
}
</script>

<template>
  <button type="button" @click="moveSummary">Move summary</button>
  <GridLayout
    ref="grid"
    v-model:layout="layout"
    @layout-updated="handleLayoutUpdated"
    @operation-rejected="handleRejected"
  />
</template>
```

`pending` does not mean committed. The proposal can still be rejected as `external-not-committed` or superseded by a newer command.

## Manage Layout state without rendering components

Pass a writable `Ref<Layout>` to `useGridLayout` when a custom renderer owns the DOM. One-off operations commit synchronously, so `accepted` means the ref already contains the new Layout.

```ts
import { ref } from 'vue'
import { useGridLayout } from 'grid-layout-plus'

import type { Layout } from 'grid-layout-plus'

const sourceLayout = ref<Layout>([{ i: 'summary', x: 0, y: 0, w: 4, h: 2 }])

const grid = useGridLayout({
  layout: sourceLayout,
  cols: 12,
  rowHeight: 32,
  gap: [8, 8],
  onOperationRejected(payload) {
    console.warn(payload.reason)
  },
})

const result = grid.moveItem('summary', 4, 0)
if (result.status === 'accepted') {
  console.log('Committed Layout:', grid.layout.value)
}
```

If you pass a plain `ReadonlyLayout` instead of a ref, the composable owns an internal writable copy. The ownership mode is fixed when the composable is created.

## Validate and normalize Layout data without Vue

Use the `/core` entry for server-side validation, persistence boundaries, workers, or algorithm-only code. It does not inject component CSS.

```ts
import {
  GridLayoutValidationError,
  normalizeLayout,
  validateLayout,
} from 'grid-layout-plus/core'

import type { Layout, ReadonlyLayout } from 'grid-layout-plus/core'

function prepareSavedLayout(layout: ReadonlyLayout): Layout {
  try {
    validateLayout(layout, 'savedLayout')

    return normalizeLayout(layout, {
      cols: 12,
      maxRows: 40,
      collisionMode: 'push',
    })
  } catch (error) {
    if (error instanceof GridLayoutValidationError) {
      console.error(error.code, error.path, error.cause)
    }
    throw error
  }
}
```

Validation checks the public data contract. Normalization then applies columns, maximum rows, collision handling, placement, and compaction, returning an independent mutable Layout.

## Where to go next

- Use the [API Index](./api-index) to locate a symbol.
- Read [Operation Contracts](./contracts) before branching on statuses or errors.
- Open the [Examples](../example/) for runnable interaction and styling demos.
