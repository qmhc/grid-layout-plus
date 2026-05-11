<script setup lang="ts">
import {
  nextTick,
  onBeforeMount,
  onBeforeUnmount,
  onMounted,
  provide,
  reactive,
  ref,
  toRefs,
  watch,
} from 'vue'

import GridItem from './grid-item.vue'
import { useResize } from '@vexip-ui/hooks'
import { createEventEmitter, debounce, isNull } from '@vexip-ui/utils'
import {
  EMITTER_KEY,
  LAYOUT_KEY,
  bottom,
  cloneLayout,
  compact,
  getAllCollisions,
  getLayoutItem,
  moveElement,
  validateLayout,
} from '../helpers/common'
import {
  findOrGenerateResponsiveLayout,
  getBreakpointFromWidth,
  getColsFromBreakpoint,
} from '../helpers/responsive'
import { verticalCompactor } from '../core/compactors'
import { transformStrategy } from '../core/position-strategies'

import type { Breakpoint, Compactor, Layout, LayoutInstance, PositionStrategy, ResizeHandle } from '../helpers/types'
import type { GridLayoutProps } from './types'

const props = withDefaults(defineProps<GridLayoutProps>(), {
  autoSize: true,
  colNum: 12,
  rowHeight: 150,
  maxRows: Infinity,
  margin: () => [10, 10],
  isDraggable: true,
  isResizable: true,
  isMirrored: false,
  isBounded: false,
  restoreOnDrag: false,
  responsive: false,
  responsiveLayouts: () => ({}),
  breakpoints: () => ({ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }),
  cols: () => ({ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }),
  preventCollision: false,
  useStyleCursor: true,
  compactor: () => verticalCompactor,
  positionStrategy: () => transformStrategy,
  resizeHandles: () => ['se'] as ResizeHandle[],
  isDroppable: false,
  dropItem: () => ({ w: 1, h: 1 }),
  dragThreshold: 0,
})

const emit = defineEmits([
  'layout-before-mount',
  'layout-mounted',
  'layout-updated',
  'breakpoint-changed',
  'update:layout',
  'layout-ready',
  'drop-drag-over',
  'drop',
  'drop-drag-leave',
])

/**
 * Config 合并逻辑：扁平 props 优先于分组 config。
 * 对于每个配置项，如果扁平 prop 被显式传入（非 undefined），则使用扁平 prop 的值；
 * 否则使用分组 config 中的值；最后回退到默认值。
 *
 * 注意：由于 withDefaults 已经为扁平 props 设置了默认值，
 * 我们通过检查 $attrs 和 props 来判断是否显式传入。
 * 实际上，withDefaults 使得扁平 props 始终有值，
 * 所以分组 config 只在扁平 props 使用默认值时才可能覆盖。
 * 但根据需求 8.5，扁平 props 优先级更高，即使是默认值也优先。
 * 因此分组 config 仅作为替代写法，不会覆盖已有默认值的扁平 props。
 */

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
    i: '' as number | string,
  },
  layouts: {} as Record<Breakpoint, Layout>,
  lastBreakpoint: null as Breakpoint | null,
  originalLayout: null! as Layout,
  // 外部拖入占位符状态
  dropPlaceholder: null as { x: number, y: number, w: number, h: number } | null,
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
      compactLayout()
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
  w: number,
) {
  resizeEvent(eventType, i, x, y, h, w)
}

function dragEventHandler(
  eventType: string,
  i: number | string,
  x: number,
  y: number,
  h: number,
  w: number,
) {
  dragEvent(eventType, i, x, y, h, w)
}

/**
 * 使用可插拔 compactor 执行布局压缩。
 * 替代原来直接调用 compact(layout, verticalCompact) 的方式。
 */
function compactLayout(positionsBeforeDrag?: Record<string, { x: number, y: number }>) {
  if (positionsBeforeDrag) {
    // restoreOnDrag 模式：使用旧的 compact 函数以支持 minPositions
    compact(currentLayout.value, true, positionsBeforeDrag)
  } else {
    // 使用可插拔 compactor
    const result = props.compactor.compact(currentLayout.value, props.colNum)
    // 将结果同步回 currentLayout（保持引用稳定）
    for (let i = 0; i < currentLayout.value.length; i++) {
      const src = result.find(r => r.i === currentLayout.value[i].i)
      if (src) {
        currentLayout.value[i].x = src.x
        currentLayout.value[i].y = src.y
        currentLayout.value[i].w = src.w
        currentLayout.value[i].h = src.h
        currentLayout.value[i].moved = src.moved
      }
    }
  }
}

