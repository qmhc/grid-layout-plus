---
aside: false
pageClass: demo-page
---

# Predefined Responsive Layouts

`v-model:responsive-layouts` stores one layout per breakpoint. If a narrower breakpoint has no preset, Grid Layout Plus generates it from the nearest available layout and writes it back to the model.

**Try it:** Resize the page across the `lg`, `md`, and narrower breakpoints. The source label shows whether the current layout came from a preset or was generated.

<DemoFrame min-height="620px">
<ClientOnly>
  <DemoResponsiveLayouts></DemoResponsiveLayouts>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/responsive-layouts.vue

  </template>
  <template #source>

<<< @/demos/responsive-layouts.vue

  </template>
</DemoFrame>
