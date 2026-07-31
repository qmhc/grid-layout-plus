---
aside: false
pageClass: demo-page
---

# 基础用法

这个示例展示 `v-model:layout` 的基本数据流。布局数组提供每个栅格项的位置和尺寸，`GridLayout` 负责拖拽、缩放、静态项和占位符。

**试一试：** 拖拽或缩放一个带编号的栅格项。栅格项 2 不会移动；松开指针前，占位符会显示待提交的位置。

<DemoFrame min-height="780px">
<ClientOnly>
  <DemoBasic></DemoBasic>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/basic.vue

  </template>
  <template #source>

<<< @/demos/basic.vue

  </template>
</DemoFrame>
