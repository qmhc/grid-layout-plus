---
aside: false
pageClass: demo-page
---

# 阻止碰撞

设置 `collision-mode="prevent"` 后，只要移动或缩放结果会与其他栅格项重叠，操作就会停止。固定障碍物和周围栅格项都不能移动时，可以再配合 `noCompactor`。

**试一试：** 把可移动栅格项拖向栅格项 1，或向它的方向缩放。发生重叠前，操作会被拒绝。

<DemoFrame>
<ClientOnly>
  <DemoPreventCollision></DemoPreventCollision>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/prevent-collision.vue

  </template>
  <template #source>

<<< @/demos/prevent-collision.vue

  </template>
</DemoFrame>
