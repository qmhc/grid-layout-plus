---
'grid-layout-plus': major
---

Replace legacy layout configuration with the v2 contracts. Rename `margin` to `gap`, note that
`containerPadding` now defaults to `[0, 0]`, and replace `verticalCompact`, `useCssTransforms`, and
`transformScale` with `compactor` and `positionStrategy`. Grouped grid, drag, resize, and drop
configuration now merges beneath flat props.
