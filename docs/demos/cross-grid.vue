<script setup lang="ts">
import { ref } from 'vue'

import type { GridTransferResult, LayoutItem, TransferConfig } from 'grid-layout-plus'

interface DashboardItem extends LayoutItem {
  metadata: {
    title: string
  }
}

const transferConfig: TransferConfig = { group: 'dashboard' }
const left = ref<DashboardItem[]>([
  { i: 'sales', x: 0, y: 0, w: 2, h: 2, metadata: { title: 'Sales' } },
  { i: 'visits', x: 2, y: 0, w: 2, h: 2, metadata: { title: 'Visits' } },
])
const right = ref<DashboardItem[]>([
  { i: 'tasks', x: 0, y: 0, w: 2, h: 2, metadata: { title: 'Tasks' } },
])
const status = ref('Drag a card between the two grids')

function handleTransfer(result: GridTransferResult) {
  status.value = `Moved ${String(result.item.i)} · target (${result.item.x}, ${result.item.y})`
}

function resetDemo() {
  left.value = [
    { i: 'sales', x: 0, y: 0, w: 2, h: 2, metadata: { title: 'Sales' } },
    { i: 'visits', x: 2, y: 0, w: 2, h: 2, metadata: { title: 'Visits' } },
  ]
  right.value = [{ i: 'tasks', x: 0, y: 0, w: 2, h: 2, metadata: { title: 'Tasks' } }]
  status.value = 'Reset · drag a card between the two grids'
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <Tag class="demo-state demo-state--accent" type="primary" simple circle>
        {{ status }}
      </Tag>
      <Button button-type="button" @click="resetDemo"> Reset demo </Button>
    </div>
    <div class="demo-drop-workspace">
      <Card class="demo-panel" title="Grid A" shadow="never">
        <GridLayout
          v-model:layout="left"
          class="demo-grid"
          :transfer-config="transferConfig"
          :col-num="4"
          :row-height="44"
          @transfer="handleTransfer"
        >
          <template #item="{ item }">
            <span class="demo-item__label">{{ item.i }}</span>
          </template>
        </GridLayout>
      </Card>
      <Card class="demo-panel" title="Grid B" shadow="never">
        <GridLayout
          v-model:layout="right"
          class="demo-grid"
          :transfer-config="transferConfig"
          :col-num="4"
          :row-height="44"
          @transfer="handleTransfer"
        >
          <template #item="{ item }">
            <span class="demo-item__label">{{ item.i }}</span>
          </template>
        </GridLayout>
      </Card>
    </div>
  </section>
</template>
