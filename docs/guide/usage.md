# Usage

Your application owns the layout array. `GridLayout` emits valid updates during an interaction, and the parent writes the accepted value back. You can then render items with the `item` slot or create each `GridItem` yourself.

## Layout data

A layout is an array of items. Each item needs `i` (id), `x`, `y`, `w`, and `h`.

```vue
<script setup lang="ts">
import { ref } from 'vue'

import type { Layout } from 'grid-layout-plus'

const layout = ref<Layout>([
  { x: 0, y: 0, w: 2, h: 2, i: '0' },
  { x: 2, y: 0, w: 2, h: 4, i: '1' }
])
</script>
```

`GridLayout` never mutates this array or its items. With `v-model:layout`, Vue replaces `layout.value` after each accepted update. If you pass only `:layout="layout"`, the component renders the layout but cannot save drag or resize changes.

If other code depends on the identity of a `reactive` array, listen for `update:layout` and replace the array contents:

```vue
<script setup lang="ts">
import { reactive } from 'vue'

import type { Layout, ReadonlyLayout } from 'grid-layout-plus'

const layout = reactive<Layout>([
  { x: 0, y: 0, w: 2, h: 2, i: '0' }
])

function confirmLayout(next: ReadonlyLayout) {
  layout.splice(0, layout.length, ...next)
}
</script>

<template>
  <GridLayout :layout="layout" @update:layout="confirmLayout" />
</template>
```

## Render items

You can render items with the `item` slot or the default slot.

With the `item` slot, `GridLayout` creates each `GridItem` and passes the matching layout data to the slot:

```vue
<template>
  <!-- Item slot usage -->
  <GridLayout
    v-model:layout="layout"
    :col-num="12"
    :row-height="30"
    is-draggable
    is-resizable
  >
    <template #item="{ item }">
      {{ item.i }}
    </template>
  </GridLayout>
</template>
```

Use the default slot when you need to set properties or listen to events on each `GridItem`:

```vue
<template>
  <!-- Default slot usage -->
  <GridLayout
    v-model:layout="layout"
    :col-num="12"
    :row-height="30"
    is-draggable
    is-resizable
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

## Compaction and Positioning

The `compactor` and `positionStrategy` props replace the removed `vertical-compact` and `use-css-transforms` props. Defaults still use vertical compaction and CSS transforms. See the [migration guide](./migration) when updating code that set either removed prop.

```vue
<template>
  <GridLayout
    v-model:layout="layout"
    :compactor="horizontalCompactor"
    :position-strategy="absoluteStrategy"
  >
    <template #item="{ item }">
      {{ item.i }}
    </template>
  </GridLayout>
</template>
```

[Properties](./properties#compactor) lists the built-in compactors and position strategies.

## Headless rendering

`useGridLayout` runs the same layout engine without rendering component DOM. Pass a writable Layout ref to save accepted operations back to that ref. With a plain Layout, the composable keeps its own state. This choice cannot change after the composable is created.

```ts
const grid = useGridLayout({
  layout,
  cols: 12,
  rowHeight: 30
})

const result = grid.moveItem('0', 1, 0)
if (result.status === 'rejected') {
  console.warn(result.reason)
}
```

See the [composable example](../example/composable-api) for custom DOM rendering.

## Next step

Browse the [examples](../example/) for a specific interaction. For exact inputs and callbacks, see [Properties](./properties) and [Events](./events).
