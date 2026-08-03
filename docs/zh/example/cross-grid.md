---
aside: false
pageClass: demo-page
---

# 跨网格拖拽

为多个栅格设置相同的 `transfer-config.group`，即可在它们之间移动完整的 LayoutItem。源、目标两个受控 Layout 都确认后，移动才会提交。

**试一试：** 将任意卡片拖到另一个栅格。离开目标或按 Escape 会恢复源状态。

<DemoFrame min-height="520px">
<ClientOnly>
  <DemoCrossGrid></DemoCrossGrid>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/cross-grid.vue

  </template>
  <template #source>

<<< @/demos/cross-grid.vue

  </template>
</DemoFrame>
