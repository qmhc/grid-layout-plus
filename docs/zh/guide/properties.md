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

可插拔的布局压缩算法接口。压缩器接收布局和列数，返回压缩后的新布局。

```ts
interface Compactor {
  readonly type?: 'vertical' | 'horizontal'
  compact(layout: Layout, cols: number): Layout
  /** @deprecated 请改用 GridLayout 的 collisionMode="overlap" */
  allowOverlap?: boolean
}
```

内置压缩器：

| 压缩器                    | 说明                                                       |
| ------------------------- | ---------------------------------------------------------- |
| `verticalCompactor`       | 向上压缩元素（默认，等价于 v1 的 `verticalCompact: true`） |
| `horizontalCompactor`     | 向左压缩元素，行空间不足时换到下一行                       |
| `noCompactor`             | 无压缩，自由定位                                           |
| `fastVerticalCompactor`   | 增量区间索引加速的垂直压缩，O(n log n)                     |
| `fastHorizontalCompactor` | 增量区间索引加速的水平压缩，O(n log n)                     |
| `withOverlap(compactor)`  | 旧版重叠 API 的废弃兼容包装器                              |

### PositionStrategy

可插拔的定位策略接口。控制栅格元素在 DOM 中的定位方式。

```ts
interface PositionStrategy {
  readonly transformScale?: number
  getStyle(top: number, left: number, width: number, height: number): Record<string, string>
  getRtlStyle(top: number, right: number, width: number, height: number): Record<string, string>
}
```

内置策略：

| 策略                    | 说明                                        |
| ----------------------- | ------------------------------------------- |
| `transformStrategy`     | 使用 CSS `translate3d` 定位（默认）         |
| `absoluteStrategy`      | 使用 CSS `top`/`left` 定位                  |
| `scaledStrategy(scale)` | 修正父容器 CSS `transform` 缩放后的指针坐标 |

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

### DropConfig

```ts
interface DropConfig {
  isDroppable?: boolean
  dropItem?: { w: number; h: number }
}
```

## GridLayout

### layout

- 类型：`Layout`
- 必须的

这是栅格的初始布局。

值必须是一个数组。每个元素都须包含 `i`、`x`、`y`、`w` 和 `h` 属性。更多信息请参考下面的 `GridItem` 文档。

### responsive-layouts

- 类型：`Partial<ResponsiveLayout>`
- 默认值：`{}`

如果 `responsive` 设置为 `true`，该配置将作为栅格中每个断点的初始布局。

对象的键值是断点的名称，每个值则对应 `layout` 属性所定义的数组，例如：`{ lg: [layout items], md: [layout items] }`。

注意，在创建栅格布局后再设置该属性是无效的。

