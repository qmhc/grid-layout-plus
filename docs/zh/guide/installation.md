---
title: 安装
description: 安装 Grid Layout Plus，并引入组件、组合式函数、压缩器和定位策略。
---

# 安装

大多数应用只需引入 `GridLayout` 和 `GridItem`。其他组件和工具可以在用到时单独引入。

使用 `pnpm`（推荐）：

```sh
pnpm i grid-layout-plus
```

使用 `yarn`：

```sh
yarn add grid-layout-plus
```

## 引入

全局注册：

```ts
import { GridLayout, GridItem } from 'grid-layout-plus'

app
  .component('GridLayout', GridLayout)
  .component('GridItem', GridItem)
```

也可以在组件中直接引入：

```vue
<script setup lang="ts">
import { GridLayout, GridItem } from 'grid-layout-plus'
</script>
```

```vue
<script lang="ts">
import { defineComponent } from 'vue'
import { GridLayout, GridItem } from 'grid-layout-plus'

export default defineComponent({
  components: {
    GridLayout,
    GridItem
  }
})
</script>
```

## 浏览器

从 [Releases](https://github.com/qmhc/grid-layout-plus/releases) 下载浏览器版本，再通过 script 标签引入：

```html
<script src="dist/grid-layout-plus.js"></script>
```

## 额外引入

除两个核心组件外，其余功能不会自动注册。用到哪些，就引入哪些：

> **注意：** `GridBackground` 不包含在默认注册中，必须手动引入。

```ts
import {
  // 组件
  GridBackground,

  // 压缩器
  verticalCompactor,
  horizontalCompactor,
  noCompactor,

  // 定位策略
  transformStrategy,
  absoluteStrategy,
  scaledStrategy,

  // 组合式 API
  useGridLayout,
  useContainerWidth,
  useResponsiveLayout,
} from 'grid-layout-plus'
```

## 下一步

接着阅读[用法](./usage)了解布局数据如何更新，或直接打开[基础用法](../example/basic)，从可运行的示例开始。
