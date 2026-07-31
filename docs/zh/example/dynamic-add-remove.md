---
aside: false
pageClass: demo-page
---

# 动态增减栅格项

在布局数组中增加或删除数据，即可在运行时修改栅格。`GridLayout` 会立即更新页面，适合内容由用户管理的仪表盘和编辑器。

**试一试：** 新增栅格项、选中一项后删除，再切换拖拽或缩放。坐标列表会跟随布局更新。

<DemoFrame min-height="620px">
<ClientOnly>
  <DemoDynamicAddRemove></DemoDynamicAddRemove>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/dynamic-add-remove.vue

  </template>
  <template #source>

<<< @/demos/dynamic-add-remove.vue

  </template>
</DemoFrame>
