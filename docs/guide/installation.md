# Installation

Using `pnpm` (Recommended):

```sh
pnpm i grid-layout-plus
```

Using `yarn`:

```sh
yarn add grid-layout-plus
```

## Import

Globally import:

```ts
import { GridLayout, GridItem } from 'grid-layout-plus'

app
  .component('GridLayout', GridLayout)
  .component('GridItem', GridItem)
```

Import in a component:

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

Include the browser-ready bundle (download from [releases](https://github.com/qmhc/grid-layout-plus/releases)) in your page.

```html
<script src="dist/grid-layout-plus.js"></script>
```
