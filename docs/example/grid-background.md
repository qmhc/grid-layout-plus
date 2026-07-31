---
aside: false
pageClass: demo-page
---

# Grid Background

`GridBackground` reads the parent grid geometry and draws matching lines behind its `GridItem` children. Use its props to set the line color and width.

**Try it:** Change the line color or width, then move an item. The background follows the current columns, gaps, and row height.

<DemoFrame min-height="600px">
<ClientOnly>
  <DemoGridBackground></DemoGridBackground>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/grid-background.vue

  </template>
  <template #source>

<<< @/demos/grid-background.vue

  </template>
</DemoFrame>
