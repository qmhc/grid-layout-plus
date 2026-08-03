<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Layout } from 'grid-layout-plus'

function createLayout(): Layout {
  return [
    { i: 'details', x: 0, y: 0, w: 12, h: 2, minH: 1 },
    { i: 'follower', x: 0, y: 2, w: 12, h: 2, autoHeight: false },
  ]
}

const layout = ref(createLayout())
const autoHeight = ref(true)
const expanded = ref(false)
const currentRows = computed(() => layout.value.find(item => item.i === 'details')?.h ?? 0)

function resetDemo(): void {
  layout.value = createLayout()
  autoHeight.value = true
  expanded.value = false
}
</script>

<template>
  <section class="demo-root demo-shell">
    <div class="demo-toolbar">
      <Button button-type="button" type="primary" @click="expanded = !expanded">
        {{ expanded ? 'Hide details' : 'Show details' }}
      </Button>
      <Checkbox v-model:checked="autoHeight"> auto-height </Checkbox>
      <span class="auto-height-state" data-layout-height="details" aria-live="polite">
        {{ expanded ? 'Expanded' : 'Collapsed' }} · h={{ currentRows }}
      </span>
      <Button button-type="button" @click="resetDemo"> Reset demo </Button>
    </div>

    <p class="auto-height-hint">
      Expand the first item. Its height follows the content, and the item below moves with it.
    </p>

    <GridLayout
      v-model:layout="layout"
      class="demo-grid auto-height-grid"
      :auto-height="autoHeight"
      :col-num="12"
      :row-height="28"
      :gap="[8, 8]"
      :is-draggable="false"
      :is-resizable="false"
    >
      <template #item="{ item }">
        <article class="auto-height-card" :data-auto-height-item="item.i">
          <template v-if="item.i === 'details'">
            <strong>Project update</strong>
            <p>The launch review is scheduled for Friday.</p>
            <div v-if="expanded" class="auto-height-details">
              <p>Design QA is complete and the remaining accessibility checks are in progress.</p>
              <p>Release notes will be shared after the final review.</p>
            </div>
          </template>
          <template v-else>
            <strong>Next grid item</strong>
            <p>This item moves down when the content above expands.</p>
          </template>
        </article>
      </template>
    </GridLayout>
  </section>
</template>

<style scoped>
.auto-height-hint {
  margin: 0;
  color: var(--demo-muted);
}

.auto-height-state {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 4px 9px;
  font-weight: 600;
  color: var(--demo-text);
  background: var(--demo-canvas);
  border: 1px solid var(--demo-border-subtle);
  border-radius: 6px;
}

.auto-height-grid > :deep(.vgl-item) {
  overflow: hidden;
}

.auto-height-card,
.auto-height-details {
  display: grid;
  gap: 6px;
  align-content: start;
}

.auto-height-card {
  width: 100%;
  padding: 8px 12px;
}

.auto-height-card strong {
  color: var(--demo-accent);
}

.auto-height-card p {
  min-height: 20px;
  margin: 0;
  line-height: 20px;
  color: var(--demo-muted);
}
</style>
