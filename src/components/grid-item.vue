<script setup lang="ts">
import {
  computed,
  inject,
  onBeforeMount,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  toRef,
  watch,
  watchEffect,
} from 'vue'

import { isNull, nextTickOnce, throttle } from '@vexip-ui/utils'
import {
  EMITTER_KEY,
  LAYOUT_KEY,
  setTopLeft,
  setTopRight,
  setTransform,
  setTransformRtl,
  useNameHelper,
} from '../helpers/common'
import { createCoreData, getControlPosition } from '../helpers/draggable'
import { getColsFromBreakpoint } from '../helpers/responsive'
import { getDocumentDir } from '../helpers/dom'

import interact from 'interactjs'

import type { GridItemProps } from './types'

const props = withDefaults(defineProps<GridItemProps>(), {
  isDraggable: undefined,
  isResizable: undefined,
  isBounded: undefined,
  static: false,
  minH: 1,
  minW: 1,
  maxH: Infinity,
  maxW: Infinity,
  dragIgnoreFrom: 'a, button',
  dragAllowFrom: undefined,
  resizeIgnoreFrom: 'a, button',
  preserveAspectRatio: false,
  dragOption: () => ({}),
  resizeOption: () => ({}),
})

const emit = defineEmits(['container-resized', 'resize', 'resized', 'move', 'moved'])

const layout = inject(LAYOUT_KEY)
const emitter = inject(EMITTER_KEY)!

if (!layout) {
  throw new Error('[grid-layout-plus]: missing layout store, GridItem must under a GridLayout.')
}

const interactObj = shallowRef<InstanceType<
  typeof import('@interactjs/types').Interactable
> | null>(null)

const state = reactive({
  cols: 1,
  containerWidth: 100,
  rowHeight: 30,
  margin: [10, 10],
  maxRows: Infinity,
  draggable: undefined as boolean | undefined,
  resizable: undefined as boolean | undefined,
  bounded: undefined as boolean | undefined,
  transformScale: 1,
  useCssTransforms: true,
  useStyleCursor: true,

  isDragging: false,
  dragging: {
    top: -1,
    left: -1,
  },
  isResizing: false,
  resizing: {
    width: -1,
    height: -1,
  },
  style: {} as Record<string, string>,
  rtl: false,
})

let dragEventSet = false
let resizeEventSet = false

let lastX = NaN
let lastY = NaN
let lastW = NaN
let lastH = NaN

let previousW = -1
let previousH = -1
let previousX = -1
let previousY = -1

let innerX = props.x
let innerY = props.y
let innerW = props.w
let innerH = props.h

const wrapper = ref<HTMLElement>()

const instance = reactive({
  i: toRef(props, 'i'),
  state,
  wrapper,
  calcXY,
})

function updateWidthHandler(width: number) {
  updateWidth(width)
}

function compactHandler() {
  compact()
}

function setDraggableHandler(isDraggable: boolean) {
  if (isNull(props.isDraggable)) {
    state.draggable = isDraggable
  }
}

function setResizableHandler(isResizable: boolean) {
  if (isNull(props.isResizable)) {
    state.resizable = isResizable
  }
}

function setBoundedHandler(isBounded: boolean) {
  if (isNull(props.isBounded)) {
    state.bounded = isBounded
  }
}

function setTransformScaleHandler(transformScale: number) {
  state.transformScale = transformScale
}

function setRowHeightHandler(rowHeight: number) {
  state.rowHeight = rowHeight
}

function setMaxRowsHandler(maxRows: number) {
  state.maxRows = maxRows
}

function directionchangeHandler() {
  state.rtl = getDocumentDir() === 'rtl'
  compact()
}

function setColNum(colNum: number) {
  state.cols = Math.floor(colNum)
}

layout.increaseItem(instance)

onBeforeMount(() => {
  state.rtl = getDocumentDir() === 'rtl'
})

