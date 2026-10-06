---
'grid-layout-plus': patch
---

Keep the previous style object when a GridItem's computed position style is unchanged, so moving one item no longer re-renders every item.
