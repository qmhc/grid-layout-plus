---
aside: false
pageClass: demo-page
---

# 允许重叠

设置 `collision-mode="overlap"` 后，多个栅格项可以占用同一组单元格。层级决定谁显示在上方；拖拽或缩放时，当前操作的栅格项会移到最上层。

**试一试：** 叠放两个栅格项并调整层级。关闭“允许重叠”后，再尝试把两个栅格项拖到一起。

<DemoFrame min-height="600px">
<ClientOnly>
  <DemoAllowOverlap></DemoAllowOverlap>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/allow-overlap.vue

  </template>
  <template #source>

<<< @/demos/allow-overlap.vue

  </template>
</DemoFrame>
