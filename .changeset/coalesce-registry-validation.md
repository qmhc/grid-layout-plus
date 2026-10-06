---
'grid-layout-plus': patch
---

Coalesce GridItem registry validation into one pass per flush and look up layout items by id, removing a cubic slowdown with many items.
