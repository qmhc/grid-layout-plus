<script setup lang="ts">
import { nextTick, reactive, ref } from 'vue'

import { AutoHeightItem, GridLayout } from '../../src'

const layout = reactive([
  { x: 0, y: 0, w: 2, h: 2, i: '0', static: false, content: 'Basic Content', isDraggable: false },
  {
    x: 2,
    y: 0,
    w: 2,
    h: 4,
    i: '1',
    static: true,
    content: 'Static Content<br>Cannot Move<br>or Resize'
  },
  { x: 4, y: 0, w: 2, h: 5, i: '2', static: false, content: 'Long Content<br>'.repeat(4) },
  {
    x: 6,
    y: 0,
    w: 2,
    h: 3,
    i: '3',
    static: false,
    content: 'Medium Length Content<br>Second Line'
  },
  { x: 8, y: 0, w: 2, h: 3, i: '4', static: false, content: 'Short Content' },
  { x: 10, y: 0, w: 2, h: 3, i: '5', static: false, content: 'Short Content<br>With Line Break' },
  { x: 0, y: 5, w: 2, h: 5, i: '6', static: false, content: 'Long Content<br>'.repeat(3) },
  { x: 2, y: 5, w: 2, h: 5, i: '7', static: false, content: 'Content<br>'.repeat(2) },
  { x: 4, y: 5, w: 2, h: 5, i: '8', static: false, content: 'Content Example' },
  { x: 6, y: 3, w: 2, h: 4, i: '9', static: true, content: 'Static Item<br>Cannot Move' },
  { x: 8, y: 4, w: 2, h: 4, i: '10', static: false, content: 'Normal Content' },
  { x: 10, y: 4, w: 2, h: 4, i: '11', static: false, content: 'Can<br>Auto Adjust<br>Height' },
  { x: 0, y: 10, w: 2, h: 5, i: '12', static: false, content: 'Content Example' },
  {
    x: 2,
    y: 10,
    w: 2,
    h: 5,
    i: '13',
    static: false,
    content: 'Content<br>Adjusts<br>Based on<br>Actual Height'
  },
  { x: 4, y: 8, w: 2, h: 4, i: '14', static: false, content: 'Content Example' },
  { x: 6, y: 8, w: 2, h: 4, i: '15', static: false, content: 'Content Example<br>Multiple Lines' },
  { x: 8, y: 10, w: 2, h: 5, i: '16', static: false, content: 'Content Example' },
  { x: 10, y: 4, w: 2, h: 2, i: '17', static: false, content: 'Short Content' },
  { x: 0, y: 9, w: 2, h: 3, i: '18', static: false, content: 'Auto Height Content' },
  { x: 2, y: 6, w: 2, h: 2, i: '19', static: false, content: 'Test' }
])
const gridRef = ref<InstanceType<typeof GridLayout> | null>(null)

// Add content to specified item
function addContentToItem(id: string) {
  const item = layout.find(item => item.i === id)
  if (item) {
    item.content += '<br>New Content Line'
  }
}

// Remove content from specified item
function reduceContentFromItem(id: string) {
  const item = layout.find(item => item.i === id)
  if (item) {
    const lines = item.content.split('<br>')
    if (lines.length > 1) {
      lines.pop()
      item.content = lines.join('<br>')
    }
  }
}

// Handle height update
async function updateItemHeight(id: string, newHeight: number) {
  const item = layout.find(item => item.i === id)
  if (item && item.h !== newHeight) {
    requestAnimationFrame(async () => {
      // Update height
      item.h = newHeight

      // Wait for DOM update
      await nextTick()

      // Create new layout array to trigger recalculation
      const newLayout = JSON.parse(JSON.stringify(layout))
      layout.splice(0, layout.length, ...newLayout)
      gridRef.value && gridRef.value.layoutUpdate()
    })
  }
}
</script>

<template>
  <div>
    <div class="controls">
      <button @click="addContentToItem('2')">
        Add Content to Item 2
      </button>
      <button @click="reduceContentFromItem('2')">
        Remove Content from Item 2
      </button>
    </div>

    <GridLayout
      ref="gridRef"
      v-model:layout="layout"
      :row-height="30"
      vertical-compact
    >
      <AutoHeightItem
        v-for="item in layout"
        :key="item.i"
        v-bind="item"
        :row-height="30"
        @update:h="updateItemHeight(item.i, $event)"
      >
        <div class="content">
          <div class="text">
            {{ `${item.i}${item.static ? '- Static' : ''}` }}
          </div>
          <div class="dynamic-content" v-html="item.content"></div>
        </div>
      </AutoHeightItem>
    </GridLayout>
  </div>
</template>

<style scoped>
.controls {
  margin-bottom: 20px;
}

.controls button {
  padding: 5px 10px;
  margin-right: 10px;
  color: white;
  cursor: pointer;
  background-color: #4caf50;
  border: 0;
  border-radius: 4px;
}

.controls button:hover {
  background-color: #45a049;
}

.vgl-layout {
  background-color: #eee;
}

:deep(.vgl-item:not(.vgl-item--placeholder)) {
  background-color: #ccc;
  border: 1px solid black;
}

:deep(.vgl-item--resizing) {
  opacity: 90%;
}

:deep(.vgl-item--static) {
  background-color: #cce;
}

.content {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.text {
  padding: 5px;
  font-size: 16px;
  font-weight: bold;
  text-align: center;
  border-bottom: 1px dashed #999;
}

.dynamic-content {
  flex-grow: 1;
  padding: 8px;
  overflow: auto;
}
</style>