onMounted(() => {
  if (layout.responsive && layout.lastBreakpoint) {
    state.cols = getColsFromBreakpoint(layout.lastBreakpoint, layout.cols)
  } else {
    state.cols = layout.colNum
  }
  state.rowHeight = layout.rowHeight
  state.containerWidth = layout.width !== null ? layout.width : 100
  state.margin = layout.margin !== undefined ? layout.margin.map(Number) : [10, 10]
  state.maxRows = layout.maxRows

  if (isNull(props.isDraggable)) {
    state.draggable = layout.isDraggable
  } else {
    state.draggable = props.isDraggable
  }
  if (isNull(props.isResizable)) {
    state.resizable = layout.isResizable
  } else {
    state.resizable = props.isResizable
  }
  if (isNull(props.isBounded)) {
    state.bounded = layout.isBounded
  } else {
    state.bounded = props.isBounded
  }
  state.transformScale = layout.transformScale
  state.useCssTransforms = layout.useCssTransforms
  state.useStyleCursor = layout.useStyleCursor

  watchEffect(() => {
    innerX = props.x
    innerY = props.y
    innerH = props.h
    innerW = props.w
    nextTickOnce(createStyle)
  })

  emitter.on('updateWidth', updateWidthHandler)
  emitter.on('compact', compactHandler)
  emitter.on('setDraggable', setDraggableHandler)
  emitter.on('setResizable', setResizableHandler)
  emitter.on('setBounded', setBoundedHandler)
  emitter.on('setTransformScale', setTransformScaleHandler)
  emitter.on('setRowHeight', setRowHeightHandler)
  emitter.on('setMaxRows', setMaxRowsHandler)
  emitter.on('directionchange', directionchangeHandler)
  emitter.on('setColNum', setColNum)
})

onBeforeUnmount(() => {
  emitter.off('updateWidth', updateWidthHandler)
  emitter.off('compact', compactHandler)
  emitter.off('setDraggable', setDraggableHandler)
  emitter.off('setResizable', setResizableHandler)
  emitter.off('setBounded', setBoundedHandler)
  emitter.off('setTransformScale', setTransformScaleHandler)
  emitter.off('setRowHeight', setRowHeightHandler)
  emitter.off('setMaxRows', setMaxRowsHandler)
  emitter.off('directionchange', directionchangeHandler)
  emitter.off('setColNum', setColNum)

  if (interactObj.value) {
    interactObj.value.unset()
    interactObj.value = null
  }

  layout.decreaseItem(instance)
})

defineExpose({ state, wrapper })

const isAndroid =
  typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase().includes('android') : false

const resizableAndNotStatic = computed(() => state.resizable && !props.static)
const renderRtl = computed(() => (layout.isMirrored ? !state.rtl : state.rtl))
const draggableOrResizableAndNotStatic = computed(() => {
  return (state.draggable || state.resizable) && !props.static
})

const nh = useNameHelper('item')

const className = computed(() => {
  return {
    [nh.b()]: true,
    [nh.bm('resizable')]: resizableAndNotStatic.value,
    [nh.bm('static')]: props.static,
    [nh.bm('resizing')]: state.isResizing,
    [nh.bm('dragging')]: state.isDragging,
    [nh.bm('transform')]: state.useCssTransforms,
    [nh.bm('rtl')]: renderRtl.value,
    [nh.bm('no-touch')]: isAndroid && draggableOrResizableAndNotStatic.value,
  }
})
const resizerClass = computed(() => {
  // return renderRtl.value ? 'vue-resizable-handle vue-rtl-resizable-handle' : 'vue-resizable-handle'
  return [nh.be('resizer'), renderRtl.value && nh.bem('resizer', 'rtl')].filter(Boolean)
})

