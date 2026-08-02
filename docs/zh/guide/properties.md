---
title: 属性
description: GridLayout、GridItem 和 GridBackground 的属性、布局类型、默认值与扩展接口参考。
---

# 属性

## 类型

### LayoutItemRequired

```ts
interface LayoutItemRequired {
  w: number,
  h: number,
  x: number,
  y: number,
  i: number | string
}
```

### LayoutItem

```ts
interface LayoutItem extends LayoutItemRequired {
  minW?: number,
  minH?: number,
  maxW?: number,
  maxH?: number,
  moved?: boolean,
  static?: boolean,
  isDraggable?: boolean,
  isResizable?: boolean,
  zIndex?: number
}
```

### Layout

```ts
type Layout = Array<LayoutItem>
```

### DefaultBreakpoint 与 Breakpoints

```ts
type DefaultBreakpoint = 'xxs' | 'xs' | 'sm' | 'md' | 'lg'
type Breakpoints<B extends string = DefaultBreakpoint> = Readonly<Record<B, number>>
```

`Breakpoint` 是 `DefaultBreakpoint` 的废弃别名。新代码可以使用默认断点名称，也可以把自定义字符串联合类型传给泛型参数 `B`。

### 响应式布局类型

```ts
type ResponsiveLayoutsInput<B extends string = DefaultBreakpoint> = Partial<
  Readonly<Record<B, ReadonlyLayout>>
>

type CompleteResponsiveLayouts<B extends string = DefaultBreakpoint> = Readonly<
  Record<B, ReadonlyLayout>
>

type ResponsiveValue<B extends string, T> = T | Readonly<Record<B, T>>
```

`ResponsiveLayoutsInput` 是 `GridLayout` 接受的、允许省略部分断点的输入映射；`CompleteResponsiveLayouts` 是归一化后发送的完整断点映射。`ResponsiveValue` 可以是单个值，也可以是完整断点映射。旧的 `ResponsiveLayout` 类型已废弃。

### CollisionMode

```ts
type CollisionMode = 'push' | 'prevent' | 'overlap'
```

### Compactor

压缩器接收布局和列数，返回一份填补空位后的新布局。

```ts
interface Compactor {
  readonly type?: 'vertical' | 'horizontal'
  compact(layout: ReadonlyLayout, cols: number): Layout
  /** @deprecated 请改用 GridLayout 的 collisionMode="overlap" */
  allowOverlap?: boolean
}
```

内置压缩器：

| 压缩器                    | 说明                                                         |
| ------------------------- | ------------------------------------------------------------ |
| `verticalCompactor`       | 向上压缩栅格项（默认，等价于 v1 的 `verticalCompact: true`） |
| `horizontalCompactor`     | 向左压缩栅格项，行空间不足时换到下一行                       |
| `noCompactor`             | 无压缩，自由定位                                             |
| `fastVerticalCompactor`   | 针对稀疏候选集优化的区间索引垂直压缩                         |
| `fastHorizontalCompactor` | 针对稀疏候选集优化的区间索引水平压缩                         |
| `withOverlap(compactor)`  | 旧版重叠 API 的废弃兼容包装器                                |

区间索引压缩器与对应的标准压缩器会返回相同的 Layout。碰撞查询开销取决于区间索引返回的候选项数量，因此不承诺无条件的 `O(n log n)` 上界。运行 `pnpm benchmark` 可以比较固定的稀疏、密集、大坐标、静态栅格项和不同候选数量数据集。benchmark 结果只用于测量性能，不作为单元测试阈值。

### PositionStrategy

定位策略负责把栅格几何转换成 DOM 样式。

```ts
type PositionStyle = Readonly<
  Partial<
    Record<
      'position' | 'top' | 'left' | 'right' | 'width' | 'height' | 'transform',
      string
    >
  >
>

interface PositionStrategy {
  readonly usesCssTransforms: boolean
  readonly transformScale?: number
  getStyle(top: number, left: number, width: number, height: number): PositionStyle
  getRtlStyle(top: number, right: number, width: number, height: number): PositionStyle
}
```

内置策略：

