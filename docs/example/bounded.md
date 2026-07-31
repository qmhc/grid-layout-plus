---
aside: false
pageClass: demo-page
---

# Items Bounded to Container

`is-bounded` stops a dragged item at the grid boundary. It does not change resize limits, which still come from the item and grid settings.

**Try it:** Drag an item past the dashed edge with `is-bounded` on and off.

<DemoFrame min-height="620px">
<ClientOnly>
  <DemoBounded></DemoBounded>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/bounded.vue

  </template>
  <template #source>

<<< @/demos/bounded.vue

  </template>
</DemoFrame>
