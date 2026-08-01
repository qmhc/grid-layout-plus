---
aside: false
pageClass: demo-page
---

# No Compaction

`noCompactor` leaves gaps where they are instead of moving nearby items into them. An item's coordinates change only when that item is moved or resized.

**Try it:** Move an item into an empty area. The other items stay where they are, and the old gap remains open.

<DemoFrame>
<ClientOnly>
  <DemoNoCompact></DemoNoCompact>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/no-compact.vue

  </template>
  <template #source>

<<< @/demos/no-compact.vue

  </template>
</DemoFrame>