watch(
  () => props.isDraggable,
  value => {
    state.draggable = value
  },
)
watch(
  () => props.static,
  () => {
    nextTickOnce(tryMakeDraggable)
    nextTickOnce(tryMakeResizable)
  },
)
watch(
  () => state.draggable,
  () => {
    nextTickOnce(tryMakeDraggable)
  },
)
watch(
  () => props.isResizable,
  value => {
    state.resizable = value
  },
)
watch(
  () => props.isBounded,
  value => {
    state.bounded = value
  },
)
watch(
  () => state.resizable,
  () => {
    nextTickOnce(tryMakeResizable)
  },
)
watch(
  () => state.rowHeight,
  () => {
    nextTickOnce(createStyle)
    nextTickOnce(emitContainerResized)
  },
)
watch([() => state.cols, () => state.containerWidth], () => {
  nextTickOnce(tryMakeResizable)
  nextTickOnce(createStyle)
  nextTickOnce(emitContainerResized)
})
watch([() => props.minH, () => props.maxH, () => props.minW, () => props.maxW], () => {
  nextTickOnce(tryMakeResizable)
})
watch(renderRtl, () => {
  nextTickOnce(tryMakeResizable)
  nextTickOnce(createStyle)
})
watch([() => layout.margin, () => layout.margin[0], () => layout.margin[1]], () => {
  const margin = layout.margin

  if (!margin || (margin[0] === state.margin[0] && margin[1] === state.margin[1])) {
    return
  }

  state.margin = margin.map(Number)
  nextTickOnce(createStyle)
  nextTickOnce(emitContainerResized)
})

function createStyle() {
  if (props.x + props.w > state.cols) {
    innerX = 0
    innerW = props.w > state.cols ? state.cols : props.w
  } else {
    innerX = props.x
    innerW = props.w
  }

  const pos = calcPosition(innerX, innerY, innerW, innerH)

  if (state.isDragging) {
    pos.top = state.dragging.top
    // Add rtl support
    if (renderRtl.value) {
      pos.right = state.dragging.left
    } else {
      pos.left = state.dragging.left
    }
  }
  if (state.isResizing) {
    pos.width = state.resizing.width
    pos.height = state.resizing.height
  }

  let style
  // CSS Transforms support (default)
  if (state.useCssTransforms) {
    // Add rtl support
    if (renderRtl.value) {
      style = setTransformRtl(pos.top, pos.right!, pos.width, pos.height)
    } else {
      style = setTransform(pos.top, pos.left!, pos.width, pos.height)
    }
  } else {
    // top,left (slow)
    // Add rtl support
    if (renderRtl.value) {
      style = setTopRight(pos.top, pos.right!, pos.width, pos.height)
    } else {
      style = setTopLeft(pos.top, pos.left!, pos.width, pos.height)
    }
  }

  state.style = style
}

function emitContainerResized() {
  // this.style has width and height with trailing 'px'. The
  // resized event is without them
  const styleProps: Record<string, string> = {}
  for (const prop of ['width', 'height']) {
    const val = state.style[prop]
    const matches = val.match(/^(\d+)px$/)
    if (!matches) {
      return
    }
    styleProps[prop] = matches[1]
  }
  emit('container-resized', props.i, props.h, props.w, styleProps.height, styleProps.width)
}

