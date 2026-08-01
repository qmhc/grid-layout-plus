---
aside: false
pageClass: demo-page
---

# Drag From Outside

Use `drop-config.onDragOver` when each external source needs its own item size or drop rule. The callback can resize or reject the candidate before it is placed in the grid.

**Try it:** Drag each source into the grid. They produce different candidate sizes, and the restricted source cannot be dropped.

<DemoFrame min-height="640px">
<ClientOnly>
  <DemoDragFromOutside></DemoDragFromOutside>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/drag-from-outside.vue

  </template>
  <template #source>

<<< @/demos/drag-from-outside.vue

  </template>
</DemoFrame>
