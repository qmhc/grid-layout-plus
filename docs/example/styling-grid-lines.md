---
aside: false
pageClass: demo-page
---

# Styling Grid Lines

You can draw grid lines with a CSS background instead of `GridBackground`. Use the same column count, gaps, and row height as the layout so the lines stay aligned.

**Try it:** Drag or resize an item. Its edges and gaps should continue to match the CSS grid lines.

<DemoFrame>
<ClientOnly>
  <DemoStylingGridLines></DemoStylingGridLines>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/styling-grid-lines.vue

  </template>
  <template #source>

<<< @/demos/styling-grid-lines.vue

  </template>
</DemoFrame>
