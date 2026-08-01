---
aside: false
pageClass: demo-page
---

# 移动和缩放事件

移动和缩放在操作过程中和结束时都会发出对应事件。布局生命周期事件则覆盖挂载、就绪和布局更新。

**试一试：** 拖拽或缩放栅格项，对比实时事件和最后一条记录。下一次操作前可以先清空事件列表。

<DemoFrame min-height="720px">
<ClientOnly>
  <DemoEvents></DemoEvents>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/events.vue

  </template>
  <template #source>

<<< @/demos/events.vue

  </template>
</DemoFrame>
