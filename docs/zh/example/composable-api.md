---
aside: false
pageClass: demo-page
---

# 组合式 API

`useGridLayout` 只提供布局状态和操作，不渲染 `GridLayout` 或 `GridItem`。需要复用定位规则、但想自行编写页面结构时，可以使用它。

**试一试：** 添加、移动和删除栅格项。每次布局变化都会反映到自定义界面中。

<DemoFrame min-height="600px">
<ClientOnly>
  <DemoComposableApi></DemoComposableApi>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/composable-api.vue

  </template>
  <template #source>

<<< @/demos/composable-api.vue

  </template>
</DemoFrame>
