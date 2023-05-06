<script setup lang="ts">
import {
  ref,
  reactive,
  toRefs,
  watch,
  provide,
  onBeforeMount,
  onMounted,
  onBeforeUnmount,
  nextTick
} from 'vue'
import GridItem from './grid-item.vue'
import { useResize } from '@vexip-ui/hooks'
import { createEventEmitter, isNull, debounce } from '@vexip-ui/utils'
import {
  LAYOUT_KEY,
  EMITTER_KEY,
  bottom,
  compact,
  getLayoutItem,
  moveElement,
  validateLayout,
  cloneLayout,
  getAllCollisions
} from '../helpers/common'
import {
  getBreakpointFromWidth,
  getColsFromBreakpoint,
  findOrGenerateResponsiveLayout
} from '../helpers/responsive'

import type { PropType } from 'vue'
import type {
  Layout,
  Breakpoint,
  Breakpoints,
  ResponsiveLayout,
  LayoutInstance
} from '../helpers/types'

const props = defineProps({
  autoSize: {
    type: Boolean,
    default: true
  },
  colNum: {
    type: Number,
    default: 12
  },
  rowHeight: {
    type: Number,
    default: 150
  },
  maxRows: {
    type: Number,
    default: Infinity
  },
  margin: {
    type: Array as PropType<number[]>,
    default: () => [10, 10]
  },
  isDraggable: {
    type: Boolean,
    default: true
  },
  isResizable: {
    type: Boolean,
    default: true
  },
  isMirrored: {
    type: Boolean,
    default: false
  },
  isBounded: {
    type: Boolean,
    default: false
  },
  isSwappable: {
    type: Boolean,
    default: false
  },
  useCssTransforms: {
    type: Boolean,
    default: true
  },
  verticalCompact: {
    type: Boolean,
    default: true
  },
  restoreOnDrag: {
    type: Boolean,
    default: false
  },
  layout: {
    type: Array as PropType<Layout>,
    required: true
  },
  responsive: {
    type: Boolean,
    default: false
  },
  responsiveLayouts: {
    type: Object as PropType<Partial<ResponsiveLayout>>,
    default: () => ({})
  },
  transformScale: {
    type: Number,
    default: 1
  },
  breakpoints: {
    type: Object as PropType<Breakpoints>,
    default: () => ({ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 })
  },
  cols: {
    type: Object as PropType<Breakpoints>,
    default: () => ({ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 })
  },
  preventCollision: {
    type: Boolean,
    default: false
  },
  useStyleCursor: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits([
  'layout-before-mount',
  'layout-mounted',
  'layout-updated',
  'breakpoint-changed',
  'update:layout',
  'layout-ready'
])

const state = reactive({
  width: -1,
  mergedStyle: {},
  lastLayoutLength: 0,
  isDragging: false,
  placeholder: {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    i: '' as number | string
  },
  layouts: {} as Record<Breakpoint, Layout>, // array to store all layouts from different breakpoints
  lastBreakpoint: null as Breakpoint | null, // store last active breakpoint
  originalLayout: null! as Layout // store original Layout
})

const itemInstances = new Map<number | string, any>()

const currentLayout = ref(props.layout)
const wrapper = ref<HTMLElement>()

const { observeResize, unobserveResize } = useResize()
const emitter = createEventEmitter()

emitter.on('resizeEvent', resizeEventHandler)
emitter.on('dragEvent', dragEventHandler)

onBeforeMount(() => {
  emit('layout-before-mount', currentLayout.value)
})

onMounted(() => {
  emit('layout-mounted', currentLayout.value)

  nextTick(() => {
    validateLayout(currentLayout.value)

    state.originalLayout = currentLayout.value

    nextTick(() => {
      initResponsiveFeatures()
      wrapper.value && observeResize(wrapper.value, debounce(onWindowResize, 16))
      compact(currentLayout.value, props.verticalCompact)
      emit('layout-updated', currentLayout.value)
      updateHeight()
      onWindowResize()
    })
  })
})

onBeforeUnmount(() => {
  emitter.clearAll()
  wrapper.value && unobserveResize(wrapper.value)
})

function resizeEventHandler(
  eventType: string,
  i: number | string,
  x: number,
  y: number,
  h: number,
  w: number
) {
  resizeEvent(eventType, i, x, y, h, w)
}

function dragEventHandler(
  eventType: string,
  i: number | string,
  x: number,
  y: number,
  h: number,
  w: number
) {
  dragEvent(eventType, i, x, y, h, w)
}

watch(
  () => state.width,
  (newval, oldval) => {
    nextTick(() => {
      emitter.emit('updateWidth', newval)
      if (oldval === null) {
        /*
        If oldval == null is when the width has never been
        set before. That only occurs when mouting is
        finished, and onWindowResize has been called and
        this.width has been changed the first time after it
        got set to null in the constructor. It is now time
        to issue layout-ready events as the GridItems have
        their sizes configured properly.

        The reason for emitting the layout-ready events on
        the next tick is to allow for the newly-emitted
        updateWidth event (above) to have reached the
        children GridItem-s and had their effect, so we're
        sure that they have the final size before we emit
        layout-ready (for this GridLayout) and
        item-layout-ready (for the GridItem-s).

        This way any client event handlers can reliably
        invistigate stable sizes of GridItem-s.
      */
        nextTick(() => {
          emit('layout-ready', currentLayout.value)
        })
      }
      updateHeight()
    })
  }
)
watch(
  () => [props.layout, props.layout.length],
  () => {
    currentLayout.value = props.layout
    layoutUpdate()
  }
)
watch(
  () => props.colNum,
  val => {
    emitter.emit('setColNum', val)
  }
)
watch(
  () => props.rowHeight,
  value => {
    emitter.emit('setRowHeight', value)
  }
)
watch(
  () => props.isDraggable,
  value => {
    emitter.emit('setDraggable', value)
  }
)
watch(
  () => props.isResizable,
  value => {
    emitter.emit('setResizable', value)
  }
)
watch(
  () => props.isBounded,
  value => {
    emitter.emit('setBounded', value)
  }
)
watch(
  () => props.isSwappable,
  value => {
    emitter.emit('setSwappable', value)
  }
)
watch(
  () => props.transformScale,
  value => {
    emitter.emit('setTransformScale', value)
  }
)
watch(
  () => props.responsive,
  value => {
    if (!value) {
      emit('update:layout', state.originalLayout)
      emitter.emit('setColNum', props.colNum)
    }
    onWindowResize()
  }
)
watch(
  () => props.maxRows,
  value => {
    emitter.emit('setMaxRows', value)
  }
)
watch(() => props.margin, updateHeight)

provide(
  LAYOUT_KEY,
  reactive({
    ...toRefs(props),
    ...toRefs(state),
    increaseItem,
    decreaseItem
  }) as LayoutInstance
)
provide(EMITTER_KEY, emitter)

defineExpose({ state, getItem, resizeEvent, dragEvent })

function increaseItem(item: any) {
  itemInstances.set(item.i, item)
}

function decreaseItem(item: any) {
  itemInstances.delete(item.i)
}

function getItem(id: number | string) {
  return itemInstances.get(id)
}

function layoutUpdate() {
  if (!isNull(currentLayout.value) && !isNull(state.originalLayout)) {
    if (currentLayout.value.length !== state.originalLayout.length) {
      const diff = findDifference(currentLayout.value, state.originalLayout)

      if (diff.length > 0) {
        if (currentLayout.value.length > state.originalLayout.length) {
          state.originalLayout = state.originalLayout.concat(diff)
        } else {
          const ids = new Set(diff.map(item => item.i))
          state.originalLayout = state.originalLayout.filter(item => !ids.has(item.i))
        }
      }

      state.lastLayoutLength = currentLayout.value.length
      initResponsiveFeatures()
    }

    compact(currentLayout.value, props.verticalCompact)
    emitter.emit('updateWidth', state.width)
    updateHeight()

    emit('layout-updated', currentLayout.value)
  }
}

function updateHeight() {
  state.mergedStyle = {
    height: containerHeight()
  }
}

function onWindowResize() {
  if (wrapper.value) {
    state.width = wrapper.value.offsetWidth
  }

  emitter.emit('resizeEvent')
}

function containerHeight() {
  if (!props.autoSize) return

  const containerHeight =
    bottom(currentLayout.value) * (props.rowHeight + props.margin[1]) + props.margin[1] + 'px'
  return containerHeight
}

let positionsBeforeDrag: Record<string, { x: number, y: number }> | undefined

function dragEvent(
  eventName: string,
  id: number | string,
  x: number,
  y: number,
  h: number,
  w: number
) {
  let l = getLayoutItem(currentLayout.value, id)!

  // GetLayoutItem sometimes returns null object
  if (isNull(l)) {
    l = { h: 0, w: 0, x: 0, y: 0, i: '' }
  }

  if (eventName === 'dragstart' && !props.verticalCompact) {
    positionsBeforeDrag = currentLayout.value.reduce(
      (result, { i, x, y }) => ({
        ...result,
        [i]: { x, y }
      }),
      {}
    )
  }

  if (eventName === 'dragmove' || eventName === 'dragstart') {
    state.placeholder.i = id
    state.placeholder.x = l.x
    state.placeholder.y = l.y
    state.placeholder.w = w
    state.placeholder.h = h

    nextTick(() => {
      state.isDragging = true
    })

    emitter.emit('updateWidth', state.width)
  } else {
    nextTick(() => {
      state.isDragging = false
    })
  }

  // Move the element to the dragged location.
  currentLayout.value = moveElement(currentLayout.value, l, x, y, true, props.preventCollision, props.isSwappable)

  if (props.restoreOnDrag) {
    // Do not compact items more than in layout before drag
    // Set moved item as static to avoid to compact it
    l.static = true
    compact(currentLayout.value, props.verticalCompact, positionsBeforeDrag)
    l.static = false
  } else {
    compact(currentLayout.value, props.verticalCompact)
  }

  // needed because vue can't detect changes on array element properties
  emitter.emit('compact')
  updateHeight()
  if (eventName === 'dragend') {
    positionsBeforeDrag = undefined
    emit('layout-updated', currentLayout.value)
  }
}

function resizeEvent(
  eventName: string,
  id: number | string,
  x: number,
  y: number,
  h: number,
  w: number
) {
  let l = getLayoutItem(currentLayout.value, id)!
  // GetLayoutItem sometimes return null object
  if (isNull(l)) {
    l = { h: 0, w: 0, x: 0, y: 0, i: '' }
  }

  let hasCollisions
  if (props.preventCollision) {
    const collisions = getAllCollisions(currentLayout.value, { ...l, w, h }).filter(
      layoutItem => layoutItem.i !== l.i
    )
    hasCollisions = collisions.length > 0

    // If we're colliding, we need adjust the placeholder.
    if (hasCollisions) {
      // adjust w && h to maximum allowed space
      let leastX = Infinity
      let leastY = Infinity
      collisions.forEach(layoutItem => {
        if (layoutItem.x > l.x) leastX = Math.min(leastX, layoutItem.x)
        if (layoutItem.y > l.y) leastY = Math.min(leastY, layoutItem.y)
      })

      if (Number.isFinite(leastX)) l.w = leastX - l.x
      if (Number.isFinite(leastY)) l.h = leastY - l.y
    }
  }

  if (!hasCollisions) {
    // Set new width and height.
    l.w = w
    l.h = h
  }

  if (eventName === 'resizestart' || eventName === 'resizemove') {
    state.placeholder.i = id
    state.placeholder.x = x
    state.placeholder.y = y
    state.placeholder.w = l.w
    state.placeholder.h = l.h
    nextTick(() => {
      state.isDragging = true
    })
    // this.$broadcast("updateWidth", this.width);
    emitter.emit('updateWidth', state.width)
  } else {
    nextTick(() => {
      state.isDragging = false
    })
  }

  if (props.responsive) responsiveGridLayout()

  compact(currentLayout.value, props.verticalCompact)
  emitter.emit('compact')
  updateHeight()

  if (eventName === 'resizeend') emit('layout-updated', currentLayout.value)
}

function responsiveGridLayout() {
  const newBreakpoint = getBreakpointFromWidth(props.breakpoints, state.width)
  const newCols = getColsFromBreakpoint(newBreakpoint, props.cols)

  // save actual layout in layouts
  if (!isNull(state.lastBreakpoint) && !state.layouts[state.lastBreakpoint]) {
    state.layouts[state.lastBreakpoint] = cloneLayout(currentLayout.value)
  }

  // Find or generate a new layout.
  const layout = findOrGenerateResponsiveLayout(
    state.originalLayout,
    state.layouts,
    props.breakpoints,
    newBreakpoint,
    state.lastBreakpoint!,
    newCols,
    props.verticalCompact
  )

  // Store the new layout.
  state.layouts[newBreakpoint] = layout

  if (state.lastBreakpoint !== newBreakpoint) {
    emit('breakpoint-changed', newBreakpoint, layout)
  }

  // new prop sync
  emit('update:layout', layout)

  state.lastBreakpoint = newBreakpoint
  emitter.emit('setColNum', getColsFromBreakpoint(newBreakpoint, props.cols))
}

function initResponsiveFeatures() {
  // clear layouts
  state.layouts = Object.assign({} as Record<Breakpoint, Layout>, props.responsiveLayouts)
}

function findDifference(layout: Layout, originalLayout: Layout) {
  const originalIds = new Set(originalLayout.map(item => item.i))
  const ids = new Set(layout.map(item => item.i))

  // Find values that are in result1 but not in result2
  const uniqueResultOne = layout.filter(item => !originalIds.has(item.i))

  // Find values that are in result2 but not in result1
  const uniqueResultTwo = originalLayout.filter(item => !ids.has(item.i))

  // Combine the two arrays of unique entries#
  return uniqueResultOne.concat(uniqueResultTwo)
}
</script>

<template>
  <div ref="wrapper" class="vgl-layout" :style="state.mergedStyle">
    <slot v-if="$slots.default"></slot>
    <template v-else>
      <GridItem v-for="item in currentLayout" :key="item.i" v-bind="item">
        <slot name="item" :item="item"></slot>
      </GridItem>
    </template>
    <GridItem
      v-show="state.isDragging"
      class="vgl-item--placeholder"
      :x="state.placeholder.x"
      :y="state.placeholder.y"
      :w="state.placeholder.w"
      :h="state.placeholder.h"
      :i="state.placeholder.i"
    ></GridItem>
  </div>
</template>
