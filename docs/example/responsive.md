---
aside: false
pageClass: demo-page
---

# Responsive

Responsive mode chooses the breakpoint and column count from the container width. Define the layout with `ref`, because `v-model:layout` replaces the array when the responsive layout changes.

**Try it:** Resize the page past a breakpoint, then drag an item. The width, active breakpoint, and column count update together.

<DemoFrame min-height="680px">
<ClientOnly>
  <DemoResponsive></DemoResponsive>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/responsive.vue

  </template>
  <template #source>

<<< @/demos/responsive.vue

  </template>
</DemoFrame>
