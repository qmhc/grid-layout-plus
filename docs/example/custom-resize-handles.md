---
aside: false
pageClass: demo-page
---

# Custom Resize Handles

`resizeConfig.handles` and `LayoutItem.resizeHandles` remain the source of truth for enabled directions. The `resize-handle` slot replaces only the visual content of each enabled handle while Grid Layout Plus keeps ownership of positioning, pointer hit areas, cursors, and resize behavior.

The slot exposes the configured `axis` and the physical `direction` after RTL or mirrored rendering. Use `direction` when a custom icon must point toward the side where the handle is displayed.

**Try it:** Resize Item `0` from any arrow. Items `1` and `2` demonstrate per-item direction overrides with the same custom renderer.

<DemoFrame min-height="600px">
<ClientOnly>
  <DemoCustomResizeHandles></DemoCustomResizeHandles>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/custom-resize-handles.vue

  </template>
  <template #source>

<<< @/demos/custom-resize-handles.vue

  </template>
</DemoFrame>
