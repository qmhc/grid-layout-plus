---
aside: false
pageClass: demo-page
---

# 定制占位符

设置 `--vgl-placeholder-bg` 即可修改占位符颜色。这个变量只影响交互反馈，不会改变栅格项尺寸或拖拽行为。

**试一试：** 选择一个颜色，再拖拽或缩放栅格项。占位符会立即使用新颜色。

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
