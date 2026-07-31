---
aside: false
pageClass: demo-page
---

# 配置分组

`grid-config`、`drag-config`、`resize-config` 和 `drop-config` 把相关配置放在一起，同时保持响应式。配置较多时，分组会比一长串独立属性更容易读。

**试一试：** 每次修改一组配置，观察页面指标和交互结果如何变化。

<DemoFrame min-height="700px">
<ClientOnly>
  <DemoConfigGrouping></DemoConfigGrouping>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/config-grouping.vue

  </template>
  <template #source>

<<< @/demos/config-grouping.vue

  </template>
</DemoFrame>
