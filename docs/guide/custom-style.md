# Custom Style

Grid style can be customized to fit your needs.

::: tip
The class names of components have changed a lot. `grid-layout-plus` adopts the BEM naming convention, which is shorter and flatter than the original class name.
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

## Placeholder

The default css for the placeholder is:

```css
.vgl-item--placeholder {
  z-index: var(--vgl-placeholder-z-index, 2);
  user-select: none;
  background-color: var(--vgl-placeholder-bg, red);
  opacity: var(--vgl-placeholder-opacity, 20%);
  transition-duration: 100ms;
}
```

You can override the background color via `--vgl-placeholder-bg` variable:

```css
.vgl-layout {
  --vgl-placeholder-bg: green;
}
```

In [this example](../example/styling-placeholder) we change the placeholder background color to green.

## Grid Lines

To create grid lines to the layout, add the below css for GridLayout:

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

CSS calculations for grid lines (names in `[]` are props of GridLayout):

- background size: `calc(calc(100% - [margin / 2]) / [col-num]) [row-height + margin]`
- height: `calc(100% - [margin / 2])`
- width: `calc(100% - [margin / 2])`
- margin: `[margin / 2]`

In [this example](../example/styling-grid-lines) we add grid lines to the layout.
