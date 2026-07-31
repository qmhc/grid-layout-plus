# 定制样式

使用 CSS 变量和组件类名可以调整栅格样式。

::: tip 提示
当前类名使用 BEM，与早期版本不同。旧项目沿用选择器前，请先查看迁移指南。
:::

## CSS 变量

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

在 `.vgl-layout` 上设置 `--vgl-placeholder-bg` 即可修改占位符底色：

```css
.vgl-layout {
  --vgl-placeholder-bg: green;
}
```

[定制占位符](../example/styling-placeholder)示例中可以直接调整这个变量。

## 栅格线

也可以在 `GridLayout` 上添加 CSS 背景来绘制栅格线：

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

背景尺寸需要与 `GridLayout` 属性保持一致。下面 `[]` 中的名称均指对应属性：

- background size: `calc(calc(100% - [margin / 2]) / [col-num]) [row-height + margin]`
- height: `calc(100% - [margin / 2])`
- width: `calc(100% - [margin / 2])`
- margin: `[margin / 2]`

[定制栅格线](../example/styling-grid-lines)中提供了完整写法。