见 [responsive](#responsive)、[breakpoints](#breakpoints) 和 [cols](#cols)。

### col-num

- 类型：`number`
- 默认值：`12`

定义栅格系统的列数，其值须为*自然数*。

### row-height

- 类型：`number`
- 默认值：`150`

每行的高度的像素值。

### max-rows

- 类型：`number`
- 默认值：`Infinity`

定义栅格的最大行数。

### margin

- 类型：`number[]`
- 默认值：`[10, 10]`

定义栅格中的元素外边距。

其值须为包含两个像素的数组。第一个值代表横向外边距，第二个值代表纵向外边距。

### is-draggable

- 类型：`boolean`
- 默认值：`true`

表示栅格中的元素是否可拖拽。

### is-resizable

- 类型：`boolean`
- 默认值：`true`

表示栅格中的元素是否可缩放。

### is-mirrored

- 类型：`boolean`
- 默认值：`false`

表示栅格中的元素是否可镜像反转。

### is-bounded

- 类型：`boolean`
- 默认值：`false`

表示栅格中的元素在拖拽时是否绑定在容器中。

### auto-size

- 类型：`boolean`
- 默认值：`true`

表示容器的高度是否自适应。

### restore-on-drag

- 类型：`boolean`
- 默认值：`false`

表示在某个元素被拖动后，是否应恢复被移动过的其他元素。

### prevent-collision

- 类型：`boolean`
- 默认值：`false`

已废弃，请改用 [`collision-mode="prevent"`](#collision-mode)。

### collision-mode

- 类型：`'push' | 'prevent' | 'overlap'`
- 默认值：`'push'`

控制拖动和缩放时的碰撞行为：

- `push`：推开碰撞元素，并执行配置的 compactor。
- `prevent`：保持其他元素不动，阻止当前元素占用已有空间。
- `overlap`：允许自由重叠，不移动其他元素，并暂停自动压缩。

显式传入的 `collision-mode` 优先于已废弃的 `prevent-collision` 和 `withOverlap()` API。从 `overlap` 切换到其他模式时，会执行一次当前 compactor 来消除重叠。

### bring-to-front-on-interact

- 类型：`boolean`
- 默认值：`true`

当 `collision-mode="overlap"` 时，在元素开始拖动或缩放时将其置顶。如果层级完全由外部管理，可以将其设为 `false`。

### responsive

- 类型：`boolean`
- 默认值：`false`

表示布局是否根据窗口宽度进行响应式变化。

见 [responsiveLayouts](#responsive-layouts)、[breakpoints](#breakpoints) 和 [cols](#cols)。

### breakpoints

- 类型：`Breakpoints`
- 默认值：`{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }`

为响应式布局设置断点。

见 [responsiveLayouts](#responsive-layouts) 和 [cols](#cols)。

### cols

- 类型：`Breakpoints`
- 默认值：`{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }`

设置每个断点对应的列数。

### use-style-cursor

- 类型：`boolean`
- 默认值：`true`

表示是否动态设置指针样式。当拖动出现卡顿时，将此值设为 `false` 也许可以缓解布局问题。

**该属性不是响应式的。**

### compactor

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

设置栅格元素的定位策略。从 `grid-layout-plus` 导入内置策略：

```ts
import { absoluteStrategy, scaledStrategy, transformStrategy } from 'grid-layout-plus'
```

当祖先元素使用相同的 CSS `transform: scale(...)` 渲染栅格时，使用 `scaledStrategy(scale)`。该策略不改变布局样式，而是把拖拽和缩放的指针坐标还原到未缩放的栅格坐标系。

### is-droppable

- 类型：`boolean`
- 默认值：`false`

启用从外部元素通过原生 HTML5 拖放到栅格中。需配合 [`drop-item`](#drop-item) 和 [拖放事件](./events#drop-drag-over) 使用。

### drop-item

- 类型：`{ w: number, h: number }`
- 默认值：`{ w: 1, h: 1 }`

设置从外部拖入栅格的元素的默认大小（栅格单位）。仅在 [`is-droppable`](#is-droppable) 为 `true` 时生效。

### drag-threshold

- 类型：`number`
- 默认值：`0`

设置指针在拖拽操作开始前必须移动的最小像素距离。用于防止意外拖拽。每个元素可以通过自身的 `drag-threshold` 属性覆盖此设置。

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
interface DropConfig {
  isDroppable?: boolean
  dropItem?: { w: number; h: number }
}
```

### 层级方法

`GridLayout` 暴露 `bringToFront(id)` 和 `sendToBack(id)`。两个方法都会更新并归一化 `LayoutItem.zIndex`，在层级发生变化时触发 `layout-updated`，并返回是否修改了元素。

## GridItem

### i

- 类型：`number | string`
- 必须的

栅格元素的唯一标识。

### x

- 类型：`number`
- 必须的

表示栅格元素的初始横向位置（应位于哪一列），其值须为*自然数*。

### y

- 类型：`number`
- 必须的

表示栅格元素的初始纵向位置（应位于哪一行），其值须为*自然数*。

### w

- 类型：`number`
- 必须的

表示栅格元素的初始宽度（应占多少列），其值须为*自然数*。

### h

- 类型：`number`
- 必须的

表示栅格元素的初始高度（应占多少行），其值须为*自然数*。

### min-w

- 类型：`number`
- 默认值：`1`

表示栅格元素的最小宽度。如果 `w` 小于 `min-w`，那 `w` 会被设置成 `min-w`。

### min-h

- 类型：`number`
- 默认值：`1`

表示栅格元素的最小高度。如果 `h` 小于 `min-h`，那 `h` 会被设置成 `min-h`。

### max-w

- 类型：`number`
- 默认值：`Infinity`

表示栅格元素的最大宽度。如果 `w` 大于 `max-w`，那 `w` 会被设置成 `max-w`。

### max-h

- 类型：`number`
- 默认值：`Infinity`

表示栅格元素的最大高度。如果 `h` 大于 `max-h`，那 `h` 会被设置成 `max-h`。

### is-draggable

- 类型：`boolean`
- 默认值：`null`

表示栅格元素是否可拖拽。如果为 `null` 则取决于父容器。

### is-resizable

- 类型：`boolean`
- 默认值：`null`

表示栅格元素是否可缩放。如果为 `null` 则取决于父容器。

### is-bounded

- 类型：`boolean`
- 默认值：`null`

表示栅格元素是否在拖拽时绑定容器。如果为 `null` 则取决于父容器。

### static

- 类型：`boolean`
- 默认值：`false`

表示栅格元素是否为静态的（无法拖拽、调整大小或被其他元素移动）。

### z-index

- 类型：`number`
- 默认值：`undefined`

以整数设置元素层级，数值越大越靠前。调用层级方法时可能会归一化这些数值，但会保持相对顺序。

### drag-ignore-from

- 类型：`string`
- 默认值：`'a, button'`

表示栅格元素中哪些子元素无法触发拖拽事件，值为 `css-like` 选择器。

更多信息请参考 [interact.js 文档](http://interactjs.io/docs/#ignorable-selectors) 的 `ignoreFrom`。

### drag-allow-from

- 类型：`string`
- 默认值：`null`

表示栅格元素中哪些子元素可以触发拖拽事件，值为 `css-like` 选择器。

如果为 `null`，则可以通过任意元素触发拖拽（除了 `drag-ignore-from`）。

更多信息请参考 [interact.js 文档](http://interactjs.io/docs/#ignorable-selectors) 的 `allowFrom`。

### resize-ignore-from

- 类型：`string`
- 默认值：`'a, button'`

表示栅格元素中哪些子元素无法触发缩放事件，值为 `css-like` 选择器。

更多信息请参考 [interact.js 文档](http://interactjs.io/docs/#ignorable-selectors) 的 `ignoreFrom`。

### preserve-aspect-ratio

- 类型：`boolean`
- 默认值：`false`

如果为 `true`，则强制栅格元素在缩放时保持其纵横比。

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

设置该元素的最小拖拽像素距离。如果为 `null`，则继承父容器 GridLayout 的 [`drag-threshold`](#drag-threshold) 属性。
