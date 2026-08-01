---
title: 方法
description: 调用 GridLayout 的公开方法，并处理编程式布局更新返回的受控事务回执。
---

# 方法

`GridLayout` 暴露了一组用于单次布局变更的方法。组件采用受控模型，因此命令被接受后只会先发送提案；父组件把新值写回后，事务才算提交。

## 获取组件引用

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

公开的 `root` 字段是一个只读 ref，指向组件根元素。

## 方法参考

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

| 方法                   | 作用                                     |
| ---------------------- | ---------------------------------------- |
| `setLayout(layout)`    | 校验并提议替换整个 Layout。              |
| `moveItem(id, x, y)`   | 提议修改一个栅格项的坐标。               |
| `resizeItem(id, w, h)` | 提议修改一个栅格项的尺寸。               |
| `addItem(item)`        | 校验并提议插入具有唯一 id 的栅格项。     |
| `removeItem(id)`       | 提议移除匹配的栅格项。                   |
| `bringToFront(id)`     | 在重叠模式下，提议把栅格项移动到最上层。 |
| `sendToBack(id)`       | 在重叠模式下，提议把栅格项移动到最下层。 |

层级方法会归一化 `LayoutItem.zIndex`，同时保持相对顺序。在 `collision-mode="overlap"` 之外调用时，会返回 `reason: 'disabled'` 的拒绝回执。

## 处理事务回执

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

回执包含三种状态：

| 状态        | 含义                                                |
| ----------- | --------------------------------------------------- |
| `pending`   | 提案已通过 `update:layout` 发出，正在等待属性确认。 |
| `unchanged` | 命令有效，但计算结果与已提交 Layout 在语义上相同。  |
| `rejected`  | 校验或布局规则拒绝了命令，已提交 Layout 保持不变。  |

使用 `v-model:layout` 时，Vue 通常会自动写回待确认的提案。如果父组件没有确认，`GridLayout` 会回滚这次提案，并发送 `operation-rejected`，其 `reason` 为 `'external-not-committed'`。新的命令也可能取代尚未确认的提案。

需要在提案真正提交后收到通知时，请监听 `layout-updated`。回执字段和拒绝原因见[操作契约](./contracts)。

## 响应式模式

调用响应式栅格的方法前，应同时绑定两个受控模型：

```vue
<GridLayout
  ref="grid"
  v-model:layout="layout"
  v-model:responsive-layouts="responsiveLayouts"
  responsive
/>
```

组件会使用同一个 revision 发送当前 Layout 和完整断点映射。两个值必须在同一个 Vue 更新周期写回。

## 组件方法还是组合式函数？

由 `GridLayout` 渲染界面时使用这些组件方法。无头状态使用 [`useGridLayout`](./composables#usegridlayout)：它的单次操作会同步提交并返回 `LayoutOperationResult`，所以状态是 `accepted`，而不是 `pending`。
