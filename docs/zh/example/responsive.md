---
aside: false
pageClass: demo-page
---

# 响应式

响应式模式根据容器宽度选择断点和列数。布局请使用 `ref` 定义，因为断点变化时，`v-model:layout` 会替换整个数组。

**试一试：** 调整页面宽度并跨过一个断点，再拖动栅格项。宽度、当前断点和列数会一起更新。

<DemoFrame min-height="680px">
<ClientOnly>
  <DemoResponsive></DemoResponsive>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/responsive.vue

  </template>
  <template #source>

<<< @/demos/responsive.vue

  </template>
</DemoFrame>
