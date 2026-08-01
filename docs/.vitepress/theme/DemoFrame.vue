<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'

import { useData } from 'vitepress'

interface DemoFrameProps {
  fullSourceLabel?: string
  hideSourceLabel?: string
  minHeight?: string
  minimalSourceLabel?: string
  previewLabel?: string
  sourceLabel?: string
  sourceTabsLabel?: string
  sourceTitle?: string
}

type SourceTab = 'minimal' | 'full'

const props = defineProps<DemoFrameProps>()

const { lang } = useData()
const activeSourceTab = ref<SourceTab>('minimal')
const fullSourceTab = ref<HTMLButtonElement>()
const minimalSourceTab = ref<HTMLButtonElement>()
const sourceOpen = ref(false)
const sourceId = useId()
const minimalSourceTabId = `${sourceId}-minimal-tab`
const minimalSourcePanelId = `${sourceId}-minimal-panel`
const fullSourceTabId = `${sourceId}-full-tab`
const fullSourcePanelId = `${sourceId}-full-panel`

const defaultLabels = computed(() => {
  return lang.value.startsWith('zh')
    ? {
        fullSource: '完整源码',
        hideSource: '收起源码',
        minimalSource: '最简示例',
        preview: '在线示例',
        source: '查看源码',
        sourceTabs: '源码版本',
        sourceTitle: '源码',
      }
    : {
        fullSource: 'Full source',
        hideSource: 'Hide source',
        minimalSource: 'Minimal example',
        preview: 'Live demo',
        source: 'View source',
        sourceTabs: 'Source versions',
        sourceTitle: 'Source code',
      }
})

const fullSourceLabel = computed(() => props.fullSourceLabel ?? defaultLabels.value.fullSource)
const hideSourceLabel = computed(() => props.hideSourceLabel ?? defaultLabels.value.hideSource)
const minimalSourceLabel = computed(
  () => props.minimalSourceLabel ?? defaultLabels.value.minimalSource,
)
const previewLabel = computed(() => props.previewLabel ?? defaultLabels.value.preview)
const sourceLabel = computed(() => props.sourceLabel ?? defaultLabels.value.source)
const sourceTabsLabel = computed(() => props.sourceTabsLabel ?? defaultLabels.value.sourceTabs)
const sourceTitle = computed(() => props.sourceTitle ?? defaultLabels.value.sourceTitle)

const frameStyle = computed(() => ({
  '--demo-frame-min-height': props.minHeight ?? '560px',
}))

function selectSourceTab(tab: SourceTab) {
  activeSourceTab.value = tab
}

function handleSourceTabKeydown(event: KeyboardEvent) {
  let nextTab: SourceTab | null = null

  if (event.key === 'Home') nextTab = 'minimal'
  if (event.key === 'End') nextTab = 'full'
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    nextTab = activeSourceTab.value === 'minimal' ? 'full' : 'minimal'
  }
  if (!nextTab) return

  event.preventDefault()
  selectSourceTab(nextTab)
  nextTick(() => {
    const target = nextTab === 'minimal' ? minimalSourceTab.value : fullSourceTab.value
    target?.focus()
  })
}
</script>

<template>
  <section class="demo-frame" :style="frameStyle">
    <header class="demo-frame__toolbar">
      <div class="demo-frame__label">
        <span class="demo-frame__status" aria-hidden="true"></span>
        <span>{{ previewLabel }}</span>
      </div>
    </header>

    <div class="demo-frame__preview">
      <slot></slot>
    </div>

    <div class="demo-frame__source-actions">
      <button
        class="demo-frame__source-toggle"
        type="button"
        :aria-controls="sourceId"
        :aria-expanded="sourceOpen"
        @click="sourceOpen = !sourceOpen"
      >
        <span aria-hidden="true">&lt;/&gt;</span>
        <span>{{ sourceOpen ? hideSourceLabel : sourceLabel }}</span>
      </button>
    </div>

    <Transition name="demo-frame-source">
      <section
        v-show="sourceOpen"
        :id="sourceId"
        class="demo-frame__source"
        :aria-label="sourceTitle"
      >
        <header class="demo-frame__source-header">
          <div class="demo-frame__source-tabs" role="tablist" :aria-label="sourceTabsLabel">
            <button
              :id="minimalSourceTabId"
              ref="minimalSourceTab"
              class="demo-frame__source-tab"
              type="button"
              role="tab"
              :aria-controls="minimalSourcePanelId"
              :aria-selected="activeSourceTab === 'minimal'"
              :tabindex="activeSourceTab === 'minimal' ? 0 : -1"
              @click="selectSourceTab('minimal')"
              @keydown="handleSourceTabKeydown"
            >
              {{ minimalSourceLabel }}
            </button>
            <button
              :id="fullSourceTabId"
              ref="fullSourceTab"
              class="demo-frame__source-tab"
              type="button"
              role="tab"
              :aria-controls="fullSourcePanelId"
              :aria-selected="activeSourceTab === 'full'"
              :tabindex="activeSourceTab === 'full' ? 0 : -1"
              @click="selectSourceTab('full')"
              @keydown="handleSourceTabKeydown"
            >
              {{ fullSourceLabel }}
            </button>
          </div>
          <span class="demo-frame__source-kind">Vue SFC</span>
        </header>
        <div
          v-show="activeSourceTab === 'minimal'"
          :id="minimalSourcePanelId"
          class="demo-frame__source-content"
          role="tabpanel"
          :aria-labelledby="minimalSourceTabId"
          tabindex="0"
        >
          <slot name="minimal-source"></slot>
        </div>
        <div
          v-show="activeSourceTab === 'full'"
          :id="fullSourcePanelId"
          class="demo-frame__source-content"
          role="tabpanel"
          :aria-labelledby="fullSourceTabId"
          tabindex="0"
        >
          <slot name="source"></slot>
        </div>
      </section>
    </Transition>
  </section>
</template>