| 策略                    | 说明                                        |
| ----------------------- | ------------------------------------------- |
| `transformStrategy`     | 使用 CSS `translate3d` 定位（默认）         |
| `absoluteStrategy`      | 使用 CSS `top`/`left` 定位                  |
| `scaledStrategy(scale)` | 修正父容器 CSS `transform` 缩放后的指针坐标 |

`usesCssTransforms` 为必填字段。提供 `transformScale` 时，它必须是正有限数；拖拽、缩放和外部拖入都会用它换算指针坐标。

### GridConfig

```ts
interface GridConfig<B extends string = DefaultBreakpoint> {
  colNum?: number
  rowHeight?: number
  maxRows?: number
  gap?: ResponsiveValue<B, readonly [number, number]>
  containerPadding?: ResponsiveValue<B, readonly [number, number]>
  autoSize?: boolean
}
```

### DragConfig

```ts
interface DragConfig {
  isDraggable?: boolean
  dragThreshold?: number
  restoreOnDrag?: boolean
}
```

### ResizeConfig

```ts
interface ResizeConfig {
  isResizable?: boolean
}
```

### Drop 类型

```ts
type DropCandidate = Readonly<Omit<LayoutItem, 'i' | 'moved'>>

interface DropDragOverInput<B extends string = DefaultBreakpoint> {
  nativeEvent: DragEvent
  pointer: Readonly<{ clientX: number; clientY: number }>
  grid: Readonly<{ x: number; y: number }>
  candidate: DropCandidate
  layout: ReadonlyLayout
  breakpoint: B | null
  cols: number
}

interface DropDragOverContext<
  B extends string = DefaultBreakpoint,
> extends DropDragOverInput<B> {
  proposalId: number
  previewLayout: ReadonlyLayout
  insertionIndex: number
}

type DropEvaluationResult<B extends string = DefaultBreakpoint> =
  | {
      status: 'accepted'
      proposalId: number
      breakpoint: B | null
      candidate: DropCandidate
      previewLayout: ReadonlyLayout
      insertionIndex: number
      nativeEvent: DragEvent
    }
  | {
      status: 'rejected'
      reason:
        | 'callback-rejected'
        | 'invalid-input'
        | 'collision'
        | 'out-of-bounds'
        | 'max-rows'
        | 'no-position'
        | 'extension-error'
        | 'extension-invalid-result'
      nativeEvent: DragEvent
    }

interface DropConfig<B extends string = DefaultBreakpoint> {
  isDroppable?: boolean
  dropItem?: Readonly<{ w: number; h: number }>
  onDragOver?(
    context: Readonly<DropDragOverInput<B>>,
  ): false | Readonly<{ w?: number; h?: number }>
}
```

`candidate` 不包含业务 id。`previewLayout` 只保存现有栅格项归一化后的位置。

### 几何类型

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

interface PixelRect {
  top: number
  inlineStart: number
  width: number
  height: number
}

