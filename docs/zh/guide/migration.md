# 迁移到 v2

v2 移除了旧的定位和压缩布尔属性。默认行为仍是垂直压缩配合 CSS transforms，因此只依赖默认值的项目无需修改配置。

## 已移除属性

| v1                            | v2 替代方式                                      |
| ----------------------------- | ------------------------------------------------ |
| `:vertical-compact="true"`    | `:compactor="verticalCompactor"`（默认）         |
| `:vertical-compact="false"`   | `:compactor="noCompactor"`                       |
| `:use-css-transforms="true"`  | `:position-strategy="transformStrategy"`（默认） |
| `:use-css-transforms="false"` | `:position-strategy="absoluteStrategy"`          |
| `:transform-scale="scale"`    | `:position-strategy="scaledStrategy(scale)"`     |

`scaledStrategy(scale)` 的参数必须与祖先元素设置的 CSS `transform: scale(...)` 一致。它不会放大布局样式，只负责把拖拽和缩放的指针坐标还原到正常坐标系。

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import { noCompactor, scaledStrategy } from 'grid-layout-plus'

const scale = 0.8
const layout = reactive([{ i: '0', x: 0, y: 0, w: 2, h: 2 }])
</script>

<template>
  <div :style="{ transform: `scale(${scale})`, transformOrigin: 'top left' }">
    <GridLayout
      v-model:layout="layout"
      :compactor="noCompactor"
      :position-strategy="scaledStrategy(scale)"
    />
  </div>
</template>
```

## 缩放手柄

实验性的 `resizeHandles` 属性和 `ResizeHandle` 类型不属于 v2。GridItem 仅支持右下角（`se`）缩放手柄，请从 GridLayout、GridItem 和 `resizeConfig` 中移除 `resize-handles`。

## 分组配置优先级

分组配置对象是可选的。同一个配置同时通过独立属性和分组对象传入时，显式传入的独立属性优先。
