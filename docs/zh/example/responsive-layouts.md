---
aside: false
pageClass: demo-page
---

# 预设响应式布局

`v-model:responsive-layouts` 为每个断点保存一份布局。较窄的断点没有预设时，Grid Layout Plus 会根据最近的可用断点布局生成，并写回模型。

**试一试：** 调整页面宽度，依次经过 `lg`、`md` 和更窄的断点。来源标签会标明当前布局来自预设还是自动生成。

<DemoFrame min-height="620px">
<ClientOnly>
  <DemoResponsiveLayouts></DemoResponsiveLayouts>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/responsive-layouts.vue

  </template>
  <template #source>

<<< @/demos/responsive-layouts.vue

  </template>
</DemoFrame>