function handleResize(event: MouseEvent & { edges: any }) {
  if (props.static) return

  const type = event.type
  if (
    (type === 'resizestart' && state.isResizing) ||
    (type !== 'resizestart' && !state.isResizing)
  ) {
    return
  }

  const position = getControlPosition(event)
  // Get the current drag point from the event. This is used as the offset.
  if (isNull(position)) return // not possible but satisfies flow

  const { x, y } = position
  const newSize = { width: 0, height: 0 }
  let pos
  switch (type) {
    case 'resizestart': {
      tryMakeResizable()
      previousW = innerW
      previousH = innerH
      pos = calcPosition(innerX, innerY, innerW, innerH)
      newSize.width = pos.width
      newSize.height = pos.height
      state.resizing = newSize
      state.isResizing = true
      break
    }
    case 'resizemove': {
      // A vertical resize ignores the horizontal delta
      if (!event.edges.right && !event.edges.left) {
        lastW = x
      }

      // An horizontal resize ignores the vertical delta
      if (!event.edges.top && !event.edges.bottom) {
        lastH = y
      }

      const coreEvent = createCoreData(lastW, lastH, x, y)
      if (renderRtl.value) {
        newSize.width = state.resizing.width - coreEvent.deltaX / state.transformScale
      } else {
        newSize.width = state.resizing.width + coreEvent.deltaX / state.transformScale
      }
      newSize.height = state.resizing.height + coreEvent.deltaY / state.transformScale
      state.resizing = newSize
      break
    }
    case 'resizeend': {
      pos = calcPosition(innerX, innerY, innerW, innerH)
      newSize.width = pos.width
      newSize.height = pos.height

      state.resizing = { width: -1, height: -1 }
      state.isResizing = false
      break
    }
  }

  // Get new WH
  pos = calcWH(newSize.height, newSize.width)
  if (pos.w < props.minW) {
    pos.w = props.minW
  }
  if (pos.w > props.maxW) {
    pos.w = props.maxW
  }
  if (pos.h < props.minH) {
    pos.h = props.minH
  }
  if (pos.h > props.maxH) {
    pos.h = props.maxH
  }

  if (pos.h < 1) {
    pos.h = 1
  }
  if (pos.w < 1) {
    pos.w = 1
  }

  lastW = x
  lastH = y

  if (innerW !== pos.w || innerH !== pos.h) {
    emit('resize', props.i, pos.h, pos.w, newSize.height, newSize.width)
  }
  if (event.type === 'resizeend' && (previousW !== innerW || previousH !== innerH)) {
    emit('resized', props.i, pos.h, pos.w, newSize.height, newSize.width)
  }
  emitter.emit('resizeEvent', event.type, props.i, innerX, innerY, pos.h, pos.w)
}

function handleDrag(event: MouseEvent) {
  if (props.static || state.isResizing) return

  const type = event.type
  if ((type === 'dragstart' && state.isDragging) || (type !== 'dragstart' && !state.isDragging)) {
    return
  }

  const position = getControlPosition(event)

  // Get the current drag point from the event. This is used as the offset.
  if (isNull(position)) return // not possible but satisfies flow
  const { x, y } = position
  const target = event.target as HTMLElement

  if (!target.offsetParent) return

  // let shouldUpdate = false;
  const newPosition = { top: 0, left: 0 }
  switch (type) {
    case 'dragstart': {
      previousX = innerX
      previousY = innerY

      const parentRect = target.offsetParent.getBoundingClientRect()
      const clientRect = target.getBoundingClientRect()

      const cLeft = clientRect.left / state.transformScale
      const pLeft = parentRect.left / state.transformScale
      const cRight = clientRect.right / state.transformScale
      const pRight = parentRect.right / state.transformScale
      const cTop = clientRect.top / state.transformScale
      const pTop = parentRect.top / state.transformScale

      if (renderRtl.value) {
        newPosition.left = (cRight - pRight) * -1
      } else {
        newPosition.left = cLeft - pLeft
      }
      newPosition.top = cTop - pTop
      state.dragging = newPosition
      state.isDragging = true
      break
    }
    case 'dragmove': {
      const coreEvent = createCoreData(lastX, lastY, x, y)
      // Add rtl support
      if (renderRtl.value) {
        newPosition.left = state.dragging.left - coreEvent.deltaX / state.transformScale
      } else {
        newPosition.left = state.dragging.left + coreEvent.deltaX / state.transformScale
      }
      newPosition.top = state.dragging.top + coreEvent.deltaY / state.transformScale
      if (state.bounded) {
        const bottomBoundary =
          target.offsetParent.clientHeight -
          calcGridItemWHPx(props.h, state.rowHeight, state.margin[1])
        newPosition.top = clamp(newPosition.top, 0, bottomBoundary)
        const colWidth = calcColWidth()
        const rightBoundary =
          state.containerWidth - calcGridItemWHPx(props.w, colWidth, state.margin[0])
        newPosition.left = clamp(newPosition.left, 0, rightBoundary)
      }

      state.dragging = newPosition
      break
    }
    case 'dragend': {
      const parentRect = target.offsetParent.getBoundingClientRect()
      const clientRect = target.getBoundingClientRect()

      const cLeft = clientRect.left / state.transformScale
      const pLeft = parentRect.left / state.transformScale
      const cRight = clientRect.right / state.transformScale
      const pRight = parentRect.right / state.transformScale
      const cTop = clientRect.top / state.transformScale
      const pTop = parentRect.top / state.transformScale

      // Add rtl support
      if (renderRtl.value) {
        newPosition.left = (cRight - pRight) * -1
      } else {
        newPosition.left = cLeft - pLeft
      }
      newPosition.top = cTop - pTop
      state.dragging = { top: -1, left: -1 }
      state.isDragging = false
      break
    }
  }

  // Get new XY
  let pos
  if (renderRtl.value) {
    pos = calcXY(newPosition.top, newPosition.left)
  } else {
    pos = calcXY(newPosition.top, newPosition.left)
  }

  lastX = x
  lastY = y

  if (innerX !== pos.x || innerY !== pos.y) {
    emit('move', props.i, pos.x, pos.y)
  }
  if (event.type === 'dragend' && (previousX !== innerX || previousY !== innerY)) {
    emit('moved', props.i, pos.x, pos.y)
  }
  emitter.emit('dragEvent', event.type, props.i, pos.x, pos.y, innerH, innerW)
}

