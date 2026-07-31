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

### Breakpoint

```ts
type Breakpoint = 'xxs' | 'xs' | 'sm' | 'md' | 'lg'
```

### Breakpoints

```ts
type Breakpoints = Record<Breakpoint, number>
```

### ResponsiveLayout

```ts
type ResponsiveLayout = Record<Breakpoint, Layout>
```

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
interface GridConfig {
  colNum?: number
  rowHeight?: number
  maxRows?: number
  margin?: number[]
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
  margin: readonly [number, number]
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

- 类型：`Layout`
- 必填

栅格布局。数组中的每个栅格项都必须包含 `i`、`x`、`y`、`w` 和 `h`。其他栅格项属性见 [GridItem](#griditem)。

使用默认的 `collision-mode="push"` 时，Grid Layout Plus 会在首次渲染前校验并压缩布局。输入数组及其中的栅格项不会被直接修改，请使用 `v-model:layout` 接收规范化后的布局。

### responsive-layouts

- 类型：`Partial<ResponsiveLayout>`
- 默认值：`{}`

`responsive` 为 `true` 时，使用这里配置的各断点初始布局。对象键为断点名称，每个值都采用 `layout` 的数组格式，例如 `{ lg: [layout items], md: [layout items] }`。

`GridLayout` 创建后再修改该属性不会生效。

见 [responsive](#responsive)、[breakpoints](#breakpoints) 和 [cols](#cols)。

### col-num

- 类型：`number`
- 默认值：`12`

栅格列数，必须是正整数。

### row-height

- 类型：`number`
- 默认值：`150`

每行的像素高度。

### max-rows

- 类型：`number`
- 默认值：`Infinity`

栅格允许的最大行数。

### margin

- 类型：`number[]`
- 默认值：`[10, 10]`

栅格项之间的横向和纵向间距，单位为像素。必须传入两个数字：`[横向, 纵向]`。

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

- 类型：`Breakpoints`
- 默认值：`{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }`

响应式模式使用的宽度断点。

见 [responsiveLayouts](#responsive-layouts) 和 [cols](#cols)。

### cols

- 类型：`Breakpoints`
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
interface GridConfig {
  colNum?: number
  rowHeight?: number
  maxRows?: number
  margin?: number[]
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

### 层级方法

`GridLayout` 暴露 `bringToFront(id)` 和 `sendToBack(id)`。两个方法都会更新并归一化 `LayoutItem.zIndex`。层级发生变化时，它们会触发 `layout-updated` 并返回 `true`。

## GridItem

### i

- 类型：`number | string`
- 必填

栅格项的唯一标识。

### x

- 类型：`number`
- 必填

栅格项的起始列，必须是非负整数。

### y

- 类型：`number`
- 必填

栅格项的起始行，必须是非负整数。

### w

- 类型：`number`
- 必填

栅格项的初始宽度，单位为列，必须是正整数。

### h

- 类型：`number`
- 必填

栅格项的初始高度，单位为行，必须是正整数。

### min-w

- 类型：`number`
- 默认值：`1`

最小宽度，单位为列。`w` 小于该值时会被限制为 `min-w`。

### min-h

- 类型：`number`
- 默认值：`1`

最小高度，单位为行。`h` 小于该值时会被限制为 `min-h`。

### max-w

- 类型：`number`
- 默认值：`Infinity`

最大宽度，单位为列。`w` 大于该值时会被限制为 `max-w`。

### max-h

- 类型：`number`
- 默认值：`Infinity`

最大高度，单位为行。`h` 大于该值时会被限制为 `max-h`。

### is-draggable

- 类型：`boolean`
- 默认值：`null`

栅格项是否可以拖拽。`null` 表示继承 `GridLayout` 的配置。

### is-resizable

- 类型：`boolean`
- 默认值：`null`

栅格项是否可以缩放。`null` 表示继承 `GridLayout` 的配置。

### is-bounded

- 类型：`boolean`
- 默认值：`null`

在指针拖动期间，将栅格项的像素矩形限制在 `GridLayout` 根节点内。`null` 表示继承 `GridLayout` 的配置。该属性不限制缩放。

### static

- 类型：`boolean`
- 默认值：`false`

栅格项是否为静态项。静态项不能拖拽、缩放，也不会被其他栅格项推开。

### z-index

- 类型：`number`
- 默认值：`undefined`

用整数设置栅格项层级，数值越大越靠前。层级方法可能会归一化这些数值，但会保持相对顺序。

### drag-ignore-from

- 类型：`string`
- 默认值：`'a, button'`

指定不能开始拖拽的后代元素选择器。

详见 [interact.js 文档](http://interactjs.io/docs/#ignorable-selectors)中的 `ignoreFrom`。

### drag-allow-from

- 类型：`string`
- 默认值：`null`

指定可以开始拖拽的后代元素选择器。

如果为 `null`，任何后代元素都可以开始拖拽，但匹配 `drag-ignore-from` 的元素除外。

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

- 类型：`Record<string, any>`
- 默认值：`{}`

传递给 [interact.js 拖拽配置](https://interactjs.io/docs/draggable/) 的对象。

### resize-option

- 类型：`Record<string, any>`
- 默认值：`{}`

传递给 [interact.js 缩放配置](https://interactjs.io/docs/resizable/) 的对象。

### drag-threshold

- 类型：`number`
- 默认值：`null`

该栅格项开始拖拽前至少需要移动的像素距离。`null` 表示继承 `GridLayout` 的 [`drag-threshold`](#drag-threshold)。
