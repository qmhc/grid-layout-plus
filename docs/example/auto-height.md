---
aside: false
pageClass: demo-page
---

# Content-driven Item Height

Use `auto-height` when an item's content can expand or collapse. The controlled Layout still owns
`h`; Grid Layout Plus measures the content and updates the required row count.

**Try it:** Show and hide the details in the first item. Its `h` value changes with the content, and
the item below moves to the next available row. Disable `auto-height` to compare the fixed behavior.

<DemoFrame min-height="520px">
<ClientOnly>
  <DemoAutoHeight></DemoAutoHeight>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/auto-height.vue

  </template>
  <template #source>

<<< @/demos/auto-height.vue

  </template>
</DemoFrame>
