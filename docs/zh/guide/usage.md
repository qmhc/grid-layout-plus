---
title: 用法
description: 了解 Grid Layout Plus 的受控 Layout 数据流、渲染方式和无头渲染。
---

# 用法

布局数组由应用维护。交互过程中，`GridLayout` 会发出有效的布局变更，父组件再把确认后的值传回来。栅格项可以由 `item` 插槽渲染，也可以手动创建。

## 布局数据

布局是一个栅格项数组。每一项都需要 `i`（id）、`x`、`y`、`w` 和 `h`。

```vue
<script setup lang="ts">
import { ref } from 'vue'

import type { Layout } from 'grid-layout-plus'

const layout = ref<Layout>([
  { x: 0, y: 0, w: 2, h: 2, i: '0' },
  { x: 2, y: 0, w: 2, h: 4, i: '1' }
])
</script>
```

`GridLayout` 不会直接修改数组或其中的栅格项。使用 `v-model:layout` 时，Vue 会在每次变更被接受后替换 `layout.value`。如果只传入 `:layout="layout"`，组件可以渲染布局，但无法保存拖拽或缩放结果。

如果其他代码依赖 `reactive` 数组的引用，可以监听 `update:layout`，再原位替换数组内容：

```vue
<script setup lang="ts">
import { reactive } from 'vue'

import type { Layout, ReadonlyLayout } from 'grid-layout-plus'

const layout = reactive<Layout>([
  { x: 0, y: 0, w: 2, h: 2, i: '0' }
])

function confirmLayout(next: ReadonlyLayout) {
  layout.splice(0, layout.length, ...next)
}
</script>

<template>
  <GridLayout :layout="layout" @update:layout="confirmLayout" />
</template>
```

## 渲染栅格项

栅格项可以通过 `item` 插槽或默认插槽渲染。

使用 `item` 插槽时，`GridLayout` 会创建每个 `GridItem`，并把对应的布局数据传给插槽：

```vue
<template>
  <!-- Item slot usage -->
  <GridLayout
    v-model:layout="layout"
    :col-num="12"
    :row-height="30"
    is-draggable
    is-resizable
  >
    <template #item="{ item }">
      {{ item.i }}
    </template>
  </GridLayout>
</template>
```

需要设置 `GridItem` 的交互属性或监听其事件时，使用默认插槽。几何信息和栅格项约束仍然来自父级 `layout` 中对应的 `LayoutItem`：

```vue
<template>
  <!-- Default slot usage -->
  <GridLayout
    v-model:layout="layout"
    :col-num="12"
    :row-height="30"
    is-draggable
    is-resizable
  >
    <GridItem
      v-for="item in layout"
      :key="item.i"
      :i="item.i"
      @resize="handleResize"
    >
      {{ item.i }}
    </GridItem>
  </GridLayout>
</template>
```

## 压缩与定位

`compactor` 和 `positionStrategy` 已取代移除的 `vertical-compact` 和 `use-css-transforms`。默认值仍是垂直压缩和 CSS transforms。旧代码设置过这两个属性时，请参照[迁移指南](./migration)修改。

```vue
<template>
  <GridLayout
    v-model:layout="layout"
    :compactor="horizontalCompactor"
    :position-strategy="absoluteStrategy"
  >
    <template #item="{ item }">
      {{ item.i }}
    </template>
  </GridLayout>
</template>
```

[属性](./properties#compactor)列出了内置压缩器和定位策略。

## 无头渲染

`useGridLayout` 使用同一个布局引擎，但不渲染组件 DOM。传入可写的 Layout ref 后，已接受的操作会写回该 ref；传入普通 Layout 时，组合式函数会自行维护状态。创建后不能切换这两种模式。

```ts
const grid = useGridLayout({
  layout,
  cols: 12,
  rowHeight: 30
})

const result = grid.moveItem('0', 1, 0)
if (result.status === 'rejected') {
  console.warn(result.reason)
}
```

完整的选项和返回值见[组合式函数](./composables)。自定义 DOM 渲染可参考[组合式 API 示例](../example/composable-api)。

## 下一步

在[示例](../example/)中查找具体交互。需要确认输入或回调时，查看[属性](./properties)、[事件](./events)或[方法](./methods)。
