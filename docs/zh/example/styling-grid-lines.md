---
aside: false
pageClass: demo-page
---

# 定制栅格线

除了 `GridBackground`，还可以使用 CSS 背景绘制栅格线。背景需要采用与布局相同的列数、间距和行高。

**试一试：** 拖拽或缩放栅格项。栅格项的边缘和间距应始终与 CSS 栅格线对齐。

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
