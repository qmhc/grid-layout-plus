---
aside: false
pageClass: demo-page
---

# 镜像栅格布局

`is-mirrored` 会把视觉上的 `x=0` 原点放到右侧，但栅格项的逻辑坐标不需要反转。它适合以右侧为原点的编辑器。

**试一试：** 开启镜像模式，找到 `x=0`，再拖动一个栅格项。它的 `x` 值仍使用同一套逻辑坐标。

<DemoFrame min-height="600px">
<ClientOnly>
  <DemoMirrored></DemoMirrored>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/mirrored.vue

  </template>
  <template #source>

<<< @/demos/mirrored.vue

  </template>
</DemoFrame>
