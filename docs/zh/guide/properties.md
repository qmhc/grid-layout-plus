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
  isResizable?: boolean
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

对象的键值是断点的名称，每个值则对应 `layout` 属性所定义的数组，例如：`{ lg: [layout items], md: [layout items] }`.

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

### vertical-compact

- 类型：`boolean`
- 默认值：`true`

表示布局是否应该纵向压缩。

### restore-on-drag

- 类型：`boolean`
- 默认值：`false`

表示在某个元素被拖动后，是否应恢复被移动过的其他元素。

### prevent-collision

- 类型：`boolean`
- 默认值：`false`

表示是否防止元素碰撞，值为 `ture` 时，元素只能拖放至空白处。

### use-css-transforms

- 类型：`boolean`
- 默认值：`true`

表示是否使用 `transition-property: transform;` 的 CSS 属性。

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

### transform-scale

- 类型：`number`
- 默认值：`1`

为栅格元素的大小设置缩放比例，`1` 表示 100%。

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

表示栅格元素的最大宽度。如果 `w` 大于 `min-w`，那 `w` 会被设置成 `min-w`。

### max-h

- 类型：`number`
- 默认值：`Infinity`

表示栅格元素的最大高度。如果 `h` 大于 `min-h`，那 `h` 会被设置成 `min-h`。

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

传递给 [interact.js 缩放配置](https://interactjs.io/docs/draggable/) 的对象。
