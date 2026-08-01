---
aside: false
pageClass: demo-page
---

# 拖拽和缩放手柄

`drag-allow-from` 指定可以开始拖拽的位置，`drag-ignore-from` 排除按钮、输入框等控件。栅格项同时包含专用手柄和其他交互内容时，可以组合使用这两个属性。

**试一试：** 从蓝色手柄拖拽，点击按钮，再使用角落手柄缩放。按钮点击、拖拽和缩放互不干扰。

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
