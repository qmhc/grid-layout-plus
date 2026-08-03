---
aside: false
pageClass: demo-page
---

# 内容驱动的栅格项高度

当栅格项内容可以展开或收起时，可以启用 `auto-height`。受控 Layout 仍然持有 `h`；
Grid Layout Plus 会测量内容并更新所需行数。

**试一试：** 展开或收起第一个栅格项的详情。它的 `h` 会随内容变化，下方栅格项也会移动到新的
可用行。关闭 `auto-height` 可以对比固定高度的表现。

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
