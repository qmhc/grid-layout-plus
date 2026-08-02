---
'grid-layout-plus': major
---

Make the parent `Layout` the canonical source of `GridItem` geometry, constraints, interaction
flags, and stacking order. The corresponding `GridItem` mirror props are deprecated, and internal
component-ref fields have been replaced by the typed `GridLayoutExpose` command API.
