---
aside: false
pageClass: demo-page
---

# Composable API

`useGridLayout` exposes the layout state and operations without rendering `GridLayout` or `GridItem`. It is useful when you want to keep the placement rules but render your own markup.

**Try it:** Add, move, and remove items. The custom rendering reads every change from the headless layout state.

<DemoFrame min-height="600px">
<ClientOnly>
  <DemoComposableApi></DemoComposableApi>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/composable-api.vue

  </template>
  <template #source>

<<< @/demos/composable-api.vue

  </template>
</DemoFrame>
