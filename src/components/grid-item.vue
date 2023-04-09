<script setup lang="ts">
import { ref, reactive, toRef, computed, watch, inject, onBeforeMount, onMounted, onBeforeUnmount } from 'vue'
import { LAYOUT_KEY, EMITTER_KEY, setTopLeft, setTopRight, setTransformRtl, setTransform } from '../helpers/common'
import { getControlPosition, createCoreData } from '../helpers/draggable'
import { getColsFromBreakpoint } from '../helpers/responsive'
import { getDocumentDir } from '../helpers/dom'

import interact from 'interactjs'

const props = defineProps({
  isDraggable: {
    type: Boolean,
    default: null
  },
  isResizable: {
    type: Boolean,
    default: null
  },
  isBounded: {
    type: Boolean,
    default: null
  },
  static: {
    type: Boolean,
    default: false
  },
  minH: {
    type: Number,
    default: 1
  },
  minW: {
    type: Number,
    default: 1
  },
  maxH: {
    type: Number,
    default: Infinity
  },
  maxW: {
    type: Number,
    default: Infinity
  },
  x: {
    type: Number,
    required: true
  },
  y: {
    type: Number,
    required: true
  },
  w: {
    type: Number,
    required: true
  },
  h: {
    type: Number,
    required: true
  },
  i: {
    type: [Number, String],
    required: true
  },
  dragIgnoreFrom: {
    type: String,
    default: 'a, button'
  },
  dragAllowFrom: {
    type: String,
    default: null
  },
  resizeIgnoreFrom: {
    type: String,
    default: 'a, button'
  },
  preserveAspectRatio: {
    type: Boolean,
    default: false
  },
  dragOption: {
    type: Object,
    default: () => ({})
  },
  resizeOption: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits([
  'container-resized',
  'resize',
  'resized',
  'move',
  'moved'
])

const layout = inject(LAYOUT_KEY)!
const emitter = inject(EMITTER_KEY)!

const interactObj = ref<ReturnType<typeof interact> | null>(null)

const state = reactive({
  cols: 1,
  containerWidth: 100,
  rowHeight: 30,
  margin: [10, 10],
  maxRows: Infinity,
  draggable: null as boolean | null,
  resizable: null as boolean | null,
  bounded: null as boolean | null,
  transformScale: 1,
  useCssTransforms: true,
  useStyleCursor: true,

  isDragging: false,
  dragging: {
    top: -1,
    left: -1
  },
  isResizing: false,
  resizing: {
    width: -1,
    height: -1
  },
  lastX: NaN,
  lastY: NaN,
  lastW: NaN,
  lastH: NaN,
  style: {} as Record<string, string>,
  rtl: false,

  dragEventSet: false,
  resizeEventSet: false,

  previousW: -1,
  previousH: -1,
  previousX: -1,
  previousY: -1,
  innerX: props.x,
  innerY: props.y,
  innerW: props.w,
  innerH: props.h
})

const wrapper = ref<HTMLElement>()

const instance = reactive({
  i: toRef(props, 'i'),
  state,
  wrapper,
  calcXY
})

function updateWidthHandler(width: number) {
  updateWidth(width)
}

function compactHandler() {
  compact()
}

function setDraggableHandler(isDraggable: boolean) {
  if (props.isDraggable === null) {
    state.draggable = isDraggable
  }
}

function setResizableHandler(isResizable: boolean) {
  if (props.isResizable === null) {
    state.resizable = isResizable
  }
}

function setBoundedHandler(isBounded: boolean) {
  if (props.isBounded === null) {
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
  state.margin = layout.margin !== undefined ? layout.margin : [10, 10]
  state.maxRows = layout.maxRows

  if (props.isDraggable === null) {
    state.draggable = layout.isDraggable
  } else {
    state.draggable = props.isDraggable
  }
  if (props.isResizable === null) {
    state.resizable = layout.isResizable
  } else {
    state.resizable = props.isResizable
  }
  if (props.isBounded === null) {
    state.bounded = layout.isBounded
  } else {
    state.bounded = props.isBounded
  }
  state.transformScale = layout.transformScale
  state.useCssTransforms = layout.useCssTransforms
  state.useStyleCursor = layout.useStyleCursor
  createStyle()
})

defineExpose({ state, wrapper })

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
    interactObj.value.unset() // destroy interact intance
    interactObj.value = null
  }

  layout.decreaseItem(instance)
})

