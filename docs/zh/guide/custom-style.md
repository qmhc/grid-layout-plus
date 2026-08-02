---
title: 定制样式
description: 使用 CSS 定制 Grid Layout Plus 的状态、占位符、缩放手柄和栅格线。
---

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
  inset: 0;
  content: '';
  background-image:
    linear-gradient(to right,lightgrey 1px,transparent 1px),
    linear-gradient(to bottom, lightgrey 1px, transparent 1px);
  background-repeat: repeat;
  background-position: -5px -5px;
  background-size: calc((100% + 10px) / 12) 40px;
}
```

背景尺寸需要与 `GridLayout` 属性保持一致：横向单元格宽度为
`(containerWidth - 2 * containerPadding[0] - (colNum - 1) * gap[0]) / colNum`，横向和纵向节距分别为
`cellWidth + gap[0]` 与 `rowHeight + gap[1]`。示例使用 12 列、`gap=[10, 10]` 和
`containerPadding=[0, 0]`。

[定制栅格线](../example/styling-grid-lines)中提供了完整写法。
