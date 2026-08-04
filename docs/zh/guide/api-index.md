---
title: API 索引
description: 按任务查找 Grid Layout Plus v2 的组件、组合式函数、类型、方法、事件或 Core API 导出。
---

# API 索引

使用本页定位 v2 公开符号。组件、组合式函数和组件契约从 `grid-layout-plus` 导入，组件样式从 `grid-layout-plus/style.css` 引入；不需要 Vue 组件时，可以从 `grid-layout-plus/core` 导入不依赖 DOM 的算法。

## 按任务选择 API

| 任务                     | 首选 API                                                                                         | 继续阅读                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| 渲染可交互的 Vue 栅格    | [`GridLayout`](./properties#gridlayout) 和 [`GridItem`](./properties#griditem)                   | [用法](./usage)                                    |
| 在栅格项后绘制栅格背景   | [`GridBackground`](./properties#gridbackground)                                                  | [栅格背景示例](../example/grid-background)         |
| 定制指针缩放手柄         | [`resize-handle` 插槽](./properties#插槽)                                                        | [自定义缩放手柄](../example/custom-resize-handles) |
| 通过代码修改已渲染的栅格 | [`GridLayoutExpose`](./methods#方法参考)                                                         | [操作契约](./contracts)                            |
| 构建自定义渲染层         | [`useGridLayout`](./composables#usegridlayout)                                                   | [组合式 API 示例](../example/composable-api)       |
| 不使用组件管理响应式状态 | [`useResponsiveLayout`](./composables#useresponsivelayout)                                       | [响应式类型](./properties#响应式布局类型)          |
| 观测容器宽度             | [`useContainerWidth`](./composables#usecontainerwidth)                                           | [width 属性](./properties#width)                   |
| 校验或规范化 Layout 数据 | [`validateLayout`](./core-api#validatelayout) 或 [`normalizeLayout`](./core-api#normalizelayout) | [Core API](./core-api)                             |
| 处理被拒绝的操作         | [`OperationRejectedPayload`](./contracts#operationrejectedpayload)                               | [拒绝原因](./contracts#拒绝原因)                   |
| 迁移 v1 代码             | [从 v1 迁移](./migration)                                                                        | [属性](./properties)                               |

## 组件与组件契约

| 公开导出                                                                                                                                       | 参考文档                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `GridLayout`                                                                                                                                   | [GridLayout 属性](./properties#gridlayout)、[事件](./events#gridlayout)和[方法](./methods) |
| `GridItem`                                                                                                                                     | [GridItem 属性](./properties#griditem)和[事件](./events#griditem)                          |
| `GridBackground`                                                                                                                               | [GridBackground 属性](./properties#gridbackground)                                         |
| `GridLayoutProps`、`GridItemProps`                                                                                                             | [属性](./properties)                                                                       |
| `GridLayoutEmits`、`GridItemEmits`                                                                                                             | [事件](./events)                                                                           |
| `GridLayoutExpose`、`LayoutTransactionReceipt`                                                                                                 | [方法](./methods)与[事务回执](./contracts#layouttransactionreceipt)                        |
| `GridItemSlots`、`GridItemResizeHandleSlotScope`、`GridLayoutSlots`、`GridLayoutSlotScope`、`GridLayoutResizeHandleSlotScope`                  | [插槽](./properties#插槽)                                                                  |
| `GridConfig`、`DragConfig`、`ResizeConfig`                                                                                                     | [分组配置](./properties#grid-config)                                                       |
| `DropConfig`、`DropCandidate`、`DropDragOverInput`、`DropDragOverContext`、`DropEvaluationResult`、`DropCreateItemContext`、`DropCommitResult` | [Drop 类型](./properties#drop-类型)与[拖放事件](./events#drop-drag-over)                   |
| `TransferConfig`、`GridTransferResult`                                                                                                         | [Transfer 类型](./properties#transfer-类型)与 [`transfer`](./events#transfer)              |
| `LayoutUpdateMeta`、`ResponsiveWidthState`、`WidthChangedPayload`                                                                              | [事件](./events)                                                                           |
| `InteractionStartPayload`、`InteractionChangePayload`                                                                                          | [交互事件](./events#interaction-start-interaction-change-interaction-end)                  |

## 布局与扩展类型

| 公开导出                                                                                                                                        | 参考文档                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `LayoutItemRequired`、`LayoutItem`、`ReadonlyLayoutItem`、`Layout`、`ReadonlyLayout`、`ResizeHandleAxis`                                        | [布局类型](./properties#类型)                              |
| `DefaultBreakpoint`、`Breakpoints`                                                                                                              | [断点类型](./properties#defaultbreakpoint-与-breakpoints)  |
| `ResponsiveValue`、`ResponsiveLayoutsInput`、`CompleteResponsiveLayouts`                                                                        | [响应式布局类型](./properties#响应式布局类型)              |
| `Breakpoint`、`ResponsiveLayout`                                                                                                                | [废弃的兼容别名](./migration#已废弃的-api)                 |
| `CollisionMode`                                                                                                                                 | [碰撞模式](./properties#collisionmode)                     |
| `Compactor`、`CompactType`、`CompactMinPositions`                                                                                               | [压缩器契约](./properties#compactor)                       |
| `PositionStrategy`、`PositionStyle`                                                                                                             | [定位策略契约](./properties#positionstrategy)              |
| `GridCellDimensions`、`CalcGridCellDimensionsInput`、`GridGeometry`、`PixelRect`、`ReadonlyClientRect`                                          | [几何类型](./properties#几何类型)                          |
| `LayoutOperationResult`、`LayoutOperationResultBase`、`AcceptedLayoutOperationResult`、`RejectedLayoutOperationResult`、`LayoutOperationReason` | [操作结果](./contracts#layoutoperationresult)              |
| `NormalizeLayoutOptions`、`DeepReadonly`                                                                                                        | [Core API](./core-api) 与 [Layout 类型](./properties#类型) |
| `GridLayoutValidationCode`、`GridLayoutExtensionCode`、`GridLayoutExtensionSource`                                                              | [错误](./contracts#错误)                                   |

## 组合式函数与无头契约

| 公开导出                                                                         | 参考文档                                                   |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `useGridLayout`、`UseGridLayoutOptions`、`UseGridLayoutReturn`                   | [`useGridLayout`](./composables#usegridlayout)             |
| `useResponsiveLayout`、`UseResponsiveLayoutOptions`、`UseResponsiveLayoutReturn` | [`useResponsiveLayout`](./composables#useresponsivelayout) |
| `useContainerWidth`、`UseContainerWidthOptions`、`UseContainerWidthReturn`       | [`useContainerWidth`](./composables#usecontainerwidth)     |
| `GridDragState`、`GridResizeState`、`GridInteractionCandidate`                   | [`useGridLayout` 返回状态](./composables#返回状态与操作)   |
| `GridInteractionStart`、`GridInteractionStartResult`、`GridInteractionToken`     | [`useGridLayout` 交互](./composables#返回状态与操作)       |
| `InteractionCommandResult`、`InteractionCancelReason`                            | [交互结束契约](./contracts#interactionterminalpayload)     |
| `InteractionTerminalBase`、`InteractionTerminalPayload`                          | [交互结束契约](./contracts#interactionterminalpayload)     |
| `LayoutChangeReason`、`OperationRejectedReason`、`OperationRejectedPayload`      | [操作契约](./contracts)                                    |
| `GridLayoutRuntimeError`                                                         | [运行时错误](./contracts#错误)                             |

## Core 导出值

本节中的值都可以从 `grid-layout-plus` 和 `grid-layout-plus/core` 导入。只使用算法时，推荐 `/core` 入口。

| 公开导出                                                                                    | 参考文档                                            |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `validateLayout`、`normalizeLayout`、`cloneLayout`                                          | [校验与规范化](./core-api#校验与规范化)             |
| `bottom`、`collides`、`getFirstCollision`、`getAllCollisions`、`sortLayoutItemsByRowCol`    | [查询 Layout](./core-api#查询-layout)               |
| `correctBounds`、`compact`                                                                  | [边界与旧版底层函数](./core-api#边界与旧版底层函数) |
| `verticalCompactor`、`horizontalCompactor`、`noCompactor`                                   | [压缩器](./core-api#压缩器)                         |
| `fastVerticalCompactor`、`fastHorizontalCompactor`                                          | [压缩器](./core-api#压缩器)                         |
| `transformStrategy`、`absoluteStrategy`、`scaledStrategy`                                   | [定位策略](./core-api#定位策略)                     |
| `calcGridCellDimensions`、`gridToPixelRect`、`pointerToGridPosition`、`pixelSizeToGridSize` | [几何换算](./core-api#几何换算)                     |
| `GridLayoutValidationError`、`GridLayoutExtensionError`                                     | [错误](./core-api#错误)                             |
| `moveElement`、`withOverlap`                                                                | [已废弃的 API](./migration#已废弃的-api)            |

## 导入边界

```ts
import { GridLayout, useGridLayout } from 'grid-layout-plus'
import { normalizeLayout, validateLayout } from 'grid-layout-plus/core'
import 'grid-layout-plus/style.css'
```

JavaScript 入口都不会注入组件 CSS。渲染组件时请显式引入 `grid-layout-plus/style.css`；`/core` 入口不依赖 Vue、DOM 或组件 CSS。不要从 `src`、`es`、`lib` 或其他内部路径导入本页未列出的 API。
