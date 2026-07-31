---
aside: false
pageClass: demo-page
---

# Drag Threshold

`drag-threshold` is the distance the pointer must move before dragging starts. Increase it when clickable content inside an item is too easy to drag by accident.

**Try it:** Press an item and move the pointer a short distance. Dragging starts only after you cross the selected threshold.

<DemoFrame>
<ClientOnly>
  <DemoDragThreshold></DemoDragThreshold>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/drag-threshold.vue

  </template>
  <template #source>

<<< @/demos/drag-threshold.vue

  </template>
</DemoFrame>
