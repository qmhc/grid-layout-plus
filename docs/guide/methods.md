---
title: Methods
description: Call GridLayout methods and handle controlled transaction receipts for programmatic layout updates.
---

# Methods

`GridLayout` exposes methods for one-off layout changes. Because the component is controlled, an accepted command emits a proposal and waits for the parent to write it back before committing it.

## Get the component ref

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { GridLayout } from 'grid-layout-plus'

import type { GridLayoutExpose, Layout } from 'grid-layout-plus'

const grid = ref<GridLayoutExpose | null>(null)
const layout = ref<Layout>([{ i: 'summary', x: 0, y: 0, w: 2, h: 2 }])
</script>

<template>
  <GridLayout ref="grid" v-model:layout="layout" />
</template>
```

The exposed `root` field is a readonly ref to the component's root element.

## Method reference

```ts
interface GridLayoutExpose {
  root: Readonly<Ref<HTMLElement | null>>
  setLayout(layout: ReadonlyLayout): LayoutTransactionReceipt
  moveItem(id: LayoutItem['i'], x: number, y: number): LayoutTransactionReceipt
  resizeItem(id: LayoutItem['i'], w: number, h: number): LayoutTransactionReceipt
  addItem(item: ReadonlyLayoutItem): LayoutTransactionReceipt
  removeItem(id: LayoutItem['i']): LayoutTransactionReceipt
  bringToFront(id: LayoutItem['i']): LayoutTransactionReceipt
  sendToBack(id: LayoutItem['i']): LayoutTransactionReceipt
}
```

| Method                 | Effect                                                          |
| ---------------------- | --------------------------------------------------------------- |
| `setLayout(layout)`    | Validates and proposes a replacement Layout.                    |
| `moveItem(id, x, y)`   | Proposes new grid coordinates for one item.                     |
| `resizeItem(id, w, h)` | Proposes a new grid size for one item.                          |
| `addItem(item)`        | Validates and proposes inserting an item with a unique id.      |
| `removeItem(id)`       | Proposes removing the matching item.                            |
| `bringToFront(id)`     | In overlap mode, proposes moving the item to the highest layer. |
| `sendToBack(id)`       | In overlap mode, proposes moving the item to the lowest layer.  |

Layer methods normalize `LayoutItem.zIndex` values while preserving relative order. Outside `collision-mode="overlap"`, they return a rejected receipt with `reason: 'disabled'`.

## Handle the receipt

```ts
function moveSummary() {
  const receipt = grid.value?.moveItem('summary', 2, 0)
  if (!receipt) return

  if (receipt.status === 'pending') {
    console.log('Proposed revision', receipt.revision)
  } else if (receipt.status === 'rejected') {
    console.warn('Move rejected:', receipt.reason)
  }
}
```

A receipt has one of three statuses:

| Status      | Meaning                                                                                |
| ----------- | -------------------------------------------------------------------------------------- |
| `pending`   | The proposal was emitted through `update:layout` and is waiting for prop confirmation. |
| `unchanged` | The command is valid, but its result is semantically equal to the committed Layout.    |
| `rejected`  | Validation or layout rules rejected the command; the committed Layout did not change.  |

With `v-model:layout`, Vue normally writes a pending proposal back automatically. If the parent does not confirm it, `GridLayout` rolls it back and emits `operation-rejected` with `reason: 'external-not-committed'`. A newer command can also supersede an unconfirmed proposal.

Use `layout-updated` when you need notification after the proposal has actually committed. See [Operation contracts](./contracts) for receipt fields and rejection reasons.

## Responsive mode

Bind both controlled models before calling methods on a responsive grid:

```vue
<GridLayout
  ref="grid"
  v-model:layout="layout"
  v-model:responsive-layouts="responsiveLayouts"
  responsive
/>
```

The component emits the current Layout and the complete breakpoint map with the same revision. Both values must be written back in the same Vue update cycle.

## Component methods or composables?

Use these methods when `GridLayout` renders the UI. Use [`useGridLayout`](./composables#usegridlayout) for headless state: its one-off methods commit synchronously and return `LayoutOperationResult`, so they use `accepted` instead of `pending`.
