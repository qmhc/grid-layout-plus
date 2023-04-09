# 用法

## 数据

首先，我们定义一个布局数据。它是一个数组，每个元素都应该要包含这些属性：`i`（id）、`x`、`y`、`w` 和 `h`。

```vue
<script setup lang="ts">
import { reactive } from 'vue'

const layout = reactive([
  { x: 0, y: 0, w: 2, h: 2, i: '0' },
  { x: 2, y: 0, w: 2, h: 4, i: '1' }
])
</script>
```

## 组件

接着，有两种方式可用于定义子元素：使用 `item` 插槽或使用 `default` 插槽。

使用 `item` 插槽是一种更容易定义子元素的方式，所有定义在布局元素的属性都将在内部自动传给 GridItem 组件。

```vue
<template>
  <!-- Item slot usage -->
  <GridLayout
    v-model:layout="layout"
    :col-num="12"
    :row-height="30"
    is-draggable
    is-resizable
    vertical-compact
    use-css-transforms
  >
    <template #item="{ item }">
      {{ item.i }}
    </template>
  </GridLayout>
</template>
```

如果你想要更灵活地监听 GridItem 组件的事件，你也可以选择使用 `default` 插槽。

```vue
<template>
  <!-- Default slot usage -->
  <GridLayout
    v-model:layout="layout"
    :col-num="12"
    :row-height="30"
    is-draggable
    is-resizable
    vertical-compact
    use-css-transforms
  >
    <GridItem
      v-for="item in layout"
      :key="item.i"
      :x="item.x"
      :y="item.y"
      :w="item.w"
      :h="item.h"
      :i="item.i"
      @resize="handleResize"
    >
      {{ item.i }}
    </GridItem>
  </GridLayout>
</template>
```
