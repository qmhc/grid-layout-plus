---
aside: false
pageClass: demo-page
---

# Config Grouping

`grid-config`, `drag-config`, `resize-config`, and `drop-config` collect related options without losing reactivity. For layouts with many settings, these groups are easier to read than a long list of individual props.

**Try it:** Change one group at a time and watch which metrics and interactions respond.

<DemoFrame min-height="700px">
<ClientOnly>
  <DemoConfigGrouping></DemoConfigGrouping>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/config-grouping.vue

  </template>
  <template #source>

<<< @/demos/config-grouping.vue

  </template>
</DemoFrame>
