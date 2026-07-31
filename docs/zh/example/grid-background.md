---
aside: false
pageClass: demo-page
---

# 栅格背景

`GridBackground` 读取父级栅格的几何信息，并在 `GridItem` 后方绘制对应的栅格线。线条颜色和宽度可以通过属性设置。

**试一试：** 修改线条颜色或宽度，再移动一个栅格项。背景会继续匹配当前列数、间距和行高。

<DemoFrame min-height="600px">
<ClientOnly>
  <DemoGridBackground></DemoGridBackground>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/grid-background.vue

  </template>
  <template #source>

<<< @/demos/grid-background.vue

  </template>
</DemoFrame>