function calcPosition(x: number, y: number, w: number, h: number) {
  const colWidth = calcColWidth()
  // add rtl support
  let out
  if (renderRtl.value) {
    out = {
      right: Math.round(colWidth * x + (x + 1) * state.margin[0]),
      top: Math.round(state.rowHeight * y + (y + 1) * state.margin[1]),
      // 0 * Infinity === NaN, which causes problems with resize constraints;
      // Fix this if it occurs.
      // Note we do it here rather than later because Math.round(Infinity) causes depot
      width: w === Infinity ? w : Math.round(colWidth * w + Math.max(0, w - 1) * state.margin[0]),
      height:
        h === Infinity ? h : Math.round(state.rowHeight * h + Math.max(0, h - 1) * state.margin[1]),
    }
  } else {
    out = {
      left: Math.round(colWidth * x + (x + 1) * state.margin[0]),
      top: Math.round(state.rowHeight * y + (y + 1) * state.margin[1]),
      // 0 * Infinity === NaN, which causes problems with resize constraints;
      // Fix this if it occurs.
      // Note we do it here rather than later because Math.round(Infinity) causes depot
      width: w === Infinity ? w : Math.round(colWidth * w + Math.max(0, w - 1) * state.margin[0]),
      height:
        h === Infinity ? h : Math.round(state.rowHeight * h + Math.max(0, h - 1) * state.margin[1]),
    }
  }

  return out
}

/**
 * Translate x and y coordinates from pixels to grid units.
 * @param top  Top position (relative to parent) in pixels.
 * @param left Left position (relative to parent) in pixels.
 * @return x and y in grid units.
 */
// TODO check if this function needs change in order to support rtl.
function calcXY(top: number, left: number) {
  const colWidth = calcColWidth()

  // left = colWidth * x + margin * (x + 1)
  // l = cx + m(x+1)
  // l = cx + mx + m
  // l - m = cx + mx
  // l - m = x(c + m)
  // (l - m) / (c + m) = x
  // x = (left - margin) / (coldWidth + margin)
  let x = Math.round((left - state.margin[0]) / (colWidth + state.margin[0]))
  let y = Math.round((top - state.margin[1]) / (state.rowHeight + state.margin[1]))

  // Capping
  x = Math.max(Math.min(x, state.cols - innerW), 0)
  y = Math.max(Math.min(y, state.maxRows - innerH), 0)

  return { x, y }
}

function calcColWidth() {
  return (state.containerWidth - state.margin[0] * (state.cols + 1)) / state.cols
}

function calcGridItemWHPx(gridUnits: number, colOrRowSize: number, marginPx: number) {
  // 0 * Infinity === NaN, which causes problems with resize constraints
  if (!Number.isFinite(gridUnits)) return gridUnits
  return Math.round(colOrRowSize * gridUnits + Math.max(0, gridUnits - 1) * marginPx)
}