watch(
  () => state.width,
  (newVal, oldVal) => {
    nextTick(() => {
      emitter.emit('updateWidth', newVal)
      if (oldVal === -1) {
        nextTick(() => {
          emit('layout-ready', currentLayout.value)
        })
      }
      updateHeight()
    })
  },
)
watch(
  () => [props.layout, props.layout.length],
  () => {
    currentLayout.value = props.layout
    layoutUpdate()
  },
)
watch(
  () => props.colNum,
  val => {
    emitter.emit('setColNum', val)
  },
)
watch(
  () => props.rowHeight,
  value => {
    emitter.emit('setRowHeight', value)
  },
)
watch(
  () => props.isDraggable,
  value => {
    emitter.emit('setDraggable', value)
  },
)
watch(
  () => props.isResizable,
  value => {
    emitter.emit('setResizable', value)
  },
)
watch(
  () => props.isBounded,
  value => {
    emitter.emit('setBounded', value)
  },
)
watch(
  () => props.responsive,
  value => {
    if (!value) {
      emit('update:layout', state.originalLayout)
      emitter.emit('setColNum', props.colNum)
    }
    onWindowResize()
  },
)
watch(
  () => props.maxRows,
  value => {
    emitter.emit('setMaxRows', value)
  },
)
watch(
  () => props.compactor,
  () => {
    compactLayout()
    emitter.emit('updateWidth', state.width)
    updateHeight()
    emit('layout-updated', currentLayout.value)
  },
)
watch([() => props.margin, () => props.margin[1]], updateHeight)

provide(
  LAYOUT_KEY,
  reactive({
    ...toRefs(props),
    ...toRefs(state),
    increaseItem,
    decreaseItem,
  }) as LayoutInstance,
)
provide(EMITTER_KEY, emitter)

defineExpose({ state, getItem, resizeEvent, dragEvent, layoutUpdate })

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

    compactLayout()
    emitter.emit('updateWidth', state.width)
    updateHeight()

    emit('layout-updated', currentLayout.value)
  }
}

