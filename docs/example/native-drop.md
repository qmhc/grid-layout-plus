---
aside: false
pageClass: demo-page
---

# Native Drag & Drop

`is-droppable` enables native HTML5 drag and drop, and `drop-item` sets the default candidate size. When a drop is accepted, the `drop` event returns the candidate and preview layout; the application then inserts the new item.

**Try it:** Drag the source into the grid to add a 2 × 2 item. Disable the target and try again.

<DemoFrame min-height="620px">
<ClientOnly>
  <DemoNativeDrop></DemoNativeDrop>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/native-drop.vue

  </template>
  <template #source>

<<< @/demos/native-drop.vue

  </template>
</DemoFrame>
