---
aside: false
pageClass: demo-page
---

# 自定义缩放手柄

`resizeConfig.handles` 和 `LayoutItem.resizeHandles` 仍是启用方向的唯一来源。`resize-handle` 插槽只替换每个已启用手柄的视觉内容，定位、指针命中区域、光标和缩放行为继续由 Grid Layout Plus 管理。

插槽会提供配置轴 `axis`，以及经过 RTL 或镜像渲染后的物理方向 `direction`。自定义图标需要指向实际显示侧时，应使用 `direction`。

**试一试：** 从 Item `0` 的任意箭头进行缩放。Item `1` 和 Item `2` 使用同一套自定义渲染，但分别覆盖了可用方向。

<DemoFrame min-height="600px">
<ClientOnly>
  <DemoCustomResizeHandles></DemoCustomResizeHandles>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/custom-resize-handles.vue

  </template>
  <template #source>

<<< @/demos/custom-resize-handles.vue

  </template>
</DemoFrame>
