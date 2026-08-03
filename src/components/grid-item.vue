<script setup lang="ts">
import {
  computed,
  inject,
  onBeforeMount,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  reactive,
  ref,
  shallowRef,
  toRaw,
  toRef,
  watch,
  watchEffect,
} from 'vue'

import { isNull, nextTickOnce } from '@vexip-ui/utils'
import { EMITTER_KEY, LAYOUT_KEY, useNameHelper } from '../helpers/common'
import { GridLayoutValidationError } from '../core/errors'
import {
  createAbsoluteStyle,
  createTransformStyle,
  validatePositionGeometry,
  validateTransientPositionGeometry,
} from '../core/position-style'
import { createCoreData, getControlPosition } from '../helpers/draggable'
import { getColsFromBreakpoint } from '../helpers/responsive'
import { getDocumentDir } from '../helpers/dom'
import { snapshotInteractOption, snapshotInteractSelector } from '../helpers/interact-options'
import { gridToPixelRect, pixelSizeToGridSize, pointerToGridPosition } from '../core/utils'

import interact from 'interactjs'

import type { LayoutItem, PositionStrategy, ResizeHandleAxis } from '../helpers/types'
import type { GridItemEmits, GridItemProps, GridItemSlots } from './types'

const props = withDefaults(defineProps<GridItemProps>(), {
  isDraggable: undefined,
  isResizable: undefined,
  autoHeight: undefined,
  isBounded: undefined,
  static: false,
  x: 0,
  y: 0,
  w: 1,
  h: 1,
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
  dragThreshold: undefined,
  internal: false,
  decorative: false,
})

const emit = defineEmits<GridItemEmits>()
defineSlots<GridItemSlots>()

const injectedLayout = inject(LAYOUT_KEY)
const injectedEmitter = inject(EMITTER_KEY)

if (!injectedLayout || !injectedEmitter) {
  throw new GridLayoutValidationError('GridItem must be mounted under GridLayout', {
    code: 'invalid-config',
    path: 'gridItem.parent',
  })
}

const layout = injectedLayout
const emitter = injectedEmitter
const emptyInteractOption = Object.freeze(Object.create(null)) as Readonly<Record<string, unknown>>
const dragOptionSnapshot = shallowRef(emptyInteractOption)
const resizeOptionSnapshot = shallowRef(emptyInteractOption)
const dragIgnoreSelector = shallowRef<string>()
const dragAllowSelector = shallowRef<string>()
const resizeIgnoreSelector = shallowRef<string>()

const interactObj = shallowRef<InstanceType<
  typeof import('@interactjs/types').Interactable
> | null>(null)

