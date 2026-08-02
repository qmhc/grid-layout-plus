---
title: 组合式函数
description: 不渲染内置组件，直接使用 Grid Layout Plus 的布局管理、响应式布局状态和容器宽度观测。
---

# 组合式函数

组合式函数让自定义渲染使用同一套经过校验的布局与响应式行为。它们都从 `grid-layout-plus` 导入。

## useGridLayout

应用自行渲染 DOM，但仍需要 Grid Layout Plus 的放置、碰撞、压缩和交互规则时，使用 `useGridLayout`。

```ts
interface UseGridLayoutOptions {
  layout: Ref<Layout> | ReadonlyLayout
  cols: MaybeRefOrGetter<number>
  rowHeight?: MaybeRefOrGetter<number>
  gap?: MaybeRefOrGetter<readonly [number, number]>
  containerPadding?: MaybeRefOrGetter<readonly [number, number]>
  maxRows?: MaybeRefOrGetter<number>
  compactor?: MaybeRefOrGetter<Compactor>
  collisionMode?: MaybeRefOrGetter<CollisionMode>
  isDraggable?: MaybeRefOrGetter<boolean>
  isResizable?: MaybeRefOrGetter<boolean>
  restoreOnDrag?: MaybeRefOrGetter<boolean>
  bringToFrontOnInteract?: MaybeRefOrGetter<boolean>
  onLayoutChange?: (layout: ReadonlyLayout, reason: LayoutChangeReason) => void
  onOperationRejected?: (payload: OperationRejectedPayload) => void
  onInteractionEnd?: (payload: InteractionTerminalPayload) => void
  onError?: (error: GridLayoutRuntimeError) => void
}
```

### Layout 所有权

- 传入可写的 `Ref<Layout>` 时，已接受的操作会替换它的值。
- 传入普通 `ReadonlyLayout` 时，由组合式函数维护内部状态。
- 组合式函数创建后不能切换所有权模式。
- 使用 ref 或 getter 包装的配置会保持响应式。

```ts
import { computed, ref } from 'vue'
import { useGridLayout } from 'grid-layout-plus'

import type { Layout } from 'grid-layout-plus'

const layout = ref<Layout>([{ i: 'summary', x: 0, y: 0, w: 2, h: 2 }])
const cols = ref(12)

const grid = useGridLayout({
  layout,
  cols,
  rowHeight: 30,
  containerPadding: [10, 10]
})

const items = computed(() => grid.layout.value)
const result = grid.moveItem('summary', 2, 0)
if (result.status === 'rejected') {
  console.warn(result.reason)
}
```

### 返回状态与操作

| 成员              | 类型或作用                                                                       |
| ----------------- | -------------------------------------------------------------------------------- |
| `layout`          | 保存已提交 Layout 的只读 ref。                                                   |
| `placeholder`     | 最新接受的交互候选项，没有候选项时为 `null`。                                    |
| `dragState`       | 带类型的拖拽状态和 token。                                                       |
| `resizeState`     | 带类型的缩放状态和 token。                                                       |
| `isInteracting`   | 当前是否存在拖拽或缩放交互。                                                     |
| `containerRows`   | 当前占用的行数。                                                                 |
| `containerHeight` | 计算得到的内容高度，单位为像素。                                                 |
| 单次操作          | `setLayout`、`moveItem`、`resizeItem`、`addItem`、`removeItem` 和层级方法。      |
| 连续交互          | `beginInteraction`、`updateInteraction`、`endInteraction`、`cancelInteraction`。 |

单次操作返回 `LayoutOperationResult`，接受后会同步提交。连续交互使用 `beginInteraction` 返回的不透明 token；不要自行创建或复用 token。

结果和终态见[操作契约](./contracts)，自定义渲染见[组合式 API 示例](../example/composable-api)。

## useResponsiveLayout

`useResponsiveLayout` 根据宽度和响应式配置，让可写的当前 Layout 与断点映射保持同步。

```ts
interface UseResponsiveLayoutOptions<B extends string = DefaultBreakpoint> {
  breakpoints: MaybeRefOrGetter<Breakpoints<B>>
  cols: MaybeRefOrGetter<Readonly<Record<B, number>>>
  width: MaybeRefOrGetter<number | null>
  layout: Ref<Layout>
  layouts: Ref<ResponsiveLayoutsInput<B>>
  initialFallback: ReadonlyLayout
  compactor?: MaybeRefOrGetter<Compactor>
  collisionMode?: MaybeRefOrGetter<CollisionMode>
  maxRows?: MaybeRefOrGetter<number>
  onError?: (error: GridLayoutRuntimeError) => void
}
```

```ts
import { ref } from 'vue'
import { useResponsiveLayout } from 'grid-layout-plus'

import type { Layout, ResponsiveLayoutsInput } from 'grid-layout-plus'

type AppBreakpoint = 'mobile' | 'desktop'

const width = ref<number | null>(null)
const layout = ref<Layout>([])
const layouts = ref<ResponsiveLayoutsInput<AppBreakpoint>>({})

const responsive = useResponsiveLayout({
  breakpoints: { mobile: 0, desktop: 1024 },
  cols: { mobile: 2, desktop: 12 },
  width,
  layout,
  layouts,
  initialFallback: [{ i: 'summary', x: 0, y: 0, w: 2, h: 2 }]
})
```

组合式函数会同时写入 `layout` 和 `layouts`。宽度已解析后，如果只更新其中一个，会通过 `onError` 报告 `code: 'partial-responsive-update'`，并恢复最后一组有效值。`initialFallback` 在创建组合式函数时采样，用于补齐缺失的断点布局。

返回的 ref：

| Ref                 | 含义                                          |
| ------------------- | --------------------------------------------- |
| `state`             | `unresolved`、`resolved-zero` 或 `resolved`。 |
| `currentBreakpoint` | 当前断点；宽度解析前为 `null`。               |
| `currentCols`       | 当前断点的列数；宽度解析前为 `null`。         |
| `currentLayout`     | 当前 Layout 的只读快照。                      |
| `completeLayouts`   | 宽度解析后的完整断点映射，否则为 `null`。     |

## useContainerWidth

`useContainerWidth` 会解析显式宽度，或者读取 `ResizeObserver` 报告的 content-box 宽度。

```ts
interface UseContainerWidthOptions {
  explicitWidth?: MaybeRefOrGetter<number | undefined>
  onError?: (error: GridLayoutRuntimeError) => void
}

function useContainerWidth(
  el: Readonly<Ref<HTMLElement | null>>,
  options?: Readonly<UseContainerWidthOptions>
): {
  width: Readonly<Ref<number | null>>
  state: Readonly<Ref<'unresolved' | 'resolved-zero' | 'resolved'>>
}
```

```ts
import { ref } from 'vue'
import { useContainerWidth } from 'grid-layout-plus'

const container = ref<HTMLElement | null>(null)
const { width, state } = useContainerWidth(container)
```

`explicitWidth` 有值时会停止观测，并使用该非负宽度；它恢复为 `undefined` 后，组合式函数会重新观测元素。Vue effect scope 销毁时会断开 observer。观测或校验失败会发送给 `onError`；没有可用测量结果时，状态保持为 `unresolved`。
