# Usage

## Data

First, we define a layout data. It's an array, each item should include `i` (id), `x`, `y`, `w` and `h` properties.

```vue
<script setup lang="ts">
import { reactive } from 'vue'

const layout = reactive([
  { x: 0, y: 0, w: 2, h: 2, i: '0' },
  { x: 2, y: 0, w: 2, h: 4, i: '1' }
])
</script>
```

## Component

And there are two ways to define items, using `item` slot or `default` slot.

Using `item` slot is an easier way to define elements of each item, the properties of layout items definition will auto be passed for GridItem component inernally.

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

If you want a more flexible way to listen events of GridItem component, you also can chose the `default` slot.

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

In v2, the `vertical-compact` and `use-css-transforms` boolean props have been replaced by pluggable `compactor` and `positionStrategy` props. The defaults remain the same — vertical compaction with CSS transforms — so existing code works without changes.

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

See [Properties](./properties#compactor) for all available compactors and strategies.
