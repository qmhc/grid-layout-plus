---
title: Custom Styling
description: Customize Grid Layout Plus states, placeholders, resize handles, and grid lines with CSS.
---

# Custom Styling

Use CSS variables and component classes to style the grid.

::: tip
Current class names use BEM and differ from earlier releases. Check the migration guide before reusing selectors from an older project.
:::

## CSS variables

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

## Placeholder

The placeholder uses these styles by default:

```css
.vgl-item--placeholder {
  z-index: var(--vgl-placeholder-z-index, 2);
  user-select: none;
  background-color: var(--vgl-placeholder-bg, red);
  opacity: var(--vgl-placeholder-opacity, 20%);
  transition-duration: 100ms;
}
```

Set `--vgl-placeholder-bg` on `.vgl-layout` to change its background:

```css
.vgl-layout {
  --vgl-placeholder-bg: green;
}
```

The [placeholder example](../example/styling-placeholder) lets you try this variable.

## Grid Lines

You can also draw grid lines with a CSS background on `GridLayout`:

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

Keep the background geometry in sync with `GridLayout`: horizontal cell size is
`(containerWidth - 2 * containerPadding[0] - (colNum - 1) * gap[0]) / colNum`, while
the horizontal and vertical pitches are `cellWidth + gap[0]` and `rowHeight + gap[1]`.
The example uses 12 columns, `gap=[10, 10]`, and `containerPadding=[0, 0]`.

See [Styling Grid Lines](../example/styling-grid-lines) for a working version.
