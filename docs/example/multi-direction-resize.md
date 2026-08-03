---
aside: false
pageClass: demo-page
---

# Multi-direction Resize

`resizeConfig.handles` enables resizing from any selected edge or corner. `LayoutItem.resizeHandles` overrides those directions for one item.

**Try it:** Resize Item `4` from its north, northeast, and northwest handles. Item `0` intentionally exposes only east, south, and southeast. Moving is disabled so every visible handle belongs to resize.

<DemoFrame min-height="600px">
<ClientOnly>
  <DemoMultiDirectionResize></DemoMultiDirectionResize>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/multi-direction-resize.vue

  </template>
  <template #source>

<<< @/demos/multi-direction-resize.vue

  </template>
</DemoFrame>
