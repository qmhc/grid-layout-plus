---
aside: false
pageClass: demo-page
---

# Horizontal Compaction

The `compactor` decides which direction items move when the layout contains gaps. `horizontalCompactor` moves them toward earlier columns; `verticalCompactor` moves them toward earlier rows.

**Try it:** Switch the compaction direction, then drag an item away from its current position. The remaining items fill the gap along the selected axis.

<DemoFrame>
<ClientOnly>
  <DemoHorizontalCompact></DemoHorizontalCompact>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/horizontal-compact.vue

  </template>
  <template #source>

<<< @/demos/horizontal-compact.vue

  </template>
</DemoFrame>
