---
aside: false
pageClass: demo-page
---

# 原生拖放

`is-droppable` 用于开启原生 HTML5 拖放，`drop-item` 设置默认候选尺寸。放置被接受后，`drop` 事件会返回候选项和预览布局，再由应用插入新的栅格项。

**试一试：** 把外部卡片拖入栅格，新增一个 2 × 2 栅格项。禁用目标后再试一次。

<DemoFrame min-height="620px">
<ClientOnly>
  <DemoNativeDrop></DemoNativeDrop>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/native-drop.vue

  </template>
  <template #source>

<<< @/demos/native-drop.vue

  </template>
</DemoFrame>
