---
aside: false
pageClass: demo-page
---

# Cross-grid Drag

Give grids the same `transfer-config.group` to move complete layout items between them. Both controlled Layout models must confirm before the move commits.

**Try it:** Drag a card from either grid into the other grid. Leaving the target or pressing Escape restores the source state.

<DemoFrame min-height="520px">
<ClientOnly>
  <DemoCrossGrid></DemoCrossGrid>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/cross-grid.vue

  </template>
  <template #source>

<<< @/demos/cross-grid.vue

  </template>
</DemoFrame>
