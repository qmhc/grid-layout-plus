---
title: 从 v1 迁移
description: 将 Grid Layout Plus v1 项目迁移到受控的 v2 API，并调整依赖已移除或废弃行为的代码。
---

# 从 v1 迁移

本页列出 Grid Layout Plus 从 v1 升级到 v2 时需要处理的不兼容变化，内容以最新的 v1 版本 `v1.1.1` 为基线。按项目用到的功能阅读相应章节即可。

## 组件样式改为显式引入

v1 会在 JavaScript 入口加载时注入组件样式。v2 把样式作为独立文件发布，ESM、CommonJS 和 IIFE 产物都不再注入样式。

请在应用入口引入一次样式，让构建工具按照项目自己的浏览器目标继续处理 CSS：

```ts
import 'grid-layout-plus/style.css'
```

直接使用浏览器版本时，请在脚本前加载样式文件：

```html
<link rel="stylesheet" href="dist/style.css" />
<script src="dist/grid-layout-plus.js"></script>
```

## `Layout` 改为受控模型

这项变化影响依赖 `GridLayout` 原地修改 `Layout` 数组的项目。

v1 会直接修改传入的 `Layout` 数组和栅格项。v2 把它视为只读输入：`GridLayout` 会发出新的 `Layout`，父组件写回后才会提交变更。

使用可写 `ref` 和 `v-model:layout` 保存布局：

```vue
<script setup lang="ts">
import { ref } from 'vue'

import type { Layout } from 'grid-layout-plus'

const layout = ref<Layout>([
  { i: 'summary', x: 0, y: 0, w: 2, h: 2 }
])
</script>

<template>
  <GridLayout v-model:layout="layout" />
</template>
```

已经使用这种写法的项目无需修改。只传 `:layout` 而不处理 `update:layout` 仍能只读渲染，但拖拽、缩放和调用组件方法产生的变更不会保留。

