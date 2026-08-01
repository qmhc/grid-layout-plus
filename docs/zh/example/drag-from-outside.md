---
aside: false
pageClass: demo-page
---

# 从外部拖入

不同外部来源需要使用不同尺寸或放置规则时，可以设置 `drop-config.onDragOver`。回调可以在候选项放入栅格前调整尺寸，也可以直接拒绝放置。

**试一试：** 依次把三个来源拖入栅格。它们会显示不同的候选尺寸，受限来源无法放置。

<DemoFrame min-height="640px">
<ClientOnly>
  <DemoDragFromOutside></DemoDragFromOutside>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/drag-from-outside.vue

  </template>
  <template #source>

<<< @/demos/drag-from-outside.vue

  </template>
</DemoFrame>
