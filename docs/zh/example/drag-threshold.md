---
aside: false
pageClass: demo-page
---

# 拖拽阈值

`drag-threshold` 表示指针按下后至少移动多远才开始拖拽。栅格项内有可点击内容、容易误拖时，可以调大这个值。

**试一试：** 按住栅格项并小幅移动指针。只有超过所选阈值后，栅格项才会开始移动。

<DemoFrame>
<ClientOnly>
  <DemoDragThreshold></DemoDragThreshold>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/drag-threshold.vue

  </template>
  <template #source>

<<< @/demos/drag-threshold.vue

  </template>
</DemoFrame>
