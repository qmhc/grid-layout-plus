---
aside: false
pageClass: demo-page
---

# 无压缩

`noCompactor` 会保留布局中的空位，不会让附近的栅格项自动补上。使用它后，只有被拖拽或缩放的栅格项会改变坐标。

**试一试：** 把一个栅格项移到空白区域。其他栅格项保持原位，旧位置也不会被填补。

<DemoFrame>
<ClientOnly>
  <DemoNoCompact></DemoNoCompact>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/no-compact.vue

  </template>
  <template #source>

<<< @/demos/no-compact.vue

  </template>
</DemoFrame>
