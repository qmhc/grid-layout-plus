---
title: 事件
description: GridLayout 的布局更新、交互生命周期、拖放事件和 GridItem 事件参考。
---

# 事件

`GridLayout` 会发送布局和交互生命周期事件。每个 `GridItem` 也会报告自身的移动、缩放和容器尺寸变化。完整效果可查看[移动和缩放事件](../example/events)。

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

`GridLayout` 每次接受布局变更时都会发送该事件。事件携带一份独立的 Layout 快照，`v-model:layout` 会用它替换父组件中的值。组件通过属性收到新值后，这次变更才算提交。

共享内容观测触发布局提案时，`meta.source` 为 `'auto-height'`。

```ts
function updateLayout(layout: ReadonlyLayout, meta: LayoutUpdateMeta): void
```

### update:responsive-layouts

响应式模式下，该事件与 `update:layout` 使用同一个 `meta.revision`。同时绑定两个 `v-model`，才能在同一事务中更新当前 Layout 和完整的断点布局。

```ts
function updateResponsiveLayouts<B extends string>(
  layouts: CompleteResponsiveLayouts<B>,
  meta: LayoutUpdateMeta,
): void
```

### layout-before-mount

在组件的 `beforeMount` 钩子中发送。

```ts
function layoutBeforeMount(newLayout: ReadonlyLayout): void
```

### layout-mounted

在组件的 `mounted` 钩子中发送。

```ts
function layoutMounted(newLayout: ReadonlyLayout): void
```

### layout-ready

组件完成首次布局计算后发送。

```ts
function layoutReady(newLayout: ReadonlyLayout): void
```

### layout-updated

事务提交并重新计算所有栅格项的位置后发送。被拒绝、取消或未确认的变更不会触发该事件。

```ts
function layoutUpdated(newLayout: ReadonlyLayout, meta: LayoutUpdateMeta): void
```

### breakpoint-changed

容器宽度变化并切换当前断点时发送。

```ts
function breakpointChanged<B extends string>(
  newBreakpoint: B | null,
  newLayout: ReadonlyLayout,
  meta: LayoutUpdateMeta,
): void
```

### width-changed

组件处理完有效的显式宽度或观测宽度后发送。事件数据会区分已解析的零宽状态和正宽状态，并同时提供候选状态与已提交的响应式状态。

```ts
function widthChanged<B extends string>(
  payload: WidthChangedPayload<B>,
  meta: LayoutUpdateMeta,
): void
```

### interaction-start / interaction-change / interaction-end

这三个事件组成一套带类型的交互生命周期。`interaction-change` 会按 animation frame 合并，携带最新接受的 Layout 和占位符。`interaction-end` 只发送一次，状态为 `committed`、`unchanged` 或 `cancelled`。

```ts
function interactionStart(payload: InteractionStartPayload): void
function interactionChange(payload: InteractionChangePayload): void
function interactionEnd(payload: InteractionTerminalPayload): void
```

### operation-rejected

公开命令、交互候选位置、受控更新或拖放候选项被拒绝时发送。具体原因可以从可判别的 `reason` 字段读取。已提交的 Layout 不会被修改。

```ts
function operationRejected(payload: OperationRejectedPayload): void
```

完整的数据结构和拒绝原因见[操作契约](./contracts#operationrejectedpayload)。

### error

后续属性更新无效、扩展点执行失败或几何计算出错时发送，同时保留上一次有效状态。初始 Layout 或配置无效时，仍会同步抛出错误。

```ts
function error(payload: GridLayoutRuntimeError): void
```

错误字段和处理规则见[错误](./contracts#错误)。

### drop-drag-over

外部可拖拽内容停留在栅格上方时持续发送。只有 [`is-droppable`](./properties#is-droppable) 为 `true` 时才会触发。

```ts
function dropDragOver<B extends string>(
  context: DropDragOverContext<B>,
  event: DragEvent,
): void
```

`context.candidate` 是不含 id 的最终候选项，其中包含 `DropConfig.onDragOver` 对尺寸所做的调整。`context.previewLayout` 保存归一化后的现有栅格项，`insertionIndex` 记录候选项在预览中的顺序，`proposalId` 标识本次已接受的计算结果。响应式模式下，本次计算会固定使用 `breakpoint` 指定的断点。

### drop

外部可拖拽内容放到栅格上时发送。只有 [`is-droppable`](./properties#is-droppable) 为 `true` 时才会触发。

`DropConfig.createItem` 会先创建完整业务对象，随后 `GridLayout` 发送受控 `update:layout` 提案。只有父组件确认该提案后，才会发送 `drop`。

```ts
function drop<B extends string>(
  result: DropCommitResult<B>,
  event: DragEvent,
): void
```

在配置中创建业务对象，事件监听器只消费已提交结果：

```ts
const dropConfig: DropConfig = {
  isDroppable: true,
  createItem: () => ({ i: createUniqueId(), x: 0, y: 0, w: 1, h: 1 }),
}

function handleDrop(result: DropCommitResult) {
  console.log('committed', result.item, result.revision)
}
```

响应式栅格沿用双受控模型事务：当前 Layout 与活动断点 Layout 都确认后才发送 `drop`。缺少工厂、工厂拒绝或抛错、重复 id、父组件未确认等情况统一通过 `operation-rejected` 报告。

### drop-drag-leave

外部可拖拽内容离开栅格时发送。只有 [`is-droppable`](./properties#is-droppable) 为 `true` 时才会触发。

```ts
function dropDragLeave(event: DragEvent): void
```

### transfer

同组跨网格移动在源、目标两个受控 Layout 都提交后发送；源网格和目标网格各发送一次。

```ts
function transfer(result: GridTransferResult, event: Event): void
```

`result.item` 是目标模型实际确认的完整业务对象，包含目标父组件合并的 metadata；`sourceLayout`、`targetLayout` 分别是两端已提交模型，并带有独立 revision。由于两个栅格可能使用不同的响应式断点类型，`sourceBreakpoint` 与 `targetBreakpoint` 均为 `string | null`。目标预览和快速切换不会提案模型更新；离开目标后继续源端本地拖拽，Escape 或窗口失焦会取消跨网格移动，并回滚本次交互造成的源端变化。若只有一端确认，协调器只向该已确认端发送补偿提案，且不会发送 `transfer`。

## GridItem

### move

栅格项移动过程中，每次栅格坐标变化时发送。

```ts
function move(i: number | string, newX: number, newY: number): void
```

### resize

栅格项缩放过程中，每次栅格尺寸或像素尺寸变化时发送。

```ts
function resize(i: number | string, newH: number, newW: number, newHPx: number, newWPx: number): void
```

### moved

栅格项结束移动且栅格坐标发生变化后发送。

```ts
function moved(i: number | string, newX: number, newY: number): void
```

### resized

栅格项结束缩放且栅格尺寸或像素尺寸发生变化后发送。

```ts
function resized(i: number | string, newH: number, newW: number, newHPx: number, newWPx: number): void
```

### container-resized

栅格项或布局容器的尺寸变化，并更新该栅格项的栅格尺寸或像素尺寸时发送。

```ts
function containerResized(i: number | string, newH: number, newW: number, newHPx: number, newWPx: number): void
```