function clamp(num: number, lowerBound: number, upperBound: number) {
  return Math.max(Math.min(num, upperBound), lowerBound)
}

/**
 * Given a height and width in pixel values, calculate grid units.
 * @param height Height in pixels.
 * @param width  Width in pixels.
 * @param autoSizeFlag  function autoSize identifier.
 * @return w, h as grid units.
 */
function calcWH(height: number, width: number, autoSizeFlag = false) {
  const colWidth = calcColWidth()

  // width = colWidth * w - (margin * (w - 1))
  // ...
  // w = (width + margin) / (colWidth + margin)
  let w = Math.round((width + state.margin[0]) / (colWidth + state.margin[0]))
  let h = 0
  if (!autoSizeFlag) {
    h = Math.round((height + state.margin[1]) / (state.rowHeight + state.margin[1]))
  } else {
    h = Math.ceil((height + state.margin[1]) / (state.rowHeight + state.margin[1]))
  }

  // Capping
  w = Math.max(Math.min(w, state.cols - innerX), 0)
  h = Math.max(Math.min(h, state.maxRows - innerY), 0)
  return { w, h }
}

function updateWidth(width: number, colNum?: number) {
  state.containerWidth = width
  if (colNum !== undefined && colNum !== null) {
    state.cols = colNum
  }
}

function compact() {
  createStyle()
}

function tryInteract() {
  if (!interactObj.value && wrapper.value) {
    interactObj.value = interact(wrapper.value)
    if (!state.useStyleCursor) {
      interactObj.value.styleCursor(false)
    }
  }
}

const throttleDrag = throttle(handleDrag)

function tryMakeDraggable() {
  tryInteract()

  if (!interactObj.value) return

  if (state.draggable && !props.static) {
    const opts = {
      ignoreFrom: props.dragIgnoreFrom,
      allowFrom: props.dragAllowFrom,
      ...props.dragOption,
    }
    interactObj.value.draggable(opts)

    if (!dragEventSet) {
      dragEventSet = true
      interactObj.value.on('dragstart dragmove dragend', event => {
        event.type === 'dragmove' ? throttleDrag(event) : handleDrag(event)
      })
    }
  } else {
    interactObj.value.draggable({ enabled: false })
  }
}

const throttleResize = throttle(handleResize)

function tryMakeResizable() {
  tryInteract()

  if (!interactObj.value) return

  if (state.resizable && !props.static) {
    const maximum = calcPosition(0, 0, props.maxW, props.maxH)
    const minimum = calcPosition(0, 0, props.minW, props.minH)

    const opts: Record<string, any> = {
      edges: {
        left: renderRtl.value ? `.${resizerClass.value[0]}` : false,
        right: !renderRtl.value ? `.${resizerClass.value[0]}` : false,
        bottom: `.${resizerClass.value[0]}`,
        top: false,
      },
      ignoreFrom: props.resizeIgnoreFrom,
      restrictSize: {
        min: {
          height: minimum.height * state.transformScale,
          width: minimum.width * state.transformScale,
        },
        max: {
          height: maximum.height * state.transformScale,
          width: maximum.width * state.transformScale,
        },
      },
      ...props.resizeOption,
    }

    if (props.preserveAspectRatio) {
      opts.modifiers = [interact.modifiers.aspectRatio({ ratio: 'preserve' })]
    }

    interactObj.value.resizable(opts)
    if (!resizeEventSet) {
      resizeEventSet = true
      interactObj.value.on('resizestart resizemove resizeend', event => {
        event.type === 'resizemove' ? throttleResize(event) : handleResize(event)
      })
    }
  } else {
    interactObj.value.resizable({ enabled: false })
  }
}
</script>

<template>
  <section ref="wrapper" :class="className" :style="state.style">
    <slot></slot>
    <span v-if="resizableAndNotStatic" :class="resizerClass"></span>
  </section>
</template>
