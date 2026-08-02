---
'grid-layout-plus': major
---

Enforce strict layout contracts for safe-integer geometry, unique item ids, valid constraints, and
cloneable plain custom data. Layout algorithms no longer mutate their inputs, and invalid layouts
now produce structured `GridLayoutValidationError` or rejected operation results.