const state = reactive({
  cols: 1,
  containerWidth: 100,
  rowHeight: 30,
  gap: [10, 10],
  containerPadding: [0, 0] as readonly [number, number],
  maxRows: Infinity,
  draggable: undefined as boolean | undefined,
  resizable: undefined as boolean | undefined,
  bounded: undefined as boolean | undefined,
  useStyleCursor: true,
  registered: props.internal,

  isDragging: false,
  dragging: {
    top: -1,
    left: -1,
  },
  isResizing: false,
  resizing: {
    width: -1,
    height: -1,
    top: -1,
    inlineStart: -1,
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

let previousX = -1
let previousY = -1

let innerX = 0
let innerY = 0
let innerW = 1
let innerH = 1
let boundedSnapshot: { maxLeft: number; maxTop: number } | null = null
let dragTerminalSnapshot: {
  initialX: number
  initialY: number
} | null = null
let resizeAspectSnapshot: {
  enabled: boolean
  ratio: number
  edges: {
    north: boolean
    east: boolean
    south: boolean
    west: boolean
  }
  initialX: number
  initialY: number
  initialW: number
  initialH: number
  initialTop: number
  initialInlineStart: number
  initialWidth: number
  initialHeight: number
  handlesSignature: string
  rawTop: number
  rawInlineStart: number
  rawWidth: number
  rawHeight: number
} | null = null
let resizeTerminalSnapshot: {
  initialX: number
  initialY: number
  initialW: number
  initialH: number
  candidateX: number
  candidateY: number
  candidateW: number
  candidateH: number
  pixelWidth: number
  pixelHeight: number
} | null = null
let dragTargetAllowed = false
let resizeTargetAllowed = false
let boundResizeHandlesSignature = ''

// 拖拽阈值相关状态
let dragStartPos: { x: number; y: number } | null = null
let dragThresholdExceeded = false

const wrapper = ref<HTMLElement>()
const effectiveItem = computed(() => layout.getLayoutItem(props.i))
const effectiveX = computed(() => effectiveItem.value?.x ?? props.x)
const effectiveY = computed(() => effectiveItem.value?.y ?? props.y)
const effectiveW = computed(() => effectiveItem.value?.w ?? props.w)
const effectiveH = computed(() => effectiveItem.value?.h ?? props.h)
const effectiveStatic = computed(() => effectiveItem.value?.static ?? false)
const effectiveMinW = computed(() => effectiveItem.value?.minW ?? 1)
const effectiveMinH = computed(() => effectiveItem.value?.minH ?? 1)
const effectiveMaxW = computed(() => effectiveItem.value?.maxW ?? Infinity)
const effectiveMaxH = computed(() => effectiveItem.value?.maxH ?? Infinity)
const configuredResizeHandles = computed<readonly ResizeHandleAxis[]>(
  () => effectiveItem.value?.resizeHandles ?? layout.resizeHandles,
)
const effectiveAutoHeight = computed(
  () => effectiveItem.value?.autoHeight ?? props.autoHeight ?? layout.autoHeight,
)
const renderedResizeHandles = computed<readonly ResizeHandleAxis[]>(() => {
  if (!effectiveAutoHeight.value) return configuredResizeHandles.value
  return configuredResizeHandles.value.filter(
    handle => handle.includes('e') || handle.includes('w'),
  )
})
const autoHeightResizeConflict = computed(
  () => effectiveAutoHeight.value && props.preserveAspectRatio,
)

const instance = reactive({
  i: toRef(props, 'i'),
  state,
  wrapper,
  calcXY,
  props,
  internal: props.internal,
  resetInteractionState,
  finishDragInteraction,
  finishResizeInteraction,
  refreshPositionStyle: createStyle,
  disableInteractionBinding,
})

try {
  dragOptionSnapshot.value = snapshotInteractOption(toRaw(props.dragOption), 'dragOption')
  resizeOptionSnapshot.value = snapshotInteractOption(toRaw(props.resizeOption), 'resizeOption')
  dragIgnoreSelector.value = snapshotInteractSelector(props.dragIgnoreFrom, 'dragIgnoreFrom')
  dragAllowSelector.value = snapshotInteractSelector(props.dragAllowFrom, 'dragAllowFrom')
  resizeIgnoreSelector.value = snapshotInteractSelector(props.resizeIgnoreFrom, 'resizeIgnoreFrom')
} catch (error) {
  if (error instanceof GridLayoutValidationError) {
    const type = error.path.includes('resize') ? 'resize' : 'drag'
    layout.handleItemConfigChange(instance, type, error)
  }
  throw error
}

/** 获取当前生效的拖拽阈值 */
const effectiveDragThreshold = computed<number>(() => {
  return props.dragThreshold ?? layout.dragThreshold ?? 0
})

/** 获取当前生效的定位策略 */
const effectivePositionStrategy = computed<PositionStrategy>(() => {
  return layout.positionStrategy
})

/** CSS 层级使用父布局按稳定顺序生成的有限 rank。 */
const effectiveZIndex = computed(() => {
  return layout.getItemZIndex(props.i)
})

/** 将视口坐标还原到网格使用的未缩放坐标系 */
const transformScale = computed(() => effectivePositionStrategy.value.transformScale ?? 1)

/** 判断当前定位策略是否使用 CSS transforms */
const useCssTransforms = computed(() => {
  return effectivePositionStrategy.value.usesCssTransforms
})

function updateWidthHandler(width: number | null) {
  updateWidth(width)
}

function compactHandler() {
  compact()
}

function setDraggableHandler(isDraggable: boolean) {
  state.draggable = effectiveItem.value?.isDraggable ?? isDraggable
}

function setResizableHandler(isResizable: boolean) {
  state.resizable = effectiveItem.value?.isResizable ?? isResizable
}

function setBoundedHandler(isBounded: boolean) {
  if (isNull(props.isBounded)) {
    state.bounded = isBounded
  }
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

onBeforeMount(() => {
  state.rtl = getDocumentDir() === 'rtl'
})

onMounted(() => {
  if (!props.decorative) layout.increaseItem(instance)
  if (layout.responsive && layout.lastBreakpoint) {
    state.cols = getColsFromBreakpoint(layout.lastBreakpoint, layout.cols)
  } else {
    state.cols = layout.colNum
  }
  state.rowHeight = layout.rowHeight
  state.containerWidth = layout.width !== null ? layout.width : 100
  state.gap = layout.gap !== undefined ? layout.gap.map(Number) : [10, 10]
  state.containerPadding = layout.containerPadding
  state.maxRows = layout.maxRows

  state.draggable = effectiveItem.value?.isDraggable ?? layout.isDraggable
  state.resizable = effectiveItem.value?.isResizable ?? layout.isResizable
  if (isNull(props.isBounded)) {
    state.bounded = layout.isBounded
  } else {
    state.bounded = props.isBounded
  }
  state.useStyleCursor = layout.useStyleCursor
  nextTickOnce(createStyle)
  nextTickOnce(syncAutoHeightTarget)

  watchEffect(() => {
    innerX = effectiveX.value
    innerY = effectiveY.value
    innerH = effectiveH.value
    innerW = effectiveW.value
    state.draggable = effectiveItem.value?.isDraggable ?? layout.isDraggable
    state.resizable = effectiveItem.value?.isResizable ?? layout.isResizable
    nextTickOnce(createStyle)
  })

  emitter.on('updateWidth', updateWidthHandler)
  emitter.on('compact', compactHandler)
  emitter.on('setDraggable', setDraggableHandler)
  emitter.on('setResizable', setResizableHandler)
  emitter.on('setBounded', setBoundedHandler)
  emitter.on('setRowHeight', setRowHeightHandler)
  emitter.on('setMaxRows', setMaxRowsHandler)
  emitter.on('directionchange', directionchangeHandler)
  emitter.on('setColNum', setColNum)
})

onUpdated(() => {
  if (!props.decorative) {
    layout.updateItem(instance, props.i)
    syncAutoHeightTarget()
  }
})

onBeforeUnmount(() => {
  emitter.off('updateWidth', updateWidthHandler)
  emitter.off('compact', compactHandler)
  emitter.off('setDraggable', setDraggableHandler)
  emitter.off('setResizable', setResizableHandler)
  emitter.off('setBounded', setBoundedHandler)
  emitter.off('setRowHeight', setRowHeightHandler)
  emitter.off('setMaxRows', setMaxRowsHandler)
  emitter.off('directionchange', directionchangeHandler)
  emitter.off('setColNum', setColNum)

  if (interactObj.value) {
    interactObj.value.unset()
    interactObj.value = null
  }

  if (!props.decorative) {
    layout.removeAutoHeightItem(instance)
    layout.decreaseItem(instance)
  }
})

defineExpose({ state, wrapper })

const isAndroid =
  typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase().includes('android') : false

const resizableAndNotStatic = computed(
  () =>
    !props.decorative &&
    state.registered &&
    state.resizable &&
    renderedResizeHandles.value.length > 0 &&
    !effectiveStatic.value &&
    !autoHeightResizeConflict.value,
)
const renderRtl = computed(() => (layout.isMirrored ? !state.rtl : state.rtl))
const renderedResizeHandleDirection = (handle: ResizeHandleAxis): ResizeHandleAxis => {
  if (!renderRtl.value) return handle
  return handle.replace(/[ew]/g, direction => (direction === 'e' ? 'w' : 'e')) as ResizeHandleAxis
}
const draggableOrResizableAndNotStatic = computed(() => {
  return (
    !props.decorative &&
    state.registered &&
    (state.draggable || resizableAndNotStatic.value) &&
    !effectiveStatic.value
  )
})

const nh = useNameHelper('item')

const className = computed(() => {
  return {
    [nh.b()]: true,
    [nh.bm('resizable')]: resizableAndNotStatic.value,
    [nh.bm('static')]: effectiveStatic.value,
    [nh.bm('auto-height')]: effectiveAutoHeight.value,
    [nh.bm('resizing')]: state.isResizing,
    [nh.bm('dragging')]: state.isDragging,
    [nh.bm('transform')]: useCssTransforms.value,
    [nh.bm('rtl')]: renderRtl.value,
    [nh.bm('no-touch')]: isAndroid && draggableOrResizableAndNotStatic.value,
  }
})

watch(
  () => state.registered,
  registered => {
    nextTickOnce(createStyle)
    if (registered) nextTickOnce(emitContainerResized)
    nextTickOnce(syncAutoHeightTarget)
    nextTickOnce(tryMakeDraggable)
    nextTickOnce(tryMakeResizable)
  },
)
watch(
  () => props.i,
  (_, previousId) => {
    if (props.decorative) {
      state.registered = props.internal
      nextTickOnce(createStyle)
      return
    }
    state.registered = false
    state.style = {}
    layout.updateItem(instance, previousId)
  },
)
watch(effectiveStatic, () => {
  nextTickOnce(tryMakeDraggable)
  nextTickOnce(tryMakeResizable)
})
watch(effectiveAutoHeight, () => {
  layout.handleItemConfigChange(instance, 'resize')
  nextTickOnce(syncAutoHeightTarget)
  nextTickOnce(tryMakeResizable)
})
watch(
  () => state.draggable,
  () => {
    nextTickOnce(tryMakeDraggable)
  },
)
watch(
  () => props.isBounded,
  value => {
    const bounded = value ?? layout.isBounded
    if (Object.is(state.bounded, bounded)) return
    state.bounded = bounded
    layout.handleItemConfigChange(instance, 'drag')
  },
)
watch(
  () => state.resizable,
  () => {
    nextTickOnce(tryMakeResizable)
  },
)
watch(
  () => renderedResizeHandles.value.join('|'),
  signature => {
    if (props.decorative) return
    if (signature === resizeAspectSnapshot?.handlesSignature) return
    if (signature === boundResizeHandlesSignature) return
    layout.handleItemConfigChange(instance, 'resize')
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
watch([effectiveMinH, effectiveMaxH, effectiveMinW, effectiveMaxW], () => {
  nextTickOnce(tryMakeResizable)
})
watch(
  () => props.preserveAspectRatio,
  () => {
    layout.handleItemConfigChange(instance, 'resize')
    nextTickOnce(syncAutoHeightTarget)
    nextTickOnce(tryMakeResizable)
  },
)
watch(renderRtl, () => {
  nextTickOnce(tryMakeResizable)
  nextTickOnce(createStyle)
})
watch(effectivePositionStrategy, () => {
  nextTickOnce(tryMakeResizable)
  nextTickOnce(createStyle)
})
watch(
  () => [layout.positionStyleRevision, layout.positionStyleReady] as const,
  () => {
    createStyle()
    nextTickOnce(tryMakeDraggable)
    nextTickOnce(tryMakeResizable)
  },
)
watch(effectiveZIndex, () => {
  nextTickOnce(createStyle)
})
watch(
  () => props.dragOption,
  value => {
    try {
      const snapshot = snapshotInteractOption(toRaw(value), 'dragOption')
      layout.handleItemConfigChange(instance, 'drag')
      dragOptionSnapshot.value = snapshot
      nextTickOnce(tryMakeDraggable)
    } catch (error) {
      if (error instanceof GridLayoutValidationError) {
        layout.handleItemConfigChange(instance, 'drag', error)
        return
      }
      throw error
    }
  },
)
watch(
  () => props.resizeOption,
  value => {
    try {
      const snapshot = snapshotInteractOption(toRaw(value), 'resizeOption')
      layout.handleItemConfigChange(instance, 'resize')
      resizeOptionSnapshot.value = snapshot
      nextTickOnce(tryMakeResizable)
    } catch (error) {
      if (error instanceof GridLayoutValidationError) {
        layout.handleItemConfigChange(instance, 'resize', error)
        return
      }
      throw error
    }
  },
)
watch(
  () => props.dragIgnoreFrom,
  value => {
    try {
      const snapshot = snapshotInteractSelector(value, 'dragIgnoreFrom')
      layout.handleItemConfigChange(instance, 'drag')
      dragIgnoreSelector.value = snapshot
      nextTickOnce(tryMakeDraggable)
    } catch (error) {
      if (error instanceof GridLayoutValidationError) {
        layout.handleItemConfigChange(instance, 'drag', error)
        return
      }
      throw error
    }
  },
)
watch(
  () => props.dragAllowFrom,
  value => {
    try {
      const snapshot = snapshotInteractSelector(value, 'dragAllowFrom')
      layout.handleItemConfigChange(instance, 'drag')
      dragAllowSelector.value = snapshot
      nextTickOnce(tryMakeDraggable)
    } catch (error) {
      if (error instanceof GridLayoutValidationError) {
        layout.handleItemConfigChange(instance, 'drag', error)
        return
      }
      throw error
    }
  },
)
watch(
  () => props.resizeIgnoreFrom,
  value => {
    try {
      const snapshot = snapshotInteractSelector(value, 'resizeIgnoreFrom')
      layout.handleItemConfigChange(instance, 'resize')
      resizeIgnoreSelector.value = snapshot
      nextTickOnce(tryMakeResizable)
    } catch (error) {
      if (error instanceof GridLayoutValidationError) {
        layout.handleItemConfigChange(instance, 'resize', error)
        return
      }
      throw error
    }
  },
)
watch([() => layout.gap, () => layout.gap[0], () => layout.gap[1]], () => {
  const gap = layout.gap

  if (!gap || (gap[0] === state.gap[0] && gap[1] === state.gap[1])) {
    return
  }

  state.gap = gap.map(Number)
  nextTickOnce(createStyle)
  nextTickOnce(emitContainerResized)
})
watch(
  [
    () => layout.containerPadding,
    () => layout.containerPadding[0],
    () => layout.containerPadding[1],
  ],
  () => {
    const padding = layout.containerPadding
    if (padding[0] === state.containerPadding[0] && padding[1] === state.containerPadding[1]) {
      return
    }
    state.containerPadding = [padding[0], padding[1]]
    nextTickOnce(createStyle)
    nextTickOnce(emitContainerResized)
  },
)

function createStyle() {
  if (!state.registered) {
    state.style = {}
    return
  }

  if (!props.decorative && !state.isDragging && !state.isResizing) {
    state.style = { ...layout.getPositionStyle(props.i) }
    return
  }
  const renderedWidth = resolvedContainerWidth()
  if (
    renderedWidth <= 0 ||
    (props.decorative &&
      (!layout.positionStyleReady ||
        layout.width === null ||
        layout.width <= 0 ||
        !Number.isSafeInteger(effectiveW.value) ||
        effectiveW.value <= 0 ||
        !Number.isSafeInteger(effectiveH.value) ||
        effectiveH.value <= 0))
  ) {
    state.style = {}
    return
  }

  let x: number, y: number, w: number, h: number
  if (state.isResizing) {
    x = innerX
    y = innerY
    w = innerW
    h = innerH
  } else {
    if (effectiveX.value + effectiveW.value > state.cols) {
      x = 0
      w = effectiveW.value > state.cols ? state.cols : effectiveW.value
    } else {
      x = effectiveX.value
      w = effectiveW.value
    }
    y = effectiveY.value
    h = effectiveH.value
    innerX = x
    innerY = y
    innerW = w
    innerH = h
  }

  const pos = calcPosition(x, y, w, h)

  if (state.isDragging) {
    pos.top = state.dragging.top
    if (renderRtl.value) {
      pos.right = state.dragging.left
    } else {
      pos.left = state.dragging.left
    }
  }
  if (state.isResizing) {
    pos.top = state.resizing.top
    if (renderRtl.value) {
      pos.right = state.resizing.inlineStart
    } else {
      pos.left = state.resizing.inlineStart
    }
    pos.width = state.resizing.width
    pos.height = state.resizing.height
  }

  const transientGeometry = {
    top: pos.top,
    inlineStart: renderRtl.value ? pos.right : pos.left,
    width: pos.width,
    height: pos.height,
  }
  if (
    !Object.values(transientGeometry).every(
      value => typeof value === 'number' && Number.isFinite(value),
    )
  ) {
    state.style = props.decorative ? {} : { ...layout.getPositionStyle(props.i) }
    return
  }
  const direction = renderRtl.value ? 'rtl' : 'ltr'
  const width = Math.max(0, transientGeometry.width)
  const height = Math.max(0, transientGeometry.height)
  const geometry =
    state.isDragging && boundedSnapshot === null
      ? validateTransientPositionGeometry(
          transientGeometry.top,
          transientGeometry.inlineStart!,
          width,
          height,
          direction,
        )
      : validatePositionGeometry(
          Math.max(0, transientGeometry.top),
          Math.max(0, transientGeometry.inlineStart!),
          width,
          height,
          direction,
        )
  const positionedStyle = useCssTransforms.value
    ? createTransformStyle(geometry, direction)
    : createAbsoluteStyle(geometry, direction)
  let style: Record<string, string> = { ...positionedStyle }
  if (effectiveZIndex.value !== undefined) {
    style = {
      ...style,
      '--vgl-item-z-index': String(effectiveZIndex.value),
    }
  }

  state.style = style
}

function resetInteractionState(type?: 'drag' | 'resize'): void {
  let shouldRefreshStyle = false
  if (!type || type === 'drag') {
    if (state.isDragging || state.dragging.top !== -1 || state.dragging.left !== -1) {
      state.isDragging = false
      state.dragging = { top: -1, left: -1 }
      shouldRefreshStyle = true
    }
    lastX = NaN
    lastY = NaN
    dragStartPos = null
    dragThresholdExceeded = false
    dragTargetAllowed = false
    boundedSnapshot = null
    dragTerminalSnapshot = null
  }
  if (!type || type === 'resize') {
    if (
      state.isResizing ||
      state.resizing.width !== -1 ||
      state.resizing.height !== -1 ||
      state.resizing.top !== -1 ||
      state.resizing.inlineStart !== -1
    ) {
      state.isResizing = false
      state.resizing = { width: -1, height: -1, top: -1, inlineStart: -1 }
      shouldRefreshStyle = true
    }
    lastW = NaN
    lastH = NaN
    resizeTargetAllowed = false
    resizeAspectSnapshot = null
    resizeTerminalSnapshot = null
  }
  if (shouldRefreshStyle) createStyle()
}

function disableInteractionBinding(type?: 'drag' | 'resize'): void {
  if (!type || type === 'drag') {
    interactObj.value?.draggable({ enabled: false })
  }
  if (!type || type === 'resize') {
    interactObj.value?.resizable({ enabled: false })
  }
}

createStyle()

function emitContainerResized() {
  const styleProps: Record<string, string> = {}
  for (const prop of ['width', 'height']) {
    const val = state.style[prop]
    if (typeof val !== 'string') return
    const matches = val.match(/^(\d+(?:\.\d+)?)px$/)
    if (!matches) {
      return
    }
    styleProps[prop] = String(Math.round(Number(matches[1])))
  }
  emit(
    'container-resized',
    props.i,
    effectiveH.value,
    effectiveW.value,
    styleProps.height,
    styleProps.width,
  )
}

interface ResizePixelRect {
  top: number
  inlineStart: number
  width: number
  height: number
}

interface ResizeGridRect {
  x: number
  y: number
  w: number
  h: number
}

type ResizePointerEvent = MouseEvent & {
  edges?: Partial<Record<'top' | 'right' | 'bottom' | 'left', boolean>>
}

function resizeEdgesFromEvent(event: ResizePointerEvent) {
  return {
    north: event.edges?.top === true,
    east: event.edges?.right === true,
    south: event.edges?.bottom === true,
    west: event.edges?.left === true,
  }
}

function nextResizePixelRect(x: number, y: number): ResizePixelRect {
  const coreEvent = createCoreData(lastW, lastH, x, y)
  const snapshot = resizeAspectSnapshot
  if (!snapshot) {
    return {
      top: state.resizing.top,
      inlineStart: state.resizing.inlineStart,
      width: state.resizing.width,
      height: state.resizing.height,
    }
  }

  const inlineDelta =
    (renderRtl.value ? -coreEvent.deltaX : coreEvent.deltaX) / transformScale.value
  const blockDelta = coreEvent.deltaY / transformScale.value
  let rawTop = snapshot.rawTop
  let rawInlineStart = snapshot.rawInlineStart
  let rawWidth = snapshot.rawWidth
  let rawHeight = snapshot.rawHeight

  if (snapshot.edges.east) rawWidth += inlineDelta
  if (snapshot.edges.west) {
    rawInlineStart += inlineDelta
    rawWidth -= inlineDelta
  }
  if (!effectiveAutoHeight.value) {
    if (snapshot.edges.south) rawHeight += blockDelta
    if (snapshot.edges.north) {
      rawTop += blockDelta
      rawHeight -= blockDelta
    }
  }

  snapshot.rawTop = rawTop
  snapshot.rawInlineStart = rawInlineStart
  snapshot.rawWidth = rawWidth
  snapshot.rawHeight = rawHeight
  if (!snapshot.enabled) {
    return { top: rawTop, inlineStart: rawInlineStart, width: rawWidth, height: rawHeight }
  }

  const widthDelta = Math.abs(rawWidth - snapshot.initialWidth)
  const heightDelta = Math.abs(rawHeight - snapshot.initialHeight)
  const size =
    widthDelta >= heightDelta
      ? { width: rawWidth, height: rawWidth / snapshot.ratio }
      : { width: rawHeight * snapshot.ratio, height: rawHeight }
  return {
    top: snapshot.edges.north
      ? snapshot.initialTop + snapshot.initialHeight - size.height
      : snapshot.initialTop,
    inlineStart: snapshot.edges.west
      ? snapshot.initialInlineStart + snapshot.initialWidth - size.width
      : snapshot.initialInlineStart,
    ...size,
  }
}

function resizeGridLimits(snapshot: NonNullable<typeof resizeAspectSnapshot>) {
  return {
    maxW: Math.min(
      effectiveMaxW.value,
      snapshot.edges.west ? snapshot.initialX + snapshot.initialW : state.cols - snapshot.initialX,
    ),
    maxH: Math.min(
      effectiveMaxH.value,
      snapshot.edges.north
        ? snapshot.initialY + snapshot.initialH
        : state.maxRows - snapshot.initialY,
    ),
  }
}

function resizePixelRectToGrid(rect: ResizePixelRect): ResizeGridRect | null {
  const snapshot = resizeAspectSnapshot
  if (!snapshot) return null
  const limits = resizeGridLimits(snapshot)
  if (limits.maxW < effectiveMinW.value || limits.maxH < effectiveMinH.value) return null

  const size = snapshot.enabled
    ? selectAspectGridSize(rect.width, rect.height, snapshot.ratio, limits.maxW, limits.maxH)
    : pixelSizeToGridSize({ width: rect.width, height: rect.height, geometry: itemGeometry() })
  if (!size) return null

  const w = clamp(size.w, effectiveMinW.value, limits.maxW)
  const h = effectiveAutoHeight.value
    ? snapshot.initialH
    : clamp(size.h, effectiveMinH.value, limits.maxH)
  return {
    x: snapshot.edges.west ? snapshot.initialX + snapshot.initialW - w : snapshot.initialX,
    y: snapshot.edges.north ? snapshot.initialY + snapshot.initialH - h : snapshot.initialY,
    w,
    h,
  }
}

function finishResizeInteraction(item: Pick<LayoutItem, 'x' | 'y' | 'w' | 'h'> | null): void {
  const terminal = resizeTerminalSnapshot
  resizeTerminalSnapshot = null
  if (
    !terminal ||
    !item ||
    (terminal.initialX === item.x &&
      terminal.initialY === item.y &&
      terminal.initialW === item.w &&
      terminal.initialH === item.h)
  ) {
    return
  }

  let pixelWidth = terminal.pixelWidth
  let pixelHeight = terminal.pixelHeight
  if (
    terminal.candidateX !== item.x ||
    terminal.candidateY !== item.y ||
    terminal.candidateW !== item.w ||
    terminal.candidateH !== item.h
  ) {
    const position = calcPosition(item.x, item.y, item.w, item.h)
    pixelWidth = position.width
    pixelHeight = position.height
  }
  emit('resized', props.i, item.h, item.w, pixelHeight, pixelWidth)
}

function finishDragInteraction(item: Pick<LayoutItem, 'x' | 'y'> | null): void {
  const terminal = dragTerminalSnapshot
  dragTerminalSnapshot = null
  if (!terminal || !item || (terminal.initialX === item.x && terminal.initialY === item.y)) {
    return
  }
  emit('moved', props.i, item.x, item.y)
}

function handleResize(event: ResizePointerEvent) {
  if (effectiveStatic.value) return

  const type = event.type
  if (
    (type === 'resizestart' && state.isResizing) ||
    (type !== 'resizestart' && !state.isResizing)
  ) {
    return
  }

  const position = getControlPosition(event)
  if (isNull(position)) return

  const { x, y } = position
  const newRect: ResizePixelRect = { top: 0, inlineStart: 0, width: 0, height: 0 }
  let pos
  switch (type) {
    case 'resizestart': {
      tryMakeResizable()
      resizeTerminalSnapshot = null
      pos = calcPosition(innerX, innerY, innerW, innerH)
      const edges = resizeEdgesFromEvent(event)
      if (!Object.values(edges).some(Boolean)) {
        layout.rejectItemInteraction('resize', props.i, 'invalid-input', event)
        return
      }
      if (
        props.preserveAspectRatio &&
        (!Number.isFinite(pos.width) ||
          !Number.isFinite(pos.height) ||
          pos.width <= 0 ||
          pos.height <= 0)
      ) {
        const error = new GridLayoutValidationError('Invalid resize aspect ratio geometry', {
          code: 'invalid-config',
          path: 'gridItem.preserveAspectRatio',
          cause: { width: pos.width, height: pos.height },
        })
        layout.rejectItemInteraction('resize', props.i, 'invalid-input', event, error)
        return
      }
      resizeAspectSnapshot = {
        enabled: props.preserveAspectRatio,
        ratio: pos.width / pos.height,
        edges,
        initialX: innerX,
        initialY: innerY,
        initialW: innerW,
        initialH: innerH,
        initialTop: pos.top,
        initialInlineStart: positionInlineStart(pos),
        initialWidth: pos.width,
        initialHeight: pos.height,
        handlesSignature: renderedResizeHandles.value.join('|'),
        rawTop: pos.top,
        rawInlineStart: positionInlineStart(pos),
        rawWidth: pos.width,
        rawHeight: pos.height,
      }
      newRect.top = pos.top
      newRect.inlineStart = positionInlineStart(pos)
      newRect.width = pos.width
      newRect.height = pos.height
      state.resizing = newRect
      state.isResizing = true
      break
    }
    case 'resizemove': {
      Object.assign(newRect, nextResizePixelRect(x, y))
      state.resizing = newRect
      break
    }
    case 'resizeend': {
      Object.assign(newRect, nextResizePixelRect(x, y))
      state.resizing = { width: -1, height: -1, top: -1, inlineStart: -1 }
      state.isResizing = false
      break
    }
  }

  pos = resizePixelRectToGrid(newRect)
  if (!pos) {
    const snapshot = resizeAspectSnapshot
    const maximumHeight = snapshot ? resizeGridLimits(snapshot).maxH : 0
    layout.rejectItemInteraction(
      'resize',
      props.i,
      maximumHeight < effectiveMinH.value ? 'max-rows' : 'out-of-bounds',
      event,
    )
    const current = calcPosition(innerX, innerY, innerW, innerH)
    state.resizing = {
      top: current.top,
      inlineStart: positionInlineStart(current),
      width: current.width,
      height: current.height,
    }
    return
  }

  lastW = x
  lastH = y

  if (state.isResizing) {
    createStyle()
  }

  if (innerX !== pos.x || innerY !== pos.y || innerW !== pos.w || innerH !== pos.h) {
    emit('resize', props.i, pos.h, pos.w, newRect.height, newRect.width)
  }
  if (event.type === 'resizeend') {
    const snapshot = resizeAspectSnapshot!
    resizeTerminalSnapshot = {
      initialX: snapshot.initialX,
      initialY: snapshot.initialY,
      initialW: snapshot.initialW,
      initialH: snapshot.initialH,
      candidateX: pos.x,
      candidateY: pos.y,
      candidateW: pos.w,
      candidateH: pos.h,
      pixelWidth: newRect.width,
      pixelHeight: newRect.height,
    }
  }
  emitter.emit('resizeEvent', type, props.i, pos.x, pos.y, pos.h, pos.w, event)
  if (type === 'resizeend') resizeAspectSnapshot = null
}

function handleDrag(event: MouseEvent, phase = event.type) {
  if (effectiveStatic.value || state.isResizing) return

  const type = phase
  if ((type === 'dragstart' && state.isDragging) || (type !== 'dragstart' && !state.isDragging)) {
    return
  }

  const position = getControlPosition(event)
  if (isNull(position)) return
  const { x, y } = position
  const target = event.target as HTMLElement

  if (!target.offsetParent) return

  const newPosition = { top: 0, left: 0 }
  switch (type) {
    case 'dragstart': {
      previousX = innerX
      previousY = innerY
      dragTerminalSnapshot = null

      const parentRect = target.offsetParent.getBoundingClientRect()
      const clientRect = target.getBoundingClientRect()

      const cLeft = clientRect.left / transformScale.value
      const pLeft = parentRect.left / transformScale.value
      const cRight = clientRect.right / transformScale.value
      const pRight = parentRect.right / transformScale.value
      const cTop = clientRect.top / transformScale.value
      const pTop = parentRect.top / transformScale.value
      if (state.bounded) {
        const itemWidth = clientRect.width / transformScale.value
        const itemHeight = clientRect.height / transformScale.value
        const rootWidth = target.offsetParent.clientWidth
        const rootHeight = target.offsetParent.clientHeight
        if (![itemWidth, itemHeight, rootWidth, rootHeight].every(Number.isFinite)) {
          const error = new GridLayoutValidationError('Invalid bounded drag geometry', {
            code: 'invalid-config',
            path: 'gridItem.isBounded',
            cause: { itemWidth, itemHeight, rootWidth, rootHeight },
          })
          layout.rejectItemInteraction('drag', props.i, 'invalid-input', event, error)
          return
        }
        if (itemWidth > rootWidth || itemHeight > rootHeight) {
          layout.rejectItemInteraction('drag', props.i, 'out-of-bounds', event)
          return
        }
        boundedSnapshot = {
          maxLeft: rootWidth - itemWidth,
          maxTop: rootHeight - itemHeight,
        }
      } else {
        boundedSnapshot = null
      }

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
      if (renderRtl.value) {
        newPosition.left = state.dragging.left - coreEvent.deltaX / transformScale.value
      } else {
        newPosition.left = state.dragging.left + coreEvent.deltaX / transformScale.value
      }
      newPosition.top = state.dragging.top + coreEvent.deltaY / transformScale.value
      if (boundedSnapshot) {
        newPosition.top = clamp(newPosition.top, 0, boundedSnapshot.maxTop)
        newPosition.left = clamp(newPosition.left, 0, boundedSnapshot.maxLeft)
      }

      state.dragging = newPosition
      break
    }
    case 'dragend': {
      const parentRect = target.offsetParent.getBoundingClientRect()
      const clientRect = target.getBoundingClientRect()

      const cLeft = clientRect.left / transformScale.value
      const pLeft = parentRect.left / transformScale.value
      const cRight = clientRect.right / transformScale.value
      const pRight = parentRect.right / transformScale.value
      const cTop = clientRect.top / transformScale.value
      const pTop = parentRect.top / transformScale.value

      if (renderRtl.value) {
        newPosition.left = (cRight - pRight) * -1
      } else {
        newPosition.left = cLeft - pLeft
      }
      newPosition.top = cTop - pTop
      state.dragging = { top: -1, left: -1 }
      state.isDragging = false
      boundedSnapshot = null
      break
    }
  }

  const parentWidth = target.offsetParent.getBoundingClientRect().width / transformScale.value
  const pos = calcXY(newPosition.top, newPosition.left, parentWidth)

  lastX = x
  lastY = y

  if (state.isDragging) {
    createStyle()
  }

  if (innerX !== pos.x || innerY !== pos.y) {
    emit('move', props.i, pos.x, pos.y)
  }
  if (type === 'dragend') {
    dragTerminalSnapshot = {
      initialX: previousX,
      initialY: previousY,
    }
  }
  emitter.emit('dragEvent', type, props.i, pos.x, pos.y, innerH, innerW, event)
}

function resolvedContainerWidth(): number {
  if (typeof layout.width === 'number' && layout.width > 0) return layout.width
  const physicalWidth = wrapper.value?.offsetParent?.getBoundingClientRect().width
  if (typeof physicalWidth === 'number' && Number.isFinite(physicalWidth) && physicalWidth > 0) {
    return physicalWidth / transformScale.value
  }
  return state.containerWidth
}

function itemGeometry(rtl = renderRtl.value, effectiveScale = transformScale.value) {
  return {
    width: resolvedContainerWidth(),
    cols: state.cols,
    rowHeight: state.rowHeight,
    gap: [state.gap[0], state.gap[1]] as const,
    containerPadding: state.containerPadding,
    rtl,
    effectiveScale,
  }
}

function calcPosition(x: number, y: number, w: number, h: number) {
  const finiteW = w === Infinity ? 1 : w
  const finiteH = h === Infinity ? 1 : h
  const rect = gridToPixelRect(
    { i: props.decorative ? '__decorative__' : props.i, x, y, w: finiteW, h: finiteH },
    itemGeometry(),
  )

  if (renderRtl.value) {
    return {
      right: rect.inlineStart,
      top: rect.top,
      width: w === Infinity ? Infinity : rect.width,
      height: h === Infinity ? Infinity : rect.height,
    }
  }
  return {
    left: rect.inlineStart,
    top: rect.top,
    width: w === Infinity ? Infinity : rect.width,
    height: h === Infinity ? Infinity : rect.height,
  }
}

function positionInlineStart(position: ReturnType<typeof calcPosition>): number {
  const value = renderRtl.value ? position.right : position.left
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new GridLayoutValidationError('Invalid resize inline position', {
      code: 'invalid-config',
      path: 'gridItem.position',
      cause: position,
    })
  }
  return value
}

function calcXY(top: number, left: number, widthOverride?: number) {
  const width =
    typeof widthOverride === 'number' && Number.isFinite(widthOverride) && widthOverride > 0
      ? widthOverride
      : itemGeometry().width
  const position = pointerToGridPosition({
    clientX: left,
    clientY: top,
    containerRect: {
      left: 0,
      right: width,
      top: 0,
      bottom: 0,
      width,
      height: 0,
    },
    anchor: { inline: 0, block: 0 },
    geometry: { ...itemGeometry(false, 1), width },
  })

  const x = Math.max(Math.min(position.x, state.cols - innerW), 0)
  const y = Math.max(Math.min(position.y, state.maxRows - innerH), 0)

  return { x, y }
}

function clamp(num: number, lowerBound: number, upperBound: number) {
  return Math.max(Math.min(num, upperBound), lowerBound)
}

function selectAspectGridSize(
  targetWidth: number,
  targetHeight: number,
  ratio: number,
  maxW: number,
  maxH: number,
): { w: number; h: number } | null {
  const rounded = pixelSizeToGridSize({
    width: targetWidth,
    height: targetHeight,
    geometry: itemGeometry(),
  })
  const widths = new Set([rounded.w - 1, rounded.w, rounded.w + 1, effectiveMinW.value, maxW])
  const heights = new Set([rounded.h - 1, rounded.h, rounded.h + 1, effectiveMinH.value, maxH])
  let best:
    | {
        w: number
        h: number
        distance: number
        ratioError: number
      }
    | undefined

  for (const w of widths) {
    if (!Number.isSafeInteger(w) || w < effectiveMinW.value || w > maxW) continue
    for (const h of heights) {
      if (!Number.isSafeInteger(h) || h < effectiveMinH.value || h > maxH) continue
      const rect = calcPosition(0, 0, w, h)
      const distance = (rect.width - targetWidth) ** 2 + (rect.height - targetHeight) ** 2
      const ratioError = Math.abs(rect.width / rect.height - ratio)
      const candidate = { w, h, distance, ratioError }
      if (
        !best ||
        candidate.distance < best.distance ||
        (candidate.distance === best.distance && candidate.ratioError < best.ratioError) ||
        (candidate.distance === best.distance &&
          candidate.ratioError === best.ratioError &&
          (candidate.h < best.h || (candidate.h === best.h && candidate.w < best.w)))
      ) {
        best = candidate
      }
    }
  }
  return best ? { w: best.w, h: best.h } : null
}

function updateWidth(width: number | null, colNum?: number) {
  state.containerWidth = width ?? 0
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

function matchesSelectorPath(target: EventTarget | null, selector: string | undefined): boolean {
  if (!selector) return false
  let element = target instanceof Element ? target : null
  const root = wrapper.value
  while (element) {
    if (element.matches(selector)) return true
    if (element === root) break
    element = element.parentElement
  }
  return false
}

function interactionEventTarget(event: MouseEvent): EventTarget | null {
  const interactionEvent = event as MouseEvent & {
    originalEvent?: Event
    _interaction?: { downEvent?: Event }
  }
  return (
    interactionEvent.originalEvent?.target ??
    interactionEvent._interaction?.downEvent?.target ??
    event.target
  )
}

function canStartDrag(event: MouseEvent): boolean {
  const target = interactionEventTarget(event)
  if (matchesSelectorPath(target, dragIgnoreSelector.value)) return false
  return !dragAllowSelector.value || matchesSelectorPath(target, dragAllowSelector.value)
}

function canStartResize(event: MouseEvent): boolean {
  const resizer = `.${nh.be('resizer')}`
  return (
    matchesSelectorPath(interactionEventTarget(event), resizer) &&
    !matchesSelectorPath(interactionEventTarget(event), resizeIgnoreSelector.value)
  )
}

function tryMakeDraggable() {
  if (props.decorative || !state.registered || !layout.positionStyleReady) {
    interactObj.value?.draggable({ enabled: false })
    return
  }
  tryInteract()

  if (!interactObj.value) return

  if (state.draggable && !effectiveStatic.value) {
    const opts: Record<string, unknown> = { ...dragOptionSnapshot.value }
    if (dragIgnoreSelector.value) opts.ignoreFrom = dragIgnoreSelector.value
    if (dragAllowSelector.value) opts.allowFrom = dragAllowSelector.value
    interactObj.value.draggable(opts)

    if (!dragEventSet) {
      dragEventSet = true
      interactObj.value.on('dragstart dragmove dragend', event => {
        const threshold = effectiveDragThreshold.value

        if (event.type === 'dragstart') {
          dragTargetAllowed = canStartDrag(event)
          if (!dragTargetAllowed) return
          // 记录拖拽起始位置
          dragStartPos = { x: event.clientX, y: event.clientY }
          dragThresholdExceeded = threshold <= 0
          if (dragThresholdExceeded) {
            handleDrag(event)
          }
        } else if (event.type === 'dragmove') {
          if (!dragTargetAllowed) return
          if (!dragThresholdExceeded && dragStartPos) {
            const dx = event.clientX - dragStartPos.x
            const dy = event.clientY - dragStartPos.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            if (distance >= threshold) {
              dragThresholdExceeded = true
              handleDrag(event, 'dragstart')
            }
          }
          if (dragThresholdExceeded) {
            handleDrag(event)
          }
        } else if (event.type === 'dragend') {
          if (!dragTargetAllowed) return
          if (dragThresholdExceeded) {
            handleDrag(event)
          }
          dragStartPos = null
          dragThresholdExceeded = false
          dragTargetAllowed = false
        }
      })
    }
  } else {
    interactObj.value.draggable({ enabled: false })
  }
}

function tryMakeResizable() {
  if (props.decorative || !state.registered || !layout.positionStyleReady) {
    boundResizeHandlesSignature = ''
    interactObj.value?.resizable({ enabled: false })
    return
  }
  tryInteract()

  if (!interactObj.value) return

  if (resizableAndNotStatic.value) {
    const maximum = calcPosition(
      0,
      0,
      Math.min(effectiveMaxW.value, state.cols),
      Math.min(effectiveMaxH.value, state.maxRows),
    )
    const minimum = calcPosition(0, 0, effectiveMinW.value, effectiveMinH.value)

    const resizerBase = `.${nh.be('resizer')}`
    const selectorFor = (predicate: (handle: ResizeHandleAxis) => boolean) => {
      const selectors = renderedResizeHandles.value
        .filter(predicate)
        .map(handle => `${resizerBase}--${handle}`)
      return selectors.length ? selectors.join(', ') : false
    }
    const opts: Record<string, any> = {
      edges: {
        top: effectiveAutoHeight.value ? false : selectorFor(handle => handle.includes('n')),
        bottom: effectiveAutoHeight.value ? false : selectorFor(handle => handle.includes('s')),
        left: selectorFor(handle => handle.includes('w')),
        right: selectorFor(handle => handle.includes('e')),
      },
      restrictSize: {
        min: {
          height: minimum.height * transformScale.value,
          width: minimum.width * transformScale.value,
        },
        max: {
          height: maximum.height * transformScale.value,
          width: maximum.width * transformScale.value,
        },
      },
      ...resizeOptionSnapshot.value,
    }
    if (effectiveAutoHeight.value) {
      const rendered = calcPosition(innerX, innerY, innerW, innerH)
      opts.restrictSize = {
        min: {
          height: rendered.height * transformScale.value,
          width: minimum.width * transformScale.value,
        },
        max: {
          height: rendered.height * transformScale.value,
          width: maximum.width * transformScale.value,
        },
      }
    }
    if (resizeIgnoreSelector.value) opts.ignoreFrom = resizeIgnoreSelector.value

    interactObj.value.resizable(opts)
    boundResizeHandlesSignature = renderedResizeHandles.value.join('|')
    if (!resizeEventSet) {
      resizeEventSet = true
      interactObj.value.on('resizestart resizemove resizeend', event => {
        if (event.type === 'resizestart') {
          resizeTargetAllowed = canStartResize(event)
          if (!resizeTargetAllowed) return
        } else if (!resizeTargetAllowed) {
          return
        }
        handleResize(event as ResizePointerEvent)
        if (event.type === 'resizeend') resizeTargetAllowed = false
      })
    }
  } else {
    boundResizeHandlesSignature = ''
    interactObj.value.resizable({ enabled: false })
  }
}

/** 将唯一的内容元素注册到父布局共享的 ResizeObserver。 */
function syncAutoHeightTarget(): void {
  if (props.decorative || !effectiveAutoHeight.value) {
    layout.removeAutoHeightItem(instance)
    return
  }
  if (autoHeightResizeConflict.value) {
    layout.syncAutoHeightItem(instance, null, true, 'preserve-aspect-ratio')
    return
  }
  const root = wrapper.value
  if (!root) {
    layout.syncAutoHeightItem(instance, null, true, 'missing-content-root')
    return
  }
  const resizerClass = nh.be('resizer')
  const contentRoots = Array.from(root.children).filter(
    child => child instanceof HTMLElement && !child.classList.contains(resizerClass),
  ) as HTMLElement[]
  if (contentRoots.length !== 1) {
    layout.syncAutoHeightItem(
      instance,
      null,
      true,
      contentRoots.length === 0 ? 'missing-content-root' : 'multiple-content-roots',
    )
    return
  }
  layout.syncAutoHeightItem(instance, contentRoots[0], true)
}
</script>

<template>
  <section ref="wrapper" :class="className" :style="state.style">
    <slot></slot>
    <template v-if="resizableAndNotStatic">
      <span
        v-for="handle in renderedResizeHandles"
        :key="handle"
        :class="[
          nh.be('resizer'),
          nh.bem('resizer', handle),
          renderRtl && nh.bem('resizer', 'rtl'),
          $slots['resize-handle'] && nh.bem('resizer', 'custom'),
        ]"
        aria-hidden="true"
        tabindex="-1"
      >
        <slot
          name="resize-handle"
          :axis="handle"
          :direction="renderedResizeHandleDirection(handle)"
        ></slot>
      </span>
    </template>
  </section>
</template>
