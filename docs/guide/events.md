---
title: Events
description: Find details about GridLayout updates, interaction lifecycle events, drop events, and GridItem events.
---

# Events

`GridLayout` emits layout and interaction lifecycle events. Each `GridItem` also reports its own move, resize, and container-size changes. See [Move and Resize Events](../example/events) for a working example.

```vue
<template>
  <GridLayout
    v-model:layout="layout"
    :row-height="30"
    @layout-before-mount="layoutBeforeMount"
    @layout-mounted="layoutMounted"
    @layout-ready="layoutReady"
    @layout-updated="layoutUpdated"
    @breakpoint-changed="breakpointChanged"
    @drop-drag-over="dropDragOver"
    @drop="handleDrop"
    @drop-drag-leave="dropDragLeave"
  >
    <GridItem
      v-for="item in layout"
      :key="item.i"
      :i="item.i"
      @resize="resize"
      @move="move"
      @resized="resized"
      @container-resized="containerResized"
      @moved="moved"
    >
      {{ item.i }}
    </GridItem>
  </GridLayout>
</template>
```

## GridLayout

### update:layout

Emitted whenever `GridLayout` accepts a layout update. The event carries an independent Layout snapshot, which `v-model:layout` writes to the parent. The update is committed after the component receives that value through its props.

```ts
function updateLayout(layout: ReadonlyLayout, meta: LayoutUpdateMeta): void
```

### update:responsive-layouts

In responsive mode, this event and `update:layout` share the same `meta.revision`. Bind both models so the current Layout and the complete breakpoint map update in one transaction.

```ts
function updateResponsiveLayouts<B extends string>(
  layouts: CompleteResponsiveLayouts<B>,
  meta: LayoutUpdateMeta,
): void
```

### layout-before-mount

Emitted from the component's `beforeMount` hook.

```ts
function layoutBeforeMount(newLayout: ReadonlyLayout): void
```

### layout-mounted

Emitted from the component's `mounted` hook.

```ts
function layoutMounted(newLayout: ReadonlyLayout): void
```

### layout-ready

Emitted after the component finishes its initial layout work.

```ts
function layoutReady(newLayout: ReadonlyLayout): void
```

### layout-updated

Emitted after a transaction is committed and item positions are recalculated. Rejected, cancelled, and unconfirmed updates do not emit this event.

```ts
function layoutUpdated(newLayout: ReadonlyLayout, meta: LayoutUpdateMeta): void
```

### breakpoint-changed

Emitted when a resize changes the active breakpoint.

```ts
function breakpointChanged<B extends string>(
  newBreakpoint: B | null,
  newLayout: ReadonlyLayout,
  meta: LayoutUpdateMeta,
): void
```

### width-changed

Emitted after the component processes a valid explicit or observed width. The payload distinguishes resolved zero geometry from a positive width and includes both the candidate and committed responsive state.

```ts
function widthChanged<B extends string>(
  payload: WidthChangedPayload<B>,
  meta: LayoutUpdateMeta,
): void
```

### interaction-start / interaction-change / interaction-end

These three events describe one typed interaction lifecycle. `interaction-change` is coalesced by animation frame and carries the latest accepted Layout and placeholder. `interaction-end` fires once with a status of `committed`, `unchanged`, or `cancelled`.

```ts
function interactionStart(payload: InteractionStartPayload): void
function interactionChange(payload: InteractionChangePayload): void
function interactionEnd(payload: InteractionTerminalPayload): void
```

### operation-rejected

Emitted when the component rejects a public command, interaction candidate, controlled update, or drop candidate. Check the discriminated `reason` field for the cause. The committed Layout is not changed.

```ts
function operationRejected(payload: OperationRejectedPayload): void
```

See [Operation contracts](./contracts#operationrejectedpayload) for the complete payload and rejection reasons.

### error

Reports invalid prop updates, extension failures, and derived geometry errors while keeping the last valid committed state. An invalid initial Layout or configuration still throws synchronously.

```ts
function error(payload: GridLayoutRuntimeError): void
```

See [Errors](./contracts#errors) for the error fields and handling rules.

### drop-drag-over

Emitted continuously while an external draggable element is over the grid. This event requires [`is-droppable`](./properties#is-droppable) to be `true`.

```ts
function dropDragOver<B extends string>(
  context: DropDragOverContext<B>,
  event: DragEvent,
): void
```

`context.candidate` is the final candidate without an id, including any size change made by `DropConfig.onDragOver`. `context.previewLayout` contains the normalized existing items. `insertionIndex` is where the caller must insert the candidate, and `proposalId` identifies this accepted evaluation. In responsive mode, `breakpoint` is fixed for the lifetime of this evaluation.

### drop

Emitted when an external draggable element is dropped on the grid. This event requires [`is-droppable`](./properties#is-droppable) to be `true`.

The result contains the last valid drop evaluation. `GridLayout` does not create an id or update the Layout automatically.

```ts
function drop<B extends string>(
  result: Extract<DropEvaluationResult<B>, { status: 'accepted' }>,
  event: DragEvent,
): void
```

Create a unique business id, insert the candidate into a copy of `previewLayout` at `insertionIndex`, and write back the new Layout:

```ts
function handleDrop(
  result: Extract<DropEvaluationResult, { status: 'accepted' }>,
) {
  const nextLayout = result.previewLayout.map(item => ({ ...item }))
  nextLayout.splice(result.insertionIndex, 0, {
    ...result.candidate,
    i: createUniqueId(),
  })
  layout.value = nextLayout
}
```

For a responsive grid, use `result.breakpoint` to update the matching responsive Layout and the current Layout in the same Vue update cycle. If a breakpoint, configuration, or Layout change invalidates an evaluation, `drop` does not emit the stale result.

### drop-drag-leave

Emitted when an external draggable element leaves the grid. This event requires [`is-droppable`](./properties#is-droppable) to be `true`.

```ts
function dropDragLeave(event: DragEvent): void
```

## GridItem

### move

Emitted while the item is moving, each time its grid position changes.

```ts
function move(i: number | string, newX: number, newY: number): void
```

### resize

Emitted while the item is resizing, each time its grid or pixel size changes.

```ts
function resize(i: number | string, newH: number, newW: number, newHPx: number, newWPx: number): void
```

### moved

Emitted after the item finishes moving to a new grid position.

```ts
function moved(i: number | string, newX: number, newY: number): void
```

### resized

Emitted after the item finishes resizing to a new grid or pixel size.

```ts
function resized(i: number | string, newH: number, newW: number, newHPx: number, newWPx: number): void
```

### container-resized

Emitted when a change to the item or layout container updates the item's grid or pixel size.

```ts
function containerResized(i: number | string, newH: number, newW: number, newHPx: number, newWPx: number): void
```
