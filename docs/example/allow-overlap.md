---
aside: false
pageClass: demo-page
---

# Allow Overlap

Set `collision-mode="overlap"` to let items share the same cells. Layer order decides which one stays on top, and the active item moves to the front while you drag or resize it.

**Try it:** Stack two items, change their layer order, then turn overlap off and drag them together again.

<DemoFrame min-height="600px">
<ClientOnly>
  <DemoAllowOverlap></DemoAllowOverlap>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/allow-overlap.vue

  </template>
  <template #source>

<<< @/demos/allow-overlap.vue

  </template>
</DemoFrame>