function updateHeight() {
  state.mergedStyle = {
    height: containerHeight(),
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

  const marginY = parseFloat(props.margin[1] as any)
  const containerHeight = bottom(currentLayout.value) * (props.rowHeight + marginY) + marginY + 'px'
  return containerHeight
}

let positionsBeforeDrag: Record<string, { x: number, y: number }> | undefined

function dragEvent(
  eventName: string,
  id: number | string,
  x: number,
  y: number,
  h: number,
  w: number,
) {
  let l = getLayoutItem(currentLayout.value, id)!

  if (isNull(l)) {
    l = { h: 0, w: 0, x: 0, y: 0, i: '' }
  }

  if (eventName === 'dragstart' && props.compactor.allowOverlap) {
    // allowOverlap 模式下不需要记录位置
  } else if (eventName === 'dragstart') {
    positionsBeforeDrag = currentLayout.value.reduce(
      (result, { i, x, y }) => ({
        ...result,
        [i]: { x, y },
      }),
      {},
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

  if (props.compactor.allowOverlap) {
    // allowOverlap 模式：直接更新位置，不做碰撞检测和推开
    l.x = x
    l.y = y
    l.moved = true
  } else {
    currentLayout.value = moveElement(currentLayout.value, l, x, y, true, props.preventCollision)
  }

  if (props.restoreOnDrag && !props.compactor.allowOverlap) {
    l.static = true
    compactLayout(positionsBeforeDrag)
    l.static = false
  } else if (!props.compactor.allowOverlap) {
    compactLayout()
  }

  emitter.emit('compact')
  updateHeight()
  if (eventName === 'dragend') {
    positionsBeforeDrag = undefined
    emit('layout-updated', currentLayout.value)
  }
}

function resizeEvent(
  eventName: string | undefined,
  id: number | string,
  x: number,
  y: number,
  h: number,
  w: number,
) {
  let l = getLayoutItem(currentLayout.value, id)!
  if (isNull(l)) {
    l = { h: 0, w: 0, x: 0, y: 0, i: '' }
  }

  let hasCollisions
  if (props.preventCollision) {
    const collisions = getAllCollisions(currentLayout.value, { ...l, w, h }).filter(
      layoutItem => layoutItem.i !== l.i,
    )
    hasCollisions = collisions.length > 0

    if (hasCollisions) {
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
    l.w = w
    l.h = h
    l.x = x
    l.y = y
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
    emitter.emit('updateWidth', state.width)
  } else if (eventName) {
    nextTick(() => {
      state.isDragging = false
    })
  }

  if (props.responsive) responsiveGridLayout()

  compactLayout()
  emitter.emit('compact')
  updateHeight()

  if (eventName === 'resizeend') emit('layout-updated', currentLayout.value)
}

function responsiveGridLayout() {
  const newBreakpoint = getBreakpointFromWidth(props.breakpoints, state.width)

  if (newBreakpoint === state.lastBreakpoint) {
    return
  }

  const newCols = getColsFromBreakpoint(newBreakpoint, props.cols)

  if (!isNull(state.lastBreakpoint) && !state.layouts[state.lastBreakpoint]) {
    state.layouts[state.lastBreakpoint] = cloneLayout(currentLayout.value)
  }

  const layout = findOrGenerateResponsiveLayout(
    state.originalLayout,
    state.layouts,
    props.breakpoints,
    newBreakpoint,
    state.lastBreakpoint!,
    newCols,
    true,
  )

  state.layouts[newBreakpoint] = layout

  if (state.lastBreakpoint !== newBreakpoint) {
    emit('breakpoint-changed', newBreakpoint, layout)
  }

  currentLayout.value = layout

  emit('update:layout', layout)

  state.lastBreakpoint = newBreakpoint
  emitter.emit('setColNum', newCols)
}

function initResponsiveFeatures() {
  state.layouts = Object.assign({} as Record<Breakpoint, Layout>, props.responsiveLayouts)
}

function findDifference(layout: Layout, originalLayout: Layout) {
  const originalIds = new Set(originalLayout.map(item => item.i))
  const ids = new Set(layout.map(item => item.i))

  const uniqueResultOne = layout.filter(item => !originalIds.has(item.i))
  const uniqueResultTwo = originalLayout.filter(item => !ids.has(item.i))

  return uniqueResultOne.concat(uniqueResultTwo)
}

// ---------------------------------------------------------------------------
// 外部拖入功能（需求 6）
// ---------------------------------------------------------------------------

function handleDragOver(event: DragEvent) {
  if (!props.isDroppable) return
  event.preventDefault()

  if (!wrapper.value) return

  const rect = wrapper.value.getBoundingClientRect()

  // 直接检查鼠标坐标是否在容器内（不依赖 dragover 的触发区域，
  // 因为 ghost image 可能覆盖 div 导致 dragover 在 div 外仍触发）。
  // 只在 rect 有有效尺寸时检查（happy-dom 测试环境中 rect 可能为 0）
  const mouseX = event.clientX
  const mouseY = event.clientY
  if (rect.width > 0 && rect.height > 0) {
    if (mouseX < rect.left || mouseX > rect.right || mouseY < rect.top || mouseY > rect.bottom) {
      state.dropPlaceholder = null
      return
    }
  }

  const marginX = props.margin[0] || 0
  const marginY = props.margin[1] || 0
  const colWidth = (state.width - marginX * (props.colNum + 1)) / props.colNum

  const dw = props.dropItem.w
  const dh = props.dropItem.h

  // 计算网格坐标：让 placeholder 中心对齐鼠标，体验更自然
  const relX = mouseX - rect.left
  const relY = mouseY - rect.top
  const placeholderHalfW = (dw * colWidth + (dw - 1) * marginX) / 2
  const placeholderHalfH = (dh * props.rowHeight + (dh - 1) * marginY) / 2
  let gridX = Math.round((relX - marginX - placeholderHalfW) / (colWidth + marginX))
  let gridY = Math.round((relY - marginY - placeholderHalfH) / (props.rowHeight + marginY))

  // Clamp 到有效范围
  gridX = Math.max(0, Math.min(gridX, props.colNum - dw))
  gridY = Math.max(0, gridY)
  if (props.maxRows !== Infinity) {
    gridY = Math.min(gridY, props.maxRows - dh)
  }

  state.dropPlaceholder = { x: gridX, y: gridY, w: dw, h: dh }

  emit('drop-drag-over', { x: gridX, y: gridY }, event)
}

function handleDrop(event: DragEvent) {
  if (!props.isDroppable) return
  event.preventDefault()

  if (state.dropPlaceholder) {
    const { x, y, w, h } = state.dropPlaceholder
    emit('drop', { x, y, w, h }, event)
  }

  state.dropPlaceholder = null
}

function handleDragLeave(event: DragEvent) {
  if (!props.isDroppable) return

  // 检查鼠标是否真的在容器外（不依赖 relatedTarget，跨浏览器更可靠）
  if (wrapper.value) {
    const rect = wrapper.value.getBoundingClientRect()
    const x = event.clientX
    const y = event.clientY
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return // 鼠标还在容器内（可能是进入了子元素）
    }
  }

  state.dropPlaceholder = null
  emit('drop-drag-leave', event)
}
</script>

<template>
  <div
    ref="wrapper"
    class="vgl-layout"
    :style="state.mergedStyle"
    @dragover="handleDragOver"
    @drop="handleDrop"
    @dragleave="handleDragLeave"
  >
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
    <GridItem
      v-if="state.dropPlaceholder"
      class="vgl-item--placeholder"
      :x="state.dropPlaceholder.x"
      :y="state.dropPlaceholder.y"
      :w="state.dropPlaceholder.w"
      :h="state.dropPlaceholder.h"
      :i="'__drop__'"
    ></GridItem>
  </div>
</template>