const isAndroid = navigator.userAgent.toLowerCase().includes('android')

const resizableAndNotStatic = computed(() => {
  return state.resizable && !props.static
})
const renderRtl = computed(() => {
  return layout.isMirrored ? !state.rtl : state.rtl
})
const draggableOrResizableAndNotStatic = computed(() => {
  return (state.draggable || state.resizable) && !props.static
})
const classObj = computed(() => {
  return {
    'vue-resizable': resizableAndNotStatic.value,
    static: props.static,
    resizing: state.isResizing,
    'vue-draggable-dragging': state.isDragging,
    'css-transforms': state.useCssTransforms,
    'render-rtl': renderRtl.value,
    'disable-userselect': state.isDragging,
    'no-touch': isAndroid && draggableOrResizableAndNotStatic.value
  }
})
const resizableHandleClass = computed(() => {
  return renderRtl.value
    ? 'vue-resizable-handle vue-rtl-resizable-handle'
    : 'vue-resizable-handle'
})

watch(() => props.isDraggable, value => {
  state.draggable = value
})
watch(() => props.static, () => {
  tryMakeDraggable()
  tryMakeResizable()
})
watch(() => state.draggable, () => {
  tryMakeDraggable()
})
watch(() => props.isResizable, value => {
  state.resizable = value
})
watch(() => props.isBounded, value => {
  state.bounded = value
})
watch(() => state.resizable, () => {
  tryMakeResizable()
})
watch(() => state.rowHeight, () => {
  createStyle()
  emitContainerResized()
})
watch(() => state.cols, () => {
  tryMakeResizable()
  createStyle()
  emitContainerResized()
})
watch(() => state.containerWidth, () => {
  tryMakeResizable()
  createStyle()
  emitContainerResized()
})
watch(() => props.x, (value) => {
  state.innerX = value
  createStyle()
})
watch(() => props.y, (value) => {
  state.innerY = value
  createStyle()
})
watch(() => props.h, (value) => {
  state.innerH = value
  createStyle()
})
watch(() => props.w, (value) => {
  state.innerW = value
  createStyle()
})
watch(renderRtl, () => {
  tryMakeResizable()
  createStyle()
})
watch(() => props.minH, () => {
  tryMakeResizable()
})
watch(() => props.maxH, () => {
  tryMakeResizable()
})
watch(() => props.minW, () => {
  tryMakeResizable()
})
watch(() => props.maxW, () => {
  tryMakeResizable()
})
watch(() => layout.margin, value => {
  if (!value || (value[0] === state.margin[0] && value[1] === state.margin[1])) {
    return
  }
  state.margin = value.map(m => Number(m))
  createStyle()
  emitContainerResized()
})

function createStyle() {
  if (props.x + props.w > state.cols) {
    state.innerX = 0
    state.innerW = (props.w > state.cols) ? state.cols : props.w
  } else {
    state.innerX = props.x
    state.innerW = props.w
  }

  const pos = calcPosition(state.innerX, state.innerY, state.innerW, state.innerH)

  if (state.isDragging) {
    pos.top = state.dragging.top
    //                    Add rtl support
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
    //                    Add rtl support
    if (renderRtl.value) {
      style = setTransformRtl(pos.top, pos.right!, pos.width, pos.height)
    } else {
      style = setTransform(pos.top, pos.left!, pos.width, pos.height)
    }
  } else { // top,left (slow)
    //                    Add rtl support
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
    if (!matches) { return }
    styleProps[prop] = matches[1]
  }
  emit('container-resized', props.i, props.h, props.w, styleProps.height, styleProps.width)
}

