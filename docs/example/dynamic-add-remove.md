---
aside: false
pageClass: demo-page
---

# Adding and Removing Items

Add or remove entries from the layout array to change the grid at runtime. `GridLayout` updates the rendered items immediately, which works well for dashboards and editors with user-managed content.

**Try it:** Add a new item, select one to remove, and toggle dragging or resizing. The coordinate list updates with the layout.

<DemoFrame min-height="620px">
<ClientOnly>
  <DemoDynamicAddRemove></DemoDynamicAddRemove>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/dynamic-add-remove.vue

  </template>
  <template #source>

<<< @/demos/dynamic-add-remove.vue

  </template>
</DemoFrame>
