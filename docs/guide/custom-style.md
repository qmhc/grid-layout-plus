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

Keep the background geometry in sync with the `GridLayout` props. The names in `[]` below refer to those props:

- background size: `calc(calc(100% - [margin / 2]) / [col-num]) [row-height + margin]`
- height: `calc(100% - [margin / 2])`
- width: `calc(100% - [margin / 2])`
- margin: `[margin / 2]`

See [Styling Grid Lines](../example/styling-grid-lines) for a working version.
