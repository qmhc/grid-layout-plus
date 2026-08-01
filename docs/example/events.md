---
aside: false
pageClass: demo-page
---

# Move and Resize Events

Move and resize interactions emit events while they run and again when they finish. Layout lifecycle events cover mounting, readiness, and accepted layout updates.

**Try it:** Drag or resize an item and compare the live events with the final log entry. Select Clear events before the next run.

<DemoFrame min-height="720px">
<ClientOnly>
  <DemoEvents></DemoEvents>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/events.vue

  </template>
  <template #source>

<<< @/demos/events.vue

  </template>
</DemoFrame>
