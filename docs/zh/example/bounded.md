---
aside: false
pageClass: demo-page
---

# 栅格项限制在容器内

`is-bounded` 会让拖拽中的栅格项停在容器边界。它不影响缩放限制，缩放范围仍由栅格项和栅格配置决定。

**试一试：** 分别在开启和关闭 `is-bounded` 时，把栅格项拖过虚线边界。

<DemoFrame min-height="620px">
<ClientOnly>
  <DemoBounded></DemoBounded>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/bounded.vue

  </template>
  <template #source>

<<< @/demos/bounded.vue

  </template>
</DemoFrame>