function handleResize(event: MouseEvent) {
  if (props.static) return
  const position = getControlPosition(event)
  // Get the current drag point from the event. This is used as the offset.
  if (position == null) return // not possible but satisfies flow
  const { x, y } = position

  const newSize = { width: 0, height: 0 }
  let pos
  switch (event.type) {
    case 'resizestart': {
      tryMakeResizable()
      state.previousW = state.innerW
      state.previousH = state.innerH
      pos = calcPosition(state.innerX, state.innerY, state.innerW, state.innerH)
      newSize.width = pos.width
      newSize.height = pos.height
      state.resizing = newSize
      state.isResizing = true
      break
    }
    case 'resizemove': {
      //                        console.log("### resize => " + event.type + ", lastW=" + this.lastW + ", lastH=" + this.lastH);
      const coreEvent = createCoreData(state.lastW, state.lastH, x, y)
      if (renderRtl.value) {
        newSize.width = state.resizing.width - coreEvent.deltaX / state.transformScale
      } else {
        newSize.width = state.resizing.width + coreEvent.deltaX / state.transformScale
      }
      newSize.height = state.resizing.height + coreEvent.deltaY / state.transformScale

      /// console.log("### resize => " + event.type + ", deltaX=" + coreEvent.deltaX + ", deltaY=" + coreEvent.deltaY);
      state.resizing = newSize
      break
    }
    case 'resizeend': {
      // console.log("### resize end => x=" +this.innerX + " y=" + this.innerY + " w=" + this.innerW + " h=" + this.innerH);
      pos = calcPosition(state.innerX, state.innerY, state.innerW, state.innerH)
      newSize.width = pos.width
      newSize.height = pos.height
      //                        console.log("### resize end => " + JSON.stringify(newSize));
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

  state.lastW = x
  state.lastH = y

  if (state.innerW !== pos.w || state.innerH !== pos.h) {
    emit('resize', props.i, pos.h, pos.w, newSize.height, newSize.width)
  }
  if (event.type === 'resizeend' && (state.previousW !== state.innerW || state.previousH !== state.innerH)) {
    emit('resized', props.i, pos.h, pos.w, newSize.height, newSize.width)
  }
  emitter.emit('resizeEvent', event.type, props.i, state.innerX, state.innerY, pos.h, pos.w)
}

function handleDrag(event: MouseEvent) {
  if (props.static || state.isResizing) return

  const position = getControlPosition(event)

  // Get the current drag point from the event. This is used as the offset.
  if (position === null) return // not possible but satisfies flow
  const { x, y } = position
  const target = event.target as HTMLElement

  if (!target.offsetParent) return

  // let shouldUpdate = false;
  const newPosition = { top: 0, left: 0 }
  switch (event.type) {
    case 'dragstart': {
      state.previousX = state.innerX
      state.previousY = state.innerY

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
    case 'dragend': {
      if (!state.isDragging) return
      const parentRect = target.offsetParent.getBoundingClientRect()
      const clientRect = target.getBoundingClientRect()

      const cLeft = clientRect.left / state.transformScale
      const pLeft = parentRect.left / state.transformScale
      const cRight = clientRect.right / state.transformScale
      const pRight = parentRect.right / state.transformScale
      const cTop = clientRect.top / state.transformScale
      const pTop = parentRect.top / state.transformScale

      //                        Add rtl support
      if (renderRtl.value) {
        newPosition.left = (cRight - pRight) * -1
      } else {
        newPosition.left = cLeft - pLeft
      }
      newPosition.top = cTop - pTop
      //                        console.log("### drag end => " + JSON.stringify(newPosition));
      //                        console.log("### DROP: " + JSON.stringify(newPosition));
      state.dragging = { top: -1, left: -1 }
      state.isDragging = false
      // shouldUpdate = true;
      break
    }
    case 'dragmove': {
      const coreEvent = createCoreData(state.lastX, state.lastY, x, y)
      //                        Add rtl support
      if (renderRtl.value) {
        newPosition.left = state.dragging.left - coreEvent.deltaX / state.transformScale
      } else {
        newPosition.left = state.dragging.left + coreEvent.deltaX / state.transformScale
      }
      newPosition.top = state.dragging.top + coreEvent.deltaY / state.transformScale
      if (state.bounded) {
        const bottomBoundary = target.offsetParent.clientHeight - calcGridItemWHPx(props.h, state.rowHeight, state.margin[1])
        newPosition.top = clamp(newPosition.top, 0, bottomBoundary)
        const colWidth = calcColWidth()
        const rightBoundary = state.containerWidth - calcGridItemWHPx(props.w, colWidth, state.margin[0])
        newPosition.left = clamp(newPosition.left, 0, rightBoundary)
      }
      //                        console.log("### drag => " + event.type + ", x=" + x + ", y=" + y);
      //                        console.log("### drag => " + event.type + ", deltaX=" + coreEvent.deltaX + ", deltaY=" + coreEvent.deltaY);
      //                        console.log("### drag end => " + JSON.stringify(newPosition));
      state.dragging = newPosition
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

  state.lastX = x
  state.lastY = y

  if (state.innerX !== pos.x || state.innerY !== pos.y) {
    emit('move', props.i, pos.x, pos.y)
  }
  if (event.type === 'dragend' && (state.previousX !== state.innerX || state.previousY !== state.innerY)) {
    emit('moved', props.i, pos.x, pos.y)
  }
  emitter.emit('dragEvent', event.type, props.i, pos.x, pos.y, state.innerH, state.innerW)
}

function calcPosition(x: number, y: number, w: number, h: number) {
  const colWidth = calcColWidth()
  // add rtl support
  let out
  if (renderRtl.value) {
    out = {
      right: Math.round(colWidth * x + (x + 1) * state.margin[0]),
      top: Math.round(state.rowHeight * y + (y + 1) * state.margin[1]),
      // 0 * Infinity === NaN, which causes problems with resize constriants;
      // Fix this if it occurs.
      // Note we do it here rather than later because Math.round(Infinity) causes deopt
      width: w === Infinity ? w : Math.round(colWidth * w + Math.max(0, w - 1) * state.margin[0]),
      height: h === Infinity ? h : Math.round(state.rowHeight * h + Math.max(0, h - 1) * state.margin[1])
    }
  } else {
    out = {
      left: Math.round(colWidth * x + (x + 1) * state.margin[0]),
      top: Math.round(state.rowHeight * y + (y + 1) * state.margin[1]),
      // 0 * Infinity === NaN, which causes problems with resize constriants;
      // Fix this if it occurs.
      // Note we do it here rather than later because Math.round(Infinity) causes deopt
      width: w === Infinity ? w : Math.round(colWidth * w + Math.max(0, w - 1) * state.margin[0]),
      height: h === Infinity ? h : Math.round(state.rowHeight * h + Math.max(0, h - 1) * state.margin[1])
    }
  }

  return out
}

/**
 * Translate x and y coordinates from pixels to grid units.
 * @param   top  Top position (relative to parent) in pixels.
 * @param   left Left position (relative to parent) in pixels.
 * @return  x and y in grid units.
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
  x = Math.max(Math.min(x, state.cols - state.innerW), 0)
  y = Math.max(Math.min(y, state.maxRows - state.innerH), 0)

  return { x, y }
}

function calcColWidth() {
  const colWidth = (state.containerWidth - (state.margin[0] * (state.cols + 1))) / state.cols
  // console.log("### COLS=" + this.cols + " COL WIDTH=" + colWidth + " MARGIN " + this.margin[0]);
  return colWidth
}

function calcGridItemWHPx(gridUnits: number, colOrRowSize: number, marginPx: number) {
  // 0 * Infinity === NaN, which causes problems with resize contraints
  if (!Number.isFinite(gridUnits)) return gridUnits
  return Math.round(
    colOrRowSize * gridUnits + Math.max(0, gridUnits - 1) * marginPx
  )
}

function clamp(num: number, lowerBound: number, upperBound: number) {
  return Math.max(Math.min(num, upperBound), lowerBound)
}

/**
 * Given a height and width in pixel values, calculate grid units.
 * @param   height Height in pixels.
 * @param   width  Width in pixels.
 * @param   autoSizeFlag  function autoSize identifier.
 * @return  w, h as grid units.
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
  w = Math.max(Math.min(w, state.cols - state.innerX), 0)
  h = Math.max(Math.min(h, state.maxRows - state.innerY), 0)
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

function tryMakeDraggable() {
  tryInteract()

  if (!interactObj.value) return

  if (state.draggable && !props.static) {
    const opts = {
      ignoreFrom: props.dragIgnoreFrom,
      allowFrom: props.dragAllowFrom,
      ...props.dragOption
    }
    interactObj.value.draggable(opts)
    /* interactObj.value.draggable({allowFrom: '.vue-draggable-handle'}); */
    if (!state.dragEventSet) {
      state.dragEventSet = true
      interactObj.value.on('dragstart dragmove dragend', (event) => {
        handleDrag(event)
      })
    }
  } else {
    interactObj.value.draggable({
      enabled: false
    })
  }
}

function tryMakeResizable() {
  tryInteract()

  if (!interactObj.value) return

  if (state.resizable && !props.static) {
    const maximum = calcPosition(0, 0, props.maxW, props.maxH)
    const minimum = calcPosition(0, 0, props.minW, props.minH)

    // console.log("### MAX " + JSON.stringify(maximum));
    // console.log("### MIN " + JSON.stringify(minimum));

    const opts: Record<string, any> = {
      // allowFrom: "." + this.resizableHandleClass.trim().replace(" ", "."),
      edges: {
        left: false,
        right: '.' + resizableHandleClass.value.trim().replace(' ', '.'),
        bottom: '.' + resizableHandleClass.value.trim().replace(' ', '.'),
        top: false
      },
      ignoreFrom: props.resizeIgnoreFrom,
      restrictSize: {
        min: {
          height: minimum.height * state.transformScale,
          width: minimum.width * state.transformScale
        },
        max: {
          height: maximum.height * state.transformScale,
          width: maximum.width * state.transformScale
        }
      },
      ...props.resizeOption
    }

    if (props.preserveAspectRatio) {
      opts.modifiers = [
        interact.modifiers.aspectRatio({
          ratio: 'preserve'
        })
      ]
    }

    interactObj.value.resizable(opts)
    if (!state.resizeEventSet) {
      state.resizeEventSet = true
      interactObj.value
        .on('resizestart resizemove resizeend', (event) => {
          handleResize(event)
        })
    }
  } else {
    interactObj.value.resizable({
      enabled: false
    })
  }
}

// function autoSize() {
//   // ok here we want to calculate if a resize is needed
//   state.previousW = state.innerW
//   state.previousH = state.innerH

//   const newSize = this.$slots.default[0].elm.getBoundingClientRect()
//   const pos = calcWH(newSize.height, newSize.width, true)
//   if (pos.w < props.minW) {
//     pos.w = props.minW
//   }
//   if (pos.w > props.maxW) {
//     pos.w = props.maxW
//   }
//   if (pos.h < props.minH) {
//     pos.h = props.minH
//   }
//   if (pos.h > props.maxH) {
//     pos.h = props.maxH
//   }

//   if (pos.h < 1) {
//     pos.h = 1
//   }
//   if (pos.w < 1) {
//     pos.w = 1
//   }

//   // this.lastW = x; // basically, this is copied from resizehandler, but shouldn't be needed
//   // this.lastH = y;

//   if (state.innerW !== pos.w || state.innerH !== pos.h) {
//     emit('resize', props.i, pos.h, pos.w, newSize.height, newSize.width)
//   }
//   if (state.previousW !== pos.w || state.previousH !== pos.h) {
//     emit('resized', props.i, pos.h, pos.w, newSize.height, newSize.width)
//     emitter.emit('resizeEvent', 'resizeend', props.i, state.innerX, state.innerY, pos.h, pos.w)
//   }
// }
</script>

<template>
  <div
    ref="wrapper"
    class="vue-grid-item"
    :class="classObj"
    :style="state.style"
  >
    <slot></slot>
    <span v-if="resizableAndNotStatic" ref="handle" :class="resizableHandleClass"></span>
  </div>
</template>