interface ReadonlyClientRect {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
  readonly width: number
  readonly height: number
}
```

无 DOM 依赖的 `gridToPixelRect`、`pointerToGridPosition` 和 `pixelSizeToGridSize` 同时从 `grid-layout-plus` 与 `grid-layout-plus/core` 导出。拖拽、缩放和外部拖入也使用同一套缩放与 RTL 几何换算。

## GridLayout

### layout

- 类型：`ReadonlyLayout`
- 必填

栅格布局。数组中的每个栅格项都必须包含 `i`、`x`、`y`、`w` 和 `h`。其他可选字段见 [`LayoutItem`](#layoutitem)。

使用默认的 `collision-mode="push"` 时，Grid Layout Plus 会在首次渲染前校验并压缩布局。输入数组及其中的栅格项不会被直接修改，请使用 `v-model:layout` 接收规范化后的布局。

### responsive-layouts

- 类型：`ResponsiveLayoutsInput<B>`
- 默认值：`{}`

`responsive` 为 `true` 时，使用这里配置的各断点布局。对象键为断点名称，每个值都采用 `layout` 的数组格式，例如 `{ lg: [layout items], md: [layout items] }`。

该属性是响应式的。受控响应式模式下，应同时绑定 `v-model:layout` 和 `v-model:responsive-layouts`；当前 Layout 与完整断点映射使用同一个 revision，必须在同一个 Vue 更新周期写回。

见 [responsive](#responsive)、[breakpoints](#breakpoints) 和 [cols](#cols)。

### col-num

- 类型：`number`
- 默认值：`12`

栅格列数，必须是正整数。

### row-height

- 类型：`number`
- 默认值：`150`

每行的像素高度。

`LayoutItem.h` 表示栅格项跨越的行数，不是像素值。实际渲染高度为
`h * rowHeight + (h - 1) * gap[1]`；跨越多行时，也会覆盖这些行之间的间距。

### max-rows

- 类型：`number`
- 默认值：`Infinity`

栅格允许的最大行数。

### gap

- 类型：`ResponsiveValue<B, readonly [number, number]>`
- 默认值：`[10, 10]`

栅格项之间的横向和纵向间距，单位为像素。必须传入两个数字：`[横向, 纵向]`。响应式模式下也可以传入完整的断点映射。

### container-padding

- 类型：`ResponsiveValue<B, readonly [number, number]>`
- 默认值：`[0, 0]`

布局容器内部的横向和纵向留白，单位为像素。可以传入 `[横向, 纵向]`；响应式模式下也可以传入完整的断点映射。

### width

- 类型：`number`
- 默认值：`undefined`

显式指定容器宽度，单位为像素，必须是非负有限数。未传入时，`GridLayout` 会使用 `ResizeObserver` 观测根节点。`0` 表示宽度已经解析，但当前没有可渲染的几何空间，并非尚未完成测量。

### is-draggable

- 类型：`boolean`
- 默认值：`true`

栅格项是否可以拖拽。

### is-resizable

- 类型：`boolean`
- 默认值：`true`

栅格项是否可以缩放。

### is-mirrored

- 类型：`boolean`
- 默认值：`false`

是否镜像栅格的水平方向。

### is-bounded

- 类型：`boolean`
- 默认值：`false`

在指针拖动期间，将栅格项的像素矩形限制在 `GridLayout` 根节点内。
该属性不限制缩放，也不替代布局、碰撞或 `maxRows` 规则。

### auto-size

- 类型：`boolean`
- 默认值：`true`

容器高度是否跟随布局内容变化。

### restore-on-drag

- 类型：`boolean`
- 默认值：`false`

默认情况下，占位符和发出的 Layout 会显示松开指针后将要提交的 Compactor 结果。设为 `true` 后，拖拽过程中会把当前栅格项保留在指针对应的候选位置；松开指针时，最后一次 Compactor 计算仍可能调整 Layout。

### prevent-collision

- 类型：`boolean`
- 默认值：`false`

已废弃，请改用 [`collision-mode="prevent"`](#collision-mode)。

### collision-mode

- 类型：`'push' | 'prevent' | 'overlap'`
- 默认值：`'push'`

控制拖动和缩放时的碰撞行为：

- `push`：推开发生碰撞的栅格项，并执行配置的 compactor。
- `prevent`：保持其他栅格项不动，阻止当前栅格项占用已有空间。
- `overlap`：允许自由重叠，不移动其他栅格项，并暂停自动压缩。

显式传入的 `collision-mode` 优先于已废弃的 `prevent-collision` 和 `withOverlap()` API。从 `overlap` 切换到其他模式时，会执行一次当前 compactor 来消除重叠。

### bring-to-front-on-interact

- 类型：`boolean`
- 默认值：`true`

`collision-mode="overlap"` 时，栅格项开始拖拽或缩放后会移到最上层。层级完全由外部管理时，可以设为 `false`。

### responsive

- 类型：`boolean`
- 默认值：`false`

布局是否根据容器宽度切换响应式配置。

见 [responsiveLayouts](#responsive-layouts)、[breakpoints](#breakpoints) 和 [cols](#cols)。

### breakpoints

- 类型：`Breakpoints<B>`
- 默认值：`{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }`

响应式模式使用的宽度断点。

见 [responsiveLayouts](#responsive-layouts) 和 [cols](#cols)。

### cols

- 类型：`Readonly<Record<B, number>>`
- 默认值：`{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }`

各断点对应的列数。

### use-style-cursor

- 类型：`boolean`
- 默认值：`true`

交互时是否动态更新指针样式。如果动态样式引起拖拽问题，可以设为 `false`。

**该属性不是响应式的。**

### compactor {#grid-layout-compactor}

- 类型：`Compactor`
- 默认值：`verticalCompactor`

设置布局的压缩算法。从 `grid-layout-plus` 导入内置压缩器：

```ts
import { horizontalCompactor, noCompactor, verticalCompactor } from 'grid-layout-plus'
```

`collision-mode="overlap"` 生效时会暂停 compactor。`withOverlap(compactor)` 为兼容旧代码而保留，但已废弃。

### position-strategy

- 类型：`PositionStrategy`
- 默认值：`transformStrategy`

设置栅格项的定位策略。从 `grid-layout-plus` 导入内置策略：

```ts
import { absoluteStrategy, scaledStrategy, transformStrategy } from 'grid-layout-plus'
```

祖先节点使用 CSS `transform: scale(...)` 缩放栅格时，请传入相同缩放值的 `scaledStrategy(scale)`。它不改变布局样式，只把拖拽、缩放和外部拖入的指针坐标还原到未缩放的栅格坐标系。

### is-droppable

- 类型：`boolean`
- 默认值：`false`

允许通过原生 HTML5 拖放将外部元素放入栅格。需配合 [`drop-item`](#drop-item) 和 [拖放事件](./events#drop-drag-over) 使用。

`GridLayout` 只负责计算和预览外部拖入，不创建业务 id、不插入候选项，也不发送 `update:layout`。`drop` 监听器需要插入已接受的候选项并写回 Layout。

### drop-item

- 类型：`{ w: number, h: number }`
- 默认值：`{ w: 1, h: 1 }`

外部拖入栅格项的默认尺寸，单位为栅格单元。仅在 [`is-droppable`](#is-droppable) 为 `true` 时生效。

### drag-threshold

- 类型：`number`
- 默认值：`0`

开始拖拽前，指针至少需要移动的像素距离。调大这个值可以减少误拖。每个栅格项都可以用自己的 `drag-threshold` 覆盖它。

### grid-config

- 类型：`GridConfig`
- 默认值：`undefined`

栅格相关属性的分组配置对象。显式传入的独立属性优先；未传入独立属性时才使用分组值。

```ts
interface GridConfig<B extends string = DefaultBreakpoint> {
  colNum?: number
  rowHeight?: number
  maxRows?: number
  gap?: ResponsiveValue<B, readonly [number, number]>
  containerPadding?: ResponsiveValue<B, readonly [number, number]>
  autoSize?: boolean
}
```

### drag-config

- 类型：`DragConfig`
- 默认值：`undefined`

拖拽相关属性的分组配置对象。显式传入的独立属性优先；未传入独立属性时才使用分组值。

```ts
interface DragConfig {
  isDraggable?: boolean
  dragThreshold?: number
  restoreOnDrag?: boolean
}
```

### resize-config

- 类型：`ResizeConfig`
- 默认值：`undefined`

缩放相关属性的分组配置对象。显式传入的 `is-resizable` 优先；未传入时才使用分组值。

```ts
interface ResizeConfig {
  isResizable?: boolean
}
```

### drop-config

- 类型：`DropConfig`
- 默认值：`undefined`

拖放相关属性的分组配置对象。显式传入的独立属性优先；未传入独立属性时才使用分组值。

```ts
interface DropConfig<B extends string = DefaultBreakpoint> {
  isDroppable?: boolean
  dropItem?: Readonly<{ w: number; h: number }>
  onDragOver?(
    context: Readonly<DropDragOverInput<B>>,
  ): false | Readonly<{ w?: number; h?: number }>
}
```

`onDragOver` 接收当前候选项和已提交的 Layout。返回 `false` 可以拒绝候选项；返回 `w` 和/或 `h` 可以修改尺寸。尺寸变化后，组件会围绕同一个指针重新计算候选位置，再检查碰撞和边界。

编程式布局操作和层级操作见[方法](./methods)。

## GridItem

`GridItem` 必须位于 `GridLayout` 内。它通过 `i` 属性关联对应的 `LayoutItem`；几何信息、约束、静态状态、单项拖拽和缩放开关以及层级顺序都由父级 Layout 维护。

### i

- 类型：`number | string`
- 必填

栅格项的唯一标识，必须与父级 Layout 中恰好一个 `LayoutItem.i` 匹配。

### is-bounded

- 类型：`boolean`
- 默认值：`undefined`

在指针拖动期间，将栅格项的像素矩形限制在 `GridLayout` 根节点内。未传入时继承 `GridLayout.isBounded`。该属性不限制缩放。

### drag-ignore-from

- 类型：`string`
- 默认值：`'a, button'`

指定不能开始拖拽的后代元素选择器。

详见 [interact.js 文档](http://interactjs.io/docs/#ignorable-selectors)中的 `ignoreFrom`。

### drag-allow-from

- 类型：`string`
- 默认值：`undefined`

指定可以开始拖拽的后代元素选择器。

未传入时，任何后代元素都可以开始拖拽，但匹配 `drag-ignore-from` 的元素除外。

详见 [interact.js 文档](http://interactjs.io/docs/#ignorable-selectors)中的 `allowFrom`。

### resize-ignore-from

- 类型：`string`
- 默认值：`'a, button'`

指定不能开始缩放的后代元素选择器。

详见 [interact.js 文档](http://interactjs.io/docs/#ignorable-selectors)中的 `ignoreFrom`。

### preserve-aspect-ratio

- 类型：`boolean`
- 默认值：`false`

栅格项在缩放时是否保持宽高比。

### drag-option

- 类型：`Readonly<Record<string, unknown>>`
- 默认值：`{}`

传递给 [interact.js 拖拽配置](https://interactjs.io/docs/draggable/) 的对象。

### resize-option

- 类型：`Readonly<Record<string, unknown>>`
- 默认值：`{}`

传递给 [interact.js 缩放配置](https://interactjs.io/docs/resizable/) 的对象。

### drag-threshold

- 类型：`number`
- 默认值：`undefined`

该栅格项开始拖拽前至少需要移动的像素距离。未传入时继承 `GridLayout` 的 [`drag-threshold`](#drag-threshold)。

### 废弃的兼容属性

`x`、`y`、`w`、`h`、`min-w`、`min-h`、`max-w`、`max-h`、`static`、`is-draggable`、`is-resizable` 和 `z-index` 仍作为可选 `GridItem` 属性保留，用于兼容 v1。在有效的 `GridLayout` 内，它们不会覆盖对应的 `LayoutItem`。新代码应把这些值写入父级 `layout`。

## GridBackground

`GridBackground` 在栅格项后方绘制栅格线。放在 `GridLayout` 内时，未显式传入的几何属性会继承父级配置。

| 属性                | 类型                        | 默认值                                   | 说明                     |
| ------------------- | --------------------------- | ---------------------------------------- | ------------------------ |
| `cols`              | `number`                    | 父级 `colNum`，否则为 `12`               | 栅格列数。               |
| `row-height`        | `number`                    | 父级 `rowHeight`，否则为 `150`           | 行高，单位为像素。       |
| `gap`               | `readonly [number, number]` | 父级 `gap`，否则为 `[10, 10]`            | 横向和纵向间距。         |
| `container-padding` | `readonly [number, number]` | 父级 `containerPadding`，否则为 `[0, 0]` | 绘制栅格外围的内部留白。 |
| `width`             | `number`                    | 父级宽度，否则为 `0`                     | 绘制宽度，单位为像素。   |
| `rows`              | `number`                    | 填满可用高度                             | 可选的绘制行数。         |
| `color`             | `string`                    | `rgba(0,0,0,0.1)`                        | 栅格线颜色。             |
| `stroke-width`      | `number`                    | `1`                                      | 非负线宽，单位为像素。   |

用法见[栅格背景示例](../example/grid-background)。

## 插槽

默认插槽用于手动渲染 `GridItem`。使用 `item` 插槽时，由 `GridLayout` 创建栅格项，并暴露以下数据：

```ts
interface GridLayoutSlotScope {
  item: ReadonlyLayoutItem
  index: number
  style: Readonly<Record<string, string>>
  isDragging: boolean
  isResizing: boolean
}
```

两种方式见[渲染栅格项](./usage#渲染栅格项)。
