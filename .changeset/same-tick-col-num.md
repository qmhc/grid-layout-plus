---
'grid-layout-plus': patch
---

Validate a layout that changes in the same tick as `colNum` against the incoming column count
when `responsive` is disabled, avoiding transient `invalid-layout` and `invalid-registration`
errors.
