---
title: Installation
description: Install Grid Layout Plus and import its components, composables, compactors, and position strategies.
---

# Installation

Most applications only need `GridLayout` and `GridItem` to get started. Import the other components and utilities only when you use them.

With `pnpm` (recommended):

```sh
pnpm i grid-layout-plus
```

With `yarn`:

```sh
yarn add grid-layout-plus
```

Grid Layout Plus publishes its component styles separately so your build tool can process them
with your own PostCSS, Lightning CSS, or browser targets. Import the stylesheet once from your
application entry:

```ts
import 'grid-layout-plus/style.css'
```

The JavaScript bundles do not inject styles at runtime.

## Import

Register the components globally:

```ts
import { GridLayout, GridItem } from 'grid-layout-plus'

app
  .component('GridLayout', GridLayout)
  .component('GridItem', GridItem)
```

Or import them in a component:

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

## Browser

Download the browser bundle from [Releases](https://github.com/qmhc/grid-layout-plus/releases), then include it with a script tag:

```html
<link rel="stylesheet" href="dist/style.css" />
<script src="dist/grid-layout-plus.js"></script>
```

## Additional Imports

Features outside the two core components are not registered automatically. Import the ones you use:

> **Note:** `GridBackground` is NOT included in the default registration. You must import it manually.

```ts
import {
  // Components
  GridBackground,

  // Compactors
  verticalCompactor,
  horizontalCompactor,
  noCompactor,

  // Position strategies
  transformStrategy,
  absoluteStrategy,
  scaledStrategy,

  // Composables
  useGridLayout,
  useContainerWidth,
  useResponsiveLayout,
} from 'grid-layout-plus'
```

## Next step

Read [Usage](./usage) for the layout data flow, or open [Basic Usage](../example/basic) to start from a working example.
