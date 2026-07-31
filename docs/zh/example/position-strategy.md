---
aside: false
pageClass: demo-page
---

# 定位策略

`position-strategy` 把逻辑栅格坐标转换为 CSS 位置。切换策略不会修改布局数据。内置选项支持 transform 定位、绝对定位，并可修正缩放容器中的指针坐标。

**试一试：** 切换策略并移动一个栅格项。CSS 位置和视觉缩放可能变化，栅格坐标不会变。

<DemoFrame min-height="640px">
<ClientOnly>
  <DemoPositionStrategy></DemoPositionStrategy>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/position-strategy.vue

  </template>
  <template #source>

<<< @/demos/position-strategy.vue

  </template>
</DemoFrame>
