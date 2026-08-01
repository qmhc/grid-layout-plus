---
aside: false
pageClass: demo-page
---

# 水平压缩

布局中出现空位时，`compactor` 决定栅格项向哪个方向移动。`horizontalCompactor` 将栅格项移向列号更小的方向，`verticalCompactor` 则移向行号更小的方向。

**试一试：** 切换压缩方向，再把一个栅格项拖离原位。其余栅格项会沿所选方向填补空位。

<DemoFrame>
<ClientOnly>
  <DemoHorizontalCompact></DemoHorizontalCompact>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/horizontal-compact.vue

  </template>
  <template #source>

<<< @/demos/horizontal-compact.vue

  </template>
</DemoFrame>
