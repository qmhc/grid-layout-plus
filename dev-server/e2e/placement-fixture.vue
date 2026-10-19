<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref } from 'vue'

import type { Layout } from '../../src/helpers/types'

const preexisting = new URLSearchParams(location.search).get('preexisting') === 'true'
const showNewItem = ref(false)
const layout = ref<Layout>([
  { i: 'a', x: 0, y: 0, w: 2, h: 2 },
  { i: 'b', x: 2, y: 0, w: 2, h: 2 },
])
if (preexisting) layout.value.push({ i: 'c', x: 4, y: 0, w: 2, h: 2 })
const visibleItems = computed(() =>
  layout.value.filter(item => item.i !== 'c' || showNewItem.value),
)
const transitions = ref(0)
const Probe = defineComponent({
  setup() {
    const root = ref<HTMLElement>()
    onMounted(() => {
      const item = root.value!.parentElement!
      // 模拟图表等内容在 mounted 中测量布局，确保浏览器已计算首次样式。
      getComputedStyle(item).getPropertyValue('transform')
      item.getBoundingClientRect()
    })
    return () => h('span', { ref: root }, 'content')
  },
})
function addItem() {
  layout.value = preexisting
    ? layout.value.map(item => (item.i === 'c' ? { ...item, x: 6 } : item))
    : [...layout.value, { i: 'c', x: 6, y: 0, w: 2, h: 2 }]
  showNewItem.value = true
}
function moveItem() {
  layout.value = layout.value.map(item => (item.i === 'c' ? { ...item, x: 8 } : item))
}
function recordTransition(event: TransitionEvent) {
  if (event.propertyName === 'transform') transitions.value++
}
</script>

<template>
  <div data-placement-fixture>
    <button data-placement-add @click="addItem">
      Add
    </button>
    <button data-placement-move @click="moveItem">
      Move
    </button>
    <output data-placement-transitions>{{ transitions }}</output>
    <GridLayout
      :layout="layout"
      :width="1200"
      :col-num="12"
      :row-height="30"
    >
      <GridItem
        v-for="item in visibleItems"
        :key="item.i"
        :i="item.i"
        :data-placement-item="item.i"
        @transitionrun="recordTransition"
      >
        <Probe></Probe>
      </GridItem>
    </GridLayout>
  </div>
</template>
