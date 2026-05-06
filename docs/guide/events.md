# Events

Many events can be listened to each GridItem, so that you can be notified when a item changed.

Working example [here](../example/events).

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
      :x="item.x"
      :y="item.y"
      :w="item.w"
      :h="item.h"
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

### layout-before-mount

Layout beforeMount event.

Emited on the component beforeMount lifecycle hook.

```ts
function layoutBeforeMount(newLayout: Layout): void
```

### layout-mounted

Layout mounted event.

Emited on the component mounted lifecycle hook.

```ts
function layoutMounted(newLayout: Layout): void
```

### layout-ready

Layout ready event.

Emited when finish all the operations on the mount lifecycle hook.

```ts
function layoutReady(newLayout: Layout): void
```

### layout-updated

Layout updated event.

Emitted every time the layout has finished updating and positions of all items are recalculated.

```ts
function layoutUpdated(newLayout: Layout): void
```

### breakpoint-changed

Breakpoint Changed event.

Emitted every time the breakpoint value changes due to window resize.

```ts
function breakpointChanged(newBreakpoint: Breakpoint, newLayout: Layout): void
```

### drop-drag-over

Drop drag over event.

Emitted continuously while an external draggable element is being dragged over the grid. Only fires when [`is-droppable`](./properties#is-droppable) is `true`.

The `position` object contains the grid coordinates where the item would be placed.

```ts
function dropDragOver(position: { x: number; y: number }, event: DragEvent): void
```

### drop

Drop event.

Emitted when an external draggable element is dropped onto the grid. Only fires when [`is-droppable`](./properties#is-droppable) is `true`.

The `item` object contains the grid position and size (from [`drop-item`](./properties#drop-item)) of the dropped element.

```ts
function drop(item: { x: number; y: number; w: number; h: number }, event: DragEvent): void
```

### drop-drag-leave

Drop drag leave event.

Emitted when an external draggable element leaves the grid area. Only fires when [`is-droppable`](./properties#is-droppable) is `true`.

```ts
function dropDragLeave(event: DragEvent): void
```

## GridItem

### move

Move event.

Emitted every time an item is being moved and changes position.

```ts
function move(i: number | string, newX: number, newY: number): void
```

### resize

Resize event.

Emitted every time an item is being resized and changes size.

```ts
function resize(i: number | string, newH: number, newW: number, newHPx: number, newWPx: number): void
```

### moved

Moved event.

Emitted every time an item is finished moving and changes position.

```ts
function moved(i: number | string, newX: number, newY: number): void
```

### resized

Resized event.

Emitted every time an item is finished resizing and changes size.

```ts
function resized(i: number | string, newH: number, newW: number, newHPx: number, newWPx: number): void
```

### container-resized

Container Resized event.

Emitted every time the item or layout container resized.

```ts
function containerResized(i: number | string, newH: number, newW: number, newHPx: number, newWPx: number): void
```
