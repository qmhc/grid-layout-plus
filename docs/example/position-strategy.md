---
aside: false
pageClass: demo-page
---

# Position Strategy

`position-strategy` converts logical grid coordinates into CSS positions. Changing the strategy does not change the layout data. Built-in options provide transform-based positioning, absolute positioning, and pointer-coordinate correction for scaled containers.

**Try it:** Switch strategies and move an item. The CSS position and visual scale may change, but the grid coordinates do not.

<DemoFrame min-height="640px">
<ClientOnly>
  <DemoPositionStrategy></DemoPositionStrategy>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/position-strategy.vue

  </template>
  <template #source>

<<< @/demos/position-strategy.vue

  </template>
</DemoFrame>
