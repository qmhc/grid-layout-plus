---
aside: false
pageClass: demo-page
---

# Move Handles

`drag-allow-from` defines where a pointer move may start. `drag-ignore-from` excludes interactive controls such as buttons and inputs from starting that move.

**Try it:** Move an item from its blue labeled handle, then click the button inside the item. The button should keep its normal click behavior without moving the item.

<DemoFrame min-height="600px">
<ClientOnly>
  <DemoDragResizeHandler></DemoDragResizeHandler>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/drag-resize-handler.vue

  </template>
  <template #source>

<<< @/demos/drag-resize-handler.vue

  </template>
</DemoFrame>
