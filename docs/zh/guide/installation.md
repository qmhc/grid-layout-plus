# 安装

使用 `pnpm`（推荐）：

```sh
pnpm i grid-layout-plus
```

使用 `yarn`：

```sh
yarn add grid-layout-plus
```

## 引入

全局引入：

```ts
import { GridLayout, GridItem } from 'grid-layout-plus'

app
  .component('GridLayout', GridLayout)
  .component('GridItem', GridItem)
```

在组件内引入：

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

在你的页面添加可用于浏览器的软件包 (从 [发布](https://github.com/qmhc/grid-layout-plus/releases) 中下载)。

```html
<script src="dist/grid-layout-plus.js"></script>
```

## 额外引入

`GridLayout` 和 `GridItem` 是主要组件。其他功能需要显式引入。

> **注意：** `GridBackground` 不包含在默认注册中，必须手动引入。

```ts
import {
  // 组件
  GridBackground,

  // 压缩器
  verticalCompactor,
  horizontalCompactor,
  noCompactor,
  withOverlap,

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
