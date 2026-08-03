<script setup lang="ts">
import { reactive, ref } from 'vue'

import type { DragConfig, DropConfig, GridConfig, ResizeConfig } from 'grid-layout-plus'

const gridConfig = reactive<GridConfig>({
  colNum: 12,
  rowHeight: 30,
  gap: [10, 10],
})

const dragConfig = reactive<DragConfig>({
  isDraggable: true,
  dragThreshold: 0,
})

const resizeConfig = reactive<ResizeConfig>({
  isResizable: true,
})

let nextDropId = 1
const dropConfig = reactive<DropConfig>({
  isDroppable: false,
  createItem: () => ({ i: `drop-${nextDropId++}`, x: 0, y: 0, w: 1, h: 1 }),
})

const layout = ref([
  { x: 0, y: 0, w: 2, h: 2, i: '0' },
  { x: 2, y: 0, w: 2, h: 4, i: '1' },
  { x: 4, y: 0, w: 2, h: 3, i: '2' },
  { x: 6, y: 0, w: 2, h: 3, i: '3' },
  { x: 8, y: 0, w: 2, h: 3, i: '4' },
  { x: 10, y: 0, w: 2, h: 3, i: '5' },
])

function handleRowHeightChange(value: number) {
  if (!Number.isFinite(value)) {
    gridConfig.rowHeight = 30
  }
}

function handleDragThresholdChange(value: number) {
  if (!Number.isFinite(value)) {
    dragConfig.dragThreshold = 0
  }
}

function resetConfig() {
  Object.assign(gridConfig, {
    colNum: 12,
    rowHeight: 30,
    gap: [10, 10] as [number, number],
  })
  Object.assign(dragConfig, {
    isDraggable: true,
    dragThreshold: 0,
  })
  Object.assign(resizeConfig, {
    isResizable: true,
  })
  Object.assign(dropConfig, {
    isDroppable: false,
    createItem: () => ({ i: `drop-${nextDropId++}`, x: 0, y: 0, w: 1, h: 1 }),
  })
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <Tag class="demo-state demo-state--accent" type="primary" simple circle>
        Grouped configuration
      </Tag>
      <Button button-type="button" @click="resetConfig"> Reset config </Button>
    </div>
    <div class="config-groups">
      <fieldset class="config-group">
        <legend>Grid Config</legend>
        <div class="demo-control">
          <span>Row height</span>
          <NumberInput
            v-model:value="gridConfig.rowHeight"
            class="config-number"
            :min="10"
            :max="100"
            :control-attrs="{ 'aria-label': 'Grid row height in pixels' }"
            @change="handleRowHeightChange"
          ></NumberInput>
          <span>px</span>
        </div>
      </fieldset>
      <fieldset class="config-group">
        <legend>Drag Config</legend>
        <Checkbox v-model:checked="dragConfig.isDraggable"> Draggable </Checkbox>
        <div class="demo-control">
          <span>Threshold</span>
          <NumberInput
            v-model:value="dragConfig.dragThreshold"
            class="config-number"
            :min="0"
            :max="50"
            :control-attrs="{ 'aria-label': 'Drag threshold in pixels' }"
            @change="handleDragThresholdChange"
          ></NumberInput>
          <span>px</span>
        </div>
      </fieldset>
      <fieldset class="config-group">
        <legend>Resize Config</legend>
        <Checkbox v-model:checked="resizeConfig.isResizable"> Resizable </Checkbox>
      </fieldset>
      <fieldset class="config-group">
        <legend>Drop Config</legend>
        <Checkbox v-model:checked="dropConfig.isDroppable"> Droppable </Checkbox>
      </fieldset>
    </div>
    <dl class="demo-metrics">
      <div class="demo-metric">
        <dt>Row height</dt>
        <dd>{{ gridConfig.rowHeight }}px</dd>
      </div>
      <div class="demo-metric">
        <dt>Drag</dt>
        <dd>{{ dragConfig.isDraggable ? 'on' : 'off' }}</dd>
      </div>
      <div class="demo-metric">
        <dt>Threshold</dt>
        <dd>{{ dragConfig.dragThreshold }}px</dd>
      </div>
      <div class="demo-metric">
        <dt>Resize</dt>
        <dd>{{ resizeConfig.isResizable ? 'on' : 'off' }}</dd>
      </div>
      <div class="demo-metric">
        <dt>Drop target</dt>
        <dd>{{ dropConfig.isDroppable ? 'ready' : 'off' }}</dd>
      </div>
    </dl>
    <GridLayout
      v-model:layout="layout"
      class="demo-grid"
      :grid-config="gridConfig"
      :drag-config="dragConfig"
      :resize-config="resizeConfig"
      :drop-config="dropConfig"
    >
      <template #item="{ item }">
        <span class="demo-item__label">{{ item.i }}</span>
      </template>
    </GridLayout>
  </section>
</template>

<style scoped>
.config-groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 10px;
}

.config-group {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 10px;
  margin: 0;
  background: var(--demo-canvas);
  border: 1px solid var(--demo-border-subtle);
  border-radius: 8px;
}

.config-group legend {
  padding: 0 6px;
  font-weight: 700;
  color: var(--demo-text);
}

.config-group .demo-control {
  justify-content: space-between;
  min-width: 0;
}

.config-number {
  width: 76px;
}
</style>
