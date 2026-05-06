# 事件

可以单独监听每个 GridItem 的各种事件，使的你可以第一时间知道栅格元素发生了变化。

[这里](../example/events) 可以查看一个真实的示例。

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

布局即将挂载事件。

在组件的挂载前生命周期派发。

```ts
function layoutBeforeMount(newLayout: Layout): void
```

### layout-mounted

布局挂载事件。

在组件的挂载生命周期派发。

```ts
function layoutMounted(newLayout: Layout): void
```

### layout-ready

布局准备就绪事件。

在挂载生命周期中的所有操作完成后派发。

```ts
function layoutReady(newLayout: Layout): void
```

### layout-updated

布局更新事件。

每次布局更新完成并且所有栅格元素的位置都已计算后派发。

```ts
function layoutUpdated(newLayout: Layout): void
```

### breakpoint-changed

断点变化事件。

每次断点值由于窗口的缩放发生变化时派发。

```ts
function breakpointChanged(newBreakpoint: Breakpoint, newLayout: Layout): void
```

### drop-drag-over

拖放悬停事件。

当外部可拖拽元素在栅格上方拖动时持续派发。仅在 [`is-droppable`](./properties#is-droppable) 为 `true` 时触发。

`position` 对象包含元素将被放置的栅格坐标。

```ts
function dropDragOver(position: { x: number; y: number }, event: DragEvent): void
```

### drop

拖放事件。

当外部可拖拽元素被放置到栅格上时派发。仅在 [`is-droppable`](./properties#is-droppable) 为 `true` 时触发。

`item` 对象包含被放置元素的栅格位置和大小（来自 [`drop-item`](./properties#drop-item)）。

```ts
function drop(item: { x: number; y: number; w: number; h: number }, event: DragEvent): void
```

### drop-drag-leave

拖放离开事件。

当外部可拖拽元素离开栅格区域时派发。仅在 [`is-droppable`](./properties#is-droppable) 为 `true` 时触发。

```ts
function dropDragLeave(event: DragEvent): void
```

## GridItem

### move

移动事件。

每次栅格元素进入移动并改变位置时派发。

```ts
function move(i: number | string, newX: number, newY: number): void
```

### resize

缩放事件。

每次栅格元素进入缩放并改变大小时派发。

```ts
function resize(i: number | string, newH: number, newW: number, newHPx: number, newWPx: number): void
```

### moved

移动后事件。

每次元素结束移动并改变位置时派发。

```ts
function moved(i: number | string, newX: number, newY: number): void
```

### resized

缩放后事件。

每次元素结束缩放并改变大小时派发。

```ts
function resized(i: number | string, newH: number, newW: number, newHPx: number, newWPx: number): void
```

### container-resized

容器缩放事件。

每次栅格元素或布局容器大小变化时派发。

```ts
function containerResized(i: number | string, newH: number, newW: number, newHPx: number, newWPx: number): void
```
