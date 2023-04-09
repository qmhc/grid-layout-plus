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
