<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Layout } from 'grid-layout-plus'

let nextId = 5

const draggable = ref(true)
const resizable = ref(true)
const colNum = ref(12)
const lastAction = ref('None')
const selectedId = ref('0')

function createLayout(): Layout {
  return [
    { x: 0, y: 0, w: 2, h: 2, i: '0' },
    { x: 2, y: 0, w: 2, h: 2, i: '1' },
    { x: 4, y: 0, w: 2, h: 2, i: '2' },
    { x: 6, y: 0, w: 2, h: 2, i: '3' },
    { x: 8, y: 0, w: 2, h: 2, i: '4' },
  ]
}

const layout = ref(createLayout())
const itemOptions = computed(() => {
  return layout.value.map(item => ({
    label: String(item.i),
    value: String(item.i),
  }))
})

function addItem() {
  const id = `${nextId++}`
  layout.value.push({
    x: (layout.value.length * 2) % (colNum.value || 12),
    y: layout.value.length + (colNum.value || 12), // puts it at the bottom
    w: 2,
    h: 2,
    i: id,
  })
  selectedId.value = id
  lastAction.value = `Added item ${id}`
}

function removeItem(id: string) {
  const itemIndex = layout.value.findIndex(item => item.i === id)

  if (itemIndex > -1) {
    layout.value.splice(itemIndex, 1)
    selectedId.value = String(layout.value[Math.min(itemIndex, layout.value.length - 1)]?.i ?? '')
    lastAction.value = `Removed item ${id}`
  }
}

function resetDemo() {
  nextId = 5
  draggable.value = true
  resizable.value = true
  layout.value = createLayout()
  selectedId.value = '0'
  lastAction.value = 'Reset to 5 items'
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <Button button-type="button" type="primary" @click="addItem"> Add item </Button>
      <div class="demo-control">
        <span>Item</span>
        <Select
          v-model:value="selectedId"
          :options="itemOptions"
          aria-label="Item to remove"
        ></Select>
      </div>
      <Button
        button-type="button"
        type="error"
        :disabled="!selectedId"
        @click="removeItem(selectedId)"
      >
        Remove selected
      </Button>
      <Checkbox v-model:checked="draggable"> Draggable </Checkbox>
      <Checkbox v-model:checked="resizable"> Resizable </Checkbox>
      <Tag class="demo-state demo-state--accent" type="primary" simple circle>
        {{ layout.length }} items
      </Tag>
      <Tag class="demo-state" simple circle> Last action: {{ lastAction }} </Tag>
      <Button button-type="button" @click="resetDemo"> Reset demo </Button>
    </div>
    <Collapse class="demo-collapse" card>
      <CollapsePanel label="coordinates" title="Layout coordinates · [x, y, w, h]">
        <ul class="demo-coordinate-list" role="list">
          <li v-for="item in layout" :key="item.i">
            <code>{{ item.i }}: [{{ item.x }}, {{ item.y }}, {{ item.w }}, {{ item.h }}]</code>
          </li>
        </ul>
      </CollapsePanel>
    </Collapse>
    <Alert v-if="layout.length === 0" title="Empty grid" type="info" role="status">
      The grid is empty. Add an item or reset the demo.
    </Alert>
    <GridLayout
      v-model:layout="layout"
      class="demo-grid dynamic-grid"
      :col-num="colNum"
      :row-height="30"
      :is-draggable="draggable"
      :is-resizable="resizable"
    >
      <template #item="{ item }">
        <span class="demo-item__label">{{ item.i }}</span>
      </template>
    </GridLayout>
  </section>
</template>

<style scoped>
.dynamic-grid {
  min-height: 120px;
}
</style>
