---
title: 常见任务
description: Grid Layout Plus v2 的受控布局、响应式、编程式、无头渲染和 Core API 完整示例，可直接复用。
---

# 常见任务

下面的示例同时说明 v2 的数据所有权和成功条件。根据自己的渲染方式，选择最接近的一条路径即可。

## 渲染受控栅格

把 Layout 保存在可写 ref 中，并通过 `v-model:layout` 绑定。每个栅格项的坐标和约束都来自该数组。

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
        <span v-if="isDragging || isResizing">更新中……</span>
      </article>
    </template>
  </GridLayout>
</template>
```

不要把 `x`、`y`、`w`、`h` 或 `static` 传给 `GridItem`。这些废弃的兼容属性不是 `GridLayout` 内部的数据来源。

## 同步响应式 Layout

响应式模式会控制两个值：当前 Layout 和各断点的 Layout 映射。请同时绑定两个模型，让 Grid Layout Plus 可以在同一个 Vue 更新周期内提议它们。

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

宽度解析后，不要只更新其中一个模型。部分更新会产生 `GridLayoutRuntimeError.code === 'partial-responsive-update'`，并恢复最后一组有效值。

## 执行编程式组件命令

组件方法接受命令后会返回 `pending`，发送受控提案，再等待父组件写回。通过 `layout-updated` 判断提案是否已经提交。

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
  <button type="button" @click="moveSummary">移动 summary</button>
  <GridLayout
    ref="grid"
    v-model:layout="layout"
    @layout-updated="handleLayoutUpdated"
    @operation-rejected="handleRejected"
  />
</template>
```

`pending` 不表示已经提交。父组件未写回时，提案仍可能以 `external-not-committed` 被拒绝，也可能被较新的命令取代。

## 不渲染组件，只管理 Layout 状态

自定义渲染层负责 DOM 时，把可写的 `Ref<Layout>` 传给 `useGridLayout`。单次操作会同步提交，因此 `accepted` 表示 ref 已经包含新的 Layout。

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
  console.log('已提交的 Layout：', grid.layout.value)
}
```

如果传入普通 `ReadonlyLayout` 而不是 ref，组合式函数会维护一份内部可写副本。所有权模式在创建组合式函数时确定，之后不会改变。

## 不使用 Vue，校验并规范化 Layout 数据

服务端校验、持久化边界、Worker 或纯算法代码应使用 `/core` 入口。该入口不依赖 Vue、DOM 或组件样式。

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

校验会检查公开数据契约；规范化随后应用列范围、最大行数、碰撞处理、放置和压缩规则，并返回独立且可修改的 Layout。

## 下一步

- 使用 [API 索引](./api-index)定位公开符号。
- 按状态或错误编写分支前，先阅读[操作契约](./contracts)。
- 在[示例](../example/)中查看可运行的交互和样式案例。
