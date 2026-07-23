# Migration to v2

Version 2 removes the legacy boolean positioning and compaction props. The default behavior remains vertical compaction with CSS transforms, so projects that relied only on defaults do not need configuration changes.

## Removed props

| v1                            | v2 replacement                                     |
| ----------------------------- | -------------------------------------------------- |
| `:vertical-compact="true"`    | `:compactor="verticalCompactor"` (default)         |
| `:vertical-compact="false"`   | `:compactor="noCompactor"`                         |
| `:use-css-transforms="true"`  | `:position-strategy="transformStrategy"` (default) |
| `:use-css-transforms="false"` | `:position-strategy="absoluteStrategy"`            |
| `:transform-scale="scale"`    | `:position-strategy="scaledStrategy(scale)"`       |

`scaledStrategy(scale)` must match the CSS `transform: scale(...)` applied by an ancestor. It keeps layout styles in the normal coordinate system and corrects drag and resize pointer coordinates.

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

## Resize handles

The experimental `resizeHandles` prop and `ResizeHandle` type are not part of v2. GridItem supports the bottom-right (`se`) handle only. Remove `resize-handles` from GridLayout, GridItem, and `resizeConfig`.

## Grouped config precedence

Grouped objects are optional. When the same option is provided both as an individual prop and in a grouped object, the explicitly provided individual prop wins.
