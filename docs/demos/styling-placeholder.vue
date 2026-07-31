<script setup lang="ts">
import { ref } from 'vue'

import type { InteractionStartPayload, InteractionTerminalPayload, Layout } from 'grid-layout-plus'

const defaultPlaceholderColor = '#2f7d4f'

function createLayout(): Layout {
  return [
    { x: 0, y: 0, w: 2, h: 2, i: '0' },
    { x: 2, y: 0, w: 2, h: 3, i: '1', static: true },
    { x: 4, y: 0, w: 2, h: 2, i: '2' },
    { x: 0, y: 3, w: 2, h: 2, i: '3' },
  ]
}

const layout = ref(createLayout())
const placeholderColor = ref(defaultPlaceholderColor)
const placeholderStatus = ref('Hidden · drag or resize an item')

function handleInteractionStart(payload: InteractionStartPayload) {
  const action = payload.type === 'drag' ? 'dragging' : 'resizing'
  placeholderStatus.value = `Visible · ${action} item ${payload.id}`
}

function handleInteractionEnd(payload: InteractionTerminalPayload) {
  placeholderStatus.value = `Hidden · ${payload.status} (${payload.reason})`
}

function resetDemo() {
  layout.value = createLayout()
  placeholderColor.value = defaultPlaceholderColor
  placeholderStatus.value = 'Reset · drag or resize to reveal'
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <div class="demo-control">
        <span>Placeholder color</span>
        <ColorPicker
          v-model:value="placeholderColor"
          format="hex"
          show-label
          aria-label="Placeholder color"
        ></ColorPicker>
      </div>
      <Tag class="demo-state demo-state--accent" type="primary" simple circle>
        {{ placeholderStatus }}
      </Tag>
      <Button button-type="button" @click="resetDemo"> Reset demo </Button>
    </div>
    <GridLayout
      v-model:layout="layout"
      class="demo-grid placeholder-grid"
      :col-num="6"
      :row-height="30"
      :style="{ '--vgl-placeholder-bg': placeholderColor }"
      @interaction-start="handleInteractionStart"
      @interaction-end="handleInteractionEnd"
    >
      <template #item="{ item }">
        <span class="demo-item__label">{{ `${item.i}${item.static ? ' · Static' : ''}` }}</span>
      </template>
    </GridLayout>
  </section>
</template>
