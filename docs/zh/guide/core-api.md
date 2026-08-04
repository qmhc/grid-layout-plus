---
title: Core API
description: 不依赖 Vue 或 DOM，直接使用 Grid Layout Plus 的校验、规范化、压缩、碰撞和几何函数。
---

# Core API

稳定的 Core API 由纯布局函数和几何函数组成，不依赖 Vue、浏览器 DOM API 或组件 CSS。

```ts
import { normalizeLayout, verticalCompactor } from 'grid-layout-plus/core'
```

这些 API 也从 `grid-layout-plus` 根入口导出。只使用算法、在服务端运行或不渲染 UI 时，推荐使用 `/core`，因为它不依赖 Vue、DOM 或组件样式。

所有稳定函数都把 Layout 参数视为只读输入。生成 Layout 的函数会返回独立且可修改的副本，调用方必须使用返回值。

## 校验与规范化

### validateLayout

```ts
function validateLayout(layout: ReadonlyLayout, contextName?: string): void
```

校验 Layout 的结构、id、坐标、尺寸、约束和附加普通数据。校验失败会抛出 `GridLayoutValidationError`。该函数不应用列范围、碰撞或压缩规则。

### normalizeLayout

```ts
function normalizeLayout(
  layout: ReadonlyLayout,
  options: Readonly<{
    cols: number
    maxRows?: number
    collisionMode?: CollisionMode
    compactor?: Compactor
  }>
): Layout
```

在一次调用中应用边界、最大行数、碰撞、放置和压缩规则。

```ts
const normalized = normalizeLayout(layout, {
  cols: 12,
  maxRows: 40,
  collisionMode: 'push',
  compactor: verticalCompactor
})
```

### cloneLayout

```ts
function cloneLayout(layout: ReadonlyLayout): Layout
```

返回深度克隆且可修改的 Layout。`LayoutItem` 附加数据需要满足与组件输入相同的可克隆普通数据契约。

## 查询 Layout

| 函数                              | 返回值                            | 作用                             |
| --------------------------------- | --------------------------------- | -------------------------------- |
| `bottom(layout)`                  | `number`                          | 最大底边栅格坐标。               |
| `collides(first, second)`         | `boolean`                         | 半开矩形碰撞检测。               |
| `getFirstCollision(layout, item)` | `ReadonlyLayoutItem \| undefined` | 按 Layout 顺序返回第一个碰撞项。 |
| `getAllCollisions(layout, item)`  | `readonly ReadonlyLayoutItem[]`   | 按 Layout 顺序返回所有碰撞项。   |
| `sortLayoutItemsByRowCol(layout)` | `readonly ReadonlyLayoutItem[]`   | 稳定地从上到下、从左到右排序。   |

查询函数会校验输入，但不会修改输入。

## 边界与旧版底层函数

```ts
function correctBounds(
  layout: ReadonlyLayout,
  bounds: Readonly<{ cols: number }>,
  allowOverlap?: boolean
): Layout

function compact(
  layout: ReadonlyLayout,
  verticalCompact?: boolean,
  minPositions?: CompactMinPositions
): Layout
```

`correctBounds` 把栅格项调整到配置的列边界内。`compact` 是标准压缩器使用的底层确定性垂直压缩函数。新集成通常应使用 `normalizeLayout` 或 `Compactor`。

`moveElement` 仍为兼容旧代码而导出，但已废弃。操作需要执行完整配置时使用 `useGridLayout`；只需要一次纯计算时使用 `normalizeLayout`。

## 压缩器

```ts
interface Compactor {
  readonly type?: 'vertical' | 'horizontal'
  compact(layout: ReadonlyLayout, cols: number): Layout
}
```

| 导出                      | 行为                                             |
| ------------------------- | ------------------------------------------------ |
| `verticalCompactor`       | 向上压缩，也是默认压缩器。                       |
| `horizontalCompactor`     | 向左压缩，行空间不足时换行。                     |
| `noCompactor`             | 校验后保留原有位置。                             |
| `fastVerticalCompactor`   | 输出与垂直压缩器相同，使用索引缩小碰撞候选范围。 |
| `fastHorizontalCompactor` | 输出与水平压缩器相同，使用索引缩小碰撞候选范围。 |

`withOverlap(compactor)` 已废弃，请改用 `collisionMode: 'overlap'`。扩展接口见[属性](./properties#compactor)。

## 定位策略

| 导出                    | 行为                                          |
| ----------------------- | --------------------------------------------- |
| `transformStrategy`     | 生成 CSS transform 定位样式，也是默认策略。   |
| `absoluteStrategy`      | 生成绝对定位的 `top` 和 `left`/`right` 样式。 |
| `scaledStrategy(scale)` | 使用 transform 样式，并修正指针缩放比例。     |

自定义策略必须实现 `PositionStrategy`。返回非法样式或抛出异常时，会报告扩展失败。

## 几何换算

```ts
interface GridGeometry {
  width: number
  cols: number
  rowHeight: number
  gap: readonly [number, number]
  containerPadding: readonly [number, number]
  rtl: boolean
  effectiveScale: number
}
```

| 函数                              | 换算                                   |
| --------------------------------- | -------------------------------------- |
| `calcGridCellDimensions(input)`   | 从容器宽度和间距计算单元格尺寸。       |
| `gridToPixelRect(item, geometry)` | 从栅格坐标计算逻辑像素矩形。           |
| `pointerToGridPosition(input)`    | 从视口指针和锚点计算未限制的栅格坐标。 |
| `pixelSizeToGridSize(input)`      | 从像素尺寸计算未限制的栅格尺寸。       |

几何函数使用逻辑 inline 坐标，支持 RTL 和缩放，会校验数值输入是否为有限数，并返回冻结的结果对象。完成指针或尺寸换算后，再应用业务需要的边界限制。

## 错误

输入无效时会抛出 `GridLayoutValidationError`。自定义压缩器或定位策略抛出异常、返回非法值时，会产生 `GridLayoutExtensionError`。字段说明见[操作契约](./contracts#错误)。
