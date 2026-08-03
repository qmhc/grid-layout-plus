---
aside: false
pageClass: demo-page
---

# 多方向缩放

`resizeConfig.handles` 可以启用选定边或角的缩放手柄，`LayoutItem.resizeHandles` 则可以覆盖单个栅格项的方向。

**试一试：** 使用 Item `4` 的 north、northeast 和 northwest 手柄进行缩放。Item `0` 特意只显示 east、south 和 southeast。示例已关闭移动，因此所有可见手柄都只用于缩放。

<DemoFrame min-height="600px">
<ClientOnly>
  <DemoMultiDirectionResize></DemoMultiDirectionResize>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/multi-direction-resize.vue

  </template>
  <template #source>

<<< @/demos/multi-direction-resize.vue

  </template>
</DemoFrame>
