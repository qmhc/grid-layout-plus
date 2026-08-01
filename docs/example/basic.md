---
aside: false
pageClass: demo-page
---

# Basic Usage

In the basic `v-model:layout` flow, the layout array supplies each item's position and size. `GridLayout` handles dragging, resizing, static items, and the placeholder.

**Try it:** Drag or resize a numbered item. Item 2 stays fixed, and the placeholder shows the pending position until you release the pointer.

<DemoFrame min-height="780px">
<ClientOnly>
  <DemoBasic></DemoBasic>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/basic.vue

  </template>
  <template #source>

<<< @/demos/basic.vue

  </template>
</DemoFrame>
