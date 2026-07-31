---
aside: false
pageClass: demo-page
---

# Styling Placeholder

Set `--vgl-placeholder-bg` to change the placeholder color. The variable affects only the interaction feedback; item geometry and drag behavior stay the same.

**Try it:** Choose a color, then drag or resize an item. The placeholder uses the new color immediately.

<DemoFrame>
<ClientOnly>
  <DemoStylingPlaceholder></DemoStylingPlaceholder>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/styling-placeholder.vue

  </template>
  <template #source>

<<< @/demos/styling-placeholder.vue

  </template>
</DemoFrame>
