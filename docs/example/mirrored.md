---
aside: false
pageClass: demo-page
---

# Mirrored Grid Layout

`is-mirrored` places the visual `x=0` origin on the right. Item coordinates stay logical and do not need to be reversed, which is useful for editors that use a right-side origin.

**Try it:** Turn Mirrored on, find `x=0`, and drag an item. Its `x` value still follows the same logical coordinate system.

<DemoFrame min-height="600px">
<ClientOnly>
  <DemoMirrored></DemoMirrored>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/mirrored.vue

  </template>
  <template #source>

<<< @/demos/mirrored.vue

  </template>
</DemoFrame>
