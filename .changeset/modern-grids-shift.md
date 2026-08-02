---
'grid-layout-plus': major
---

Adopt a controlled, immutable layout model. `GridLayout` now emits readonly update proposals and
commits them only after the parent writes `layout` back. Use `v-model:layout` to persist changes
from interactions and public commands.
