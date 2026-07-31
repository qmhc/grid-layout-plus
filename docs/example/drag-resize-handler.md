---
aside: false
pageClass: demo-page
---

# Drag and Resize Handles

`drag-allow-from` defines where dragging may start. `drag-ignore-from` excludes controls such as buttons and inputs. You can combine them when an item has a dedicated handle and other interactive content.

**Try it:** Drag from the blue handle, click the button, then resize from the corner. Each control should perform only its own action.

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