必须保持数组引用不变时，请在 `update:layout` 监听器中原位替换数组内容。参见[布局数据](./usage#布局数据)。

## 常规变化

### 栅格间距与容器内边距

`margin` 属性和配置字段已移除，请改名为 `gap`：

```vue
<!-- v1 -->
<GridLayout :margin="[10, 10]" />

<!-- v2 -->
<GridLayout :gap="[10, 10]" />
```

`gap` 只控制行列之间的间距。v2 中未传入 `containerPadding` 时默认值为 `[0, 0]`，不再沿用栅格间距。若要保留 v1 默认的容器外圈留白，请显式设置两个值：

```vue
<GridLayout :gap="[10, 10]" :container-padding="[10, 10]" />
```

### 压缩和定位属性

这项变化只影响显式设置过 `vertical-compact`、`use-css-transforms` 或 `transform-scale` 的项目。

v2 用压缩器和定位策略取代这三个属性：

| v1 属性                       | v2 替代方式                                      |
| ----------------------------- | ------------------------------------------------ |
| `:vertical-compact="true"`    | `:compactor="verticalCompactor"`（默认）         |
| `:vertical-compact="false"`   | `:compactor="noCompactor"`                       |
| `:use-css-transforms="true"`  | `:position-strategy="transformStrategy"`（默认） |
| `:use-css-transforms="false"` | `:position-strategy="absoluteStrategy"`          |
| `:transform-scale="scale"`    | `:position-strategy="scaledStrategy(scale)"`     |

默认行为仍是垂直压缩和 CSS transform 定位。原来显式传入 `true` 的项目可以直接删除对应属性；原来关闭压缩、关闭 transform 定位或设置过缩放值的项目需要改用表中的替代方式。

内置实现及其导入方式见 [`compactor`](./properties#grid-layout-compactor) 和 [`position-strategy`](./properties#position-strategy)。

### GridItem 的数据来源

这项变化只影响通过默认插槽手动渲染 `GridItem` 的项目。使用 `item` 插槽的项目无需修改。

在 v1 中，项目通常还会把坐标、尺寸和约束传给 `GridItem`。v2 只把 `GridItem.i` 用作注册键；几何信息、`static`、min/max 约束、`isDraggable`、`isResizable` 和 `zIndex` 全部从父级 `Layout` 中 `i` 相同的 `LayoutItem` 读取。

```vue
<GridItem
  v-for="item in layout"
  :key="item.i"
  :i="item.i"
>
  {{ item.i }}
</GridItem>
```

这些镜像属性为了兼容旧代码仍保留在 `GridItemProps` 中，但已标记为废弃；`GridItem` 注册到有效的父级布局后，它们不会覆盖对应的 `LayoutItem`。`isBounded`、拖拽和缩放选择器、`preserveAspectRatio`、interact 选项以及 `dragThreshold` 仍属于 `GridItem`。

### 自定义缩放手柄

这项变化影响通过 `resizeOption.edges` 传入选择器或 Element，把应用 DOM 作为缩放手柄的 v1
项目。

v2 将启用方向与视觉渲染分开。请把方向迁移到 `resizeConfig.handles` 或
`LayoutItem.resizeHandles`，再使用 `resize-handle` 插槽渲染视觉内容。组件会继续管理外层命中
区域和交互绑定：

```vue
<GridLayout v-model:layout="layout" :resize-config="{ handles: ['e', 's', 'se'] }">
  <template #item="{ item }">{{ item.i }}</template>
  <template #resize-handle="{ axis, direction }">
    <CustomHandle :axis="axis" :direction="direction" />
  </template>
</GridLayout>
```

`resizeOption.edges` 不属于 v2 的透传选项。`axis` 表示配置方向，`direction` 表示经过 RTL 或
镜像渲染后的物理方向。详见[插槽](./properties#插槽)和[自定义缩放手柄示例](../example/custom-resize-handles)。

### `Layout` 校验

这项变化影响包含 v1 接受、但 v2 会拒绝的坐标、尺寸、`i` 或约束值的布局。

v2 要求坐标和尺寸为 JavaScript 安全整数，坐标不能为负，尺寸必须为正。`i` 必须唯一，且必须是非空字符串或不是 `-0` 的安全整数；min/max 关系也必须有效。

初始 `Layout` 或配置无效时会同步抛出 `GridLayoutValidationError`。后续收到无效属性时会触发 `error` 事件，并保留上一次有效的 `Layout`。调用公开方法时，如果参数无效，会返回 `status` 为 `'rejected'` 的结果。不要依赖具体的错误消息文本，请读取错误对象的 `code`、`path` 和 `cause`。

### `Layout` 事件

这项变化只影响会修改事件参数，或依赖事件触发时机的监听器。

v2 的 `Layout` 事件参数是彼此独立的只读快照。`update:layout`、`layout-updated` 和 `breakpoint-changed` 还会提供包含 `revision` 与 `source` 的 `LayoutUpdateMeta`。只读取 v1 原有参数的监听器可以保持不变。

`layout-updated` 只会在交互、组件方法调用或外部替换完成提交后触发。更新被拒绝、取消，或父组件没有写回时，不会触发该事件。参见[事件](./events)。

### `restoreOnDrag` 行为

这项变化只影响显式设置 `restore-on-drag="true"` 的项目。

默认值仍是 `false`。设为 `true` 时，v2 会在拖拽期间把当前栅格项保留在指针所在的候选位置；松开指针后的最终压缩仍可能移动它。升级后应重新检查占位符和最终落点。

### 外部拖入与跨网格拖拽

v1 的外部拖入示例会调用 `getItem()`、`dragEvent()` 等组件内部字段；这些字段在 v2 不属于公开 API。原生外部拖入应配置 `DropConfig.createItem`，组件会自动发送受控插入提案，并只在确认后发送 `drop`。请删除监听 `drop` 后把 `result.candidate` 手工插入 `previewLayout` 的逻辑。

```ts
const dropConfig: DropConfig = {
  isDroppable: true,
  createItem: () => ({ i: createUniqueId(), x: 0, y: 0, w: 1, h: 1 }),
}
```

需要在多个栅格间移动时，为它们设置相同的 `transferConfig.group`，并用 `v-model:layout` 绑定两端 Layout。v2 的跨网格转移仅支持移动，并要求两个受控模型都确认。

## 已移除的 API

### GridLayout 组件引用的内部字段

这项变化只影响直接访问 `GridLayout` 组件引用的项目。

v1 暴露的 `state`、`getItem()`、`dragEvent()`、`resizeEvent()` 和 `layoutUpdate()` 已被移除。v2 的组件引用只暴露 `root` 以及 `setLayout()`、`moveItem()`、`resizeItem()`、`addItem()`、`removeItem()`、`bringToFront()` 和 `sendToBack()`。

读取当前状态时，改用受控 `Layout` 和组件事件。单次修改可以调用对应方法；自定义连续拖拽或缩放流程时，使用 `useGridLayout` 返回的交互 API。

v1 根入口导出的 `LayoutInstance` 标记为 `@internal`，v2 不再导出。组件引用使用 `GridLayoutExpose`，无头状态使用 `UseGridLayoutReturn`。

## 已废弃的 API

以下 API 在 v2 中仍可使用，但会在后续版本移除：

- `prevent-collision`：改用 [`collision-mode="prevent"`](./properties#collision-mode)。
- `Breakpoint`：改用 `DefaultBreakpoint`，或为响应式 API 提供自定义断点泛型。
- `ResponsiveLayout`：根据用途改用 `ResponsiveLayoutsInput` 或 `CompleteResponsiveLayouts`。
- `moveElement`：仅依赖旧行为的调用可以继续保留；如果还需要处理边界、碰撞模式和压缩，改用 `normalizeLayout` 或 `useGridLayout`。

## 高级

以下变化只涉及较少见的接入方式。

### 响应式 `Layout`

响应式模式下，v2 发出的当前 `Layout` 和完整断点布局使用同一个 `revision`。需要持久化响应式布局时，请同时绑定两个 `v-model`，并在同一轮 Vue 更新中写回：

```vue
<GridLayout
  v-model:layout="layout"
  v-model:responsive-layouts="responsiveLayouts"
  responsive
/>
```

### 手动 GridItem 的 DOM 边界

手动渲染的 `GridItem` 必须位于所属 `GridLayout` 的根节点内，并直接使用该根节点作为 CSS 包含块（`offsetParent`）。

如果 v1 项目使用 `Teleport` 将栅格项移到根节点外，或在两者之间加入带定位的包装节点，请调整 DOM 结构。v2 会拒绝这类注册，避免继续基于错误的包含块计算几何和处理指针交互。

### 直接导入布局辅助函数

v1 没有从包根入口公开布局算法，`es/helpers/*` 和 `lib/helpers/*` 也不是稳定的 API 入口。如果项目从这些路径导入了 v2 仍支持的布局辅助函数，请改用包根入口或 `grid-layout-plus/core`：

```ts
import { compact, normalizeLayout } from 'grid-layout-plus/core'
```

v2 中稳定的核心函数不会修改输入 `Layout`，必须使用返回的新 `Layout`：

```ts
layout.value = normalizeLayout(layout.value, {
  cols: 12,
  maxRows: 40,
  collisionMode: 'push',
})
```

`compact` 的第三个参数现在是 `ReadonlyMap`，不再接受 v1 的普通对象。数字和字符串形式的 `i` 会分别处理：

```ts
const minPositions = new Map([
  [1, { y: 0 }],
  ['1', { y: 2 }],
])

layout.value = compact(layout.value, false, minPositions)
```

### `LayoutItem` 附加数据

这项变化影响在 `LayoutItem` 上保存自定义数据的项目。附加值必须是可安全克隆的普通数据；v2 会拒绝函数、类实例、`Symbol`、循环引用、访问器属性和非有限数值。

请把这些不可克隆的值移到以 `i` 为键的外部映射中，`LayoutItem` 只保留普通数据。

## 从更早的 v1 版本迁移

先查看 [CHANGELOG](https://github.com/qmhc/grid-layout-plus/blob/main/CHANGELOG.md) 中从当前版本到 `v1.1.1` 的变化，再按照本页迁移到 v2。
