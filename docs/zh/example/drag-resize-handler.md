---
aside: false
pageClass: demo-page
---

# 移动手柄

`drag-allow-from` 指定可以开始指针移动的位置，`drag-ignore-from` 排除按钮、输入框等交互控件，避免它们触发移动。

**试一试：** 从蓝色标题手柄移动栅格项，再点击栅格项内的按钮。按钮应保持正常点击行为，不会带动栅格项移动。

<DemoFrame min-height="600px">
<ClientOnly>
  <DemoDragResizeHandler></DemoDragResizeHandler>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/drag-resize-handler.vue

  </template>
  <template #source>

<<< @/demos/drag-resize-handler.vue

  </template>
</DemoFrame>
