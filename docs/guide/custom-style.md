# Custom Style

Grid style can be customized to fit your needs.

## Variables

```css
.vue-grid-layout {
  --vgl-placeholder-bg: red;
  --vgl-placeholder-opacity: 20%;
  --vgl-placeholder-z-index: 2;

  --vgl-item-resizing-z-index: 3;
  --vgl-item-resizing-opacity: 60%;
  --vgl-item-dragging-z-index: 3;
  --vgl-item-dragging-opacity: 100%;
}
```

## Placeholder

The default css for the placeholder is:

```css
.vue-grid-item.vue-grid-placeholder {
  z-index: var(--vgl-placeholder-z-index, 2);
  user-select: none;
  background-color: var(--vgl-placeholder-bg, red);
  opacity: var(--vgl-placeholder-opacity, 20%);
  transition-duration: 100ms;
}
```

You can override the background color via `--vgl-placeholder-bg` variable:

```css
.vue-grid-layout {
  --vgl-placeholder-bg: green;
}
```

In [this example](../example/styling-placeholder) we change the placeholder background color to green.

## Grid Lines

To create grid lines to the layout, add the below css for GridLayout:

```css
.vue-grid-layout::before {
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
