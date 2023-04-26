# 定制样式

栅格的样式可以根据你的需要进行定制。

::: tip 提示
栅格的类名是变化比较大的部分，`grid-layout-plus` 采用了 BEM 命名规范，相较原来类名变得更简短与扁平。
:::

## Variables

```css
.vgl-layout {
  --vgl-placeholder-bg: red;
  --vgl-placeholder-opacity: 20%;
  --vgl-placeholder-z-index: 2;

  --vgl-item-resizing-z-index: 3;
  --vgl-item-resizing-opacity: 60%;
  --vgl-item-dragging-z-index: 3;
  --vgl-item-dragging-opacity: 100%;

  --vgl-resizer-size: 10px;
  --vgl-resizer-border-color: #444;
  --vgl-resizer-border-width: 2px;
}
```

## 占位符

占位符的默认样式：

```css
.vgl-item--placeholder {
  z-index: var(--vgl-placeholder-z-index, 2);
  user-select: none;
  background-color: var(--vgl-placeholder-bg, red);
  opacity: var(--vgl-placeholder-opacity, 20%);
  transition-duration: 100ms;
}
```

你可以通过 `--vgl-placeholder-bg` 变量修改底色：

```css
.vgl-layout {
  --vgl-placeholder-bg: green;
}
```

在 [这个示例](../example/styling-placeholder) 我们修改占位符的底色为绿色。

## 栅格线

为 GridLayout 添加下面的样式以创建栅格线。

```css
.vgl-layout::before {
  position: absolute;
  width: calc(100% - 5px);
  height: calc(100% - 5px);
  margin: 5px;
  content: '';
  background-image:
    linear-gradient(to right,lightgrey 1px,transparent 1px),
    linear-gradient(to bottom, lightgrey 1px, transparent 1px);
  background-repeat: repeat;
  background-size: calc(calc(100% - 5px) / 12) 40px;
}
```

栅格线的 CSS 的计算（在 `[]` 里的名字为 GridLayout 的属性）：

- background size: `calc(calc(100% - [margin / 2]) / [col-num]) [row-height + margin]`
- height: `calc(100% - [margin / 2])`
- width: `calc(100% - [margin / 2])`
- margin: `[margin / 2]`

在 [这个示例](../example/styling-grid-lines) 我们为布局添加了栅格线。
