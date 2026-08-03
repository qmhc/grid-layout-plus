<script setup lang="ts">
/* eslint-disable vue/max-attributes-per-line */
import {
  computed,
  nextTick,
  onBeforeMount,
  onBeforeUnmount,
  onMounted,
  provide,
  reactive,
  ref,
  shallowRef,
  toRaw,
  toRefs,
  watch,
} from 'vue'

import GridItem from './grid-item.vue'
import { createEventEmitter } from '@vexip-ui/utils'
import { useContainerWidth } from '../composables/useContainerWidth'
import { EMITTER_KEY, LAYOUT_KEY, bottom, cloneLayout, getLayoutItem } from '../helpers/common'
import { getDocumentDir } from '../helpers/dom'
import {
  cloneResponsiveLayouts,
  getBreakpointFromWidth,
  snapshotDormantResponsiveInputs,
  snapshotResponsiveConfig,
  snapshotResponsiveLayouts,
} from '../helpers/responsive'
import { verticalCompactor } from '../core/compactors'
import { GridLayoutExtensionError, GridLayoutValidationError } from '../core/errors'
import {
  createLayoutEngine,
  createNormalizedLayoutEngine,
  snapshotEffectiveConfig,
} from '../core/layout-engine'
import { transformStrategy } from '../core/position-strategies'
import { InteractionTransactionBuffer } from '../core/transaction-buffer'
import {
  snapshotCompactor,
  snapshotDropConfig,
  snapshotPositionStrategy,
  snapshotResizeHandles,
  snapshotTransferConfig,
} from '../core/validation'
import { useGridCommands } from './grid-layout/use-commands'
import { useGridConfig } from './grid-layout/use-config'
import { useGridDrop } from './grid-layout/use-drop'
import { createGridItemRegistry } from './grid-layout/item-registry'
import { useGridInteraction } from './grid-layout/use-interaction'
import { useGridLayoutSync } from './grid-layout/use-layout-sync'
import { createGridPositionStyleController } from './grid-layout/position-style-controller'
import { useGridResponsive } from './grid-layout/use-responsive'
import { useGridWidth } from './grid-layout/use-width'
import { useGridAutoHeight } from './grid-layout/use-auto-height'
import { useGridTransfer } from './grid-layout/use-transfer'
import { createLayoutTransactionController } from './grid-layout/transaction-controller'
import {
  createCurrentResponsiveTransaction,
  resolveResponsiveSpacing,
} from './grid-layout/responsive-model'

import type {
  Breakpoint,
  CollisionMode,
  CompleteResponsiveLayouts,
  Layout,
  LayoutItem,
  LayoutOperationReason,
  LayoutOperationResult,
  ReadonlyLayout,
  ReadonlyLayoutItem,
  ResizeHandleAxis,
  ResponsiveLayoutsInput,
} from '../helpers/types'
import type { GridItemRegistration, LayoutInstance } from '../helpers/internal-types'
import type { ResponsiveConfigSnapshot } from '../helpers/responsive'
import type { InternalEffectiveConfig, LayoutEngineEvaluation } from '../core/layout-engine'
import type {
  GridLayoutEmits,
  GridLayoutExpose,
  GridLayoutProps,
  GridLayoutSlots,
  LayoutUpdateMeta,
} from './types'
import type { GridLayoutRuntimeError, OperationRejectedPayload } from '../composables/useGridLayout'
import type { DropConfigSnapshot, TransferConfigSnapshot } from '../core/validation'
import type { UseGridConfigReturn } from './grid-layout/use-config'
import type { UseGridDropReturn } from './grid-layout/use-drop'
import type { UseGridCommandsReturn } from './grid-layout/use-commands'
import type { GridItemRegistry } from './grid-layout/item-registry'
import type { UseGridLayoutSyncReturn } from './grid-layout/use-layout-sync'
import type { UseGridResponsiveReturn } from './grid-layout/use-responsive'
import type { UseGridWidthReturn } from './grid-layout/use-width'
import type { LayoutTransactionController } from './grid-layout/transaction-controller'

const props = withDefaults(defineProps<GridLayoutProps>(), {
  autoHeight: undefined,
  autoSize: undefined,
  colNum: undefined,
  rowHeight: undefined,
  maxRows: undefined,
  gap: undefined,
  containerPadding: undefined,
  width: undefined,
  isDraggable: undefined,
  isResizable: undefined,
  isMirrored: false,
  isBounded: false,
  restoreOnDrag: undefined,
  responsive: false,
  responsiveLayouts: () => ({}),
  breakpoints: () => ({ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }),
  cols: () => ({ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }),
  collisionMode: undefined,
  preventCollision: false,
  bringToFrontOnInteract: true,
  useStyleCursor: true,
  compactor: () => verticalCompactor,
  positionStrategy: () => transformStrategy,
  isDroppable: undefined,
  dropItem: undefined,
  dragThreshold: undefined,
})

const emit = defineEmits<GridLayoutEmits>()
defineSlots<GridLayoutSlots>()

let compactorInput = props.compactor
const compactorSnapshot = shallowRef(snapshotCompactor(compactorInput))
const initialPositionStrategyInput = toRaw(props.positionStrategy)
const appliedPositionStrategy = shallowRef(snapshotPositionStrategy(initialPositionStrategyInput))

/**
 * Config 合并逻辑：扁平 props 优先于分组 config。
 * 扁平 prop 显式传入时（非 undefined）优先使用；
 * 否则使用分组 config 中的值；最后回退到默认值。
 */

const effectiveAutoSize = computed(() => props.autoSize ?? props.gridConfig?.autoSize ?? true)
const effectiveAutoHeight = computed(
  () => props.autoHeight ?? props.gridConfig?.autoHeight ?? false,
)
const effectiveColNum = computed(() => props.colNum ?? props.gridConfig?.colNum ?? 12)
const effectiveRowHeight = computed(() => props.rowHeight ?? props.gridConfig?.rowHeight ?? 150)
const effectiveMaxRows = computed(() => props.maxRows ?? props.gridConfig?.maxRows ?? Infinity)
const effectiveGapInput = computed(() => props.gap ?? props.gridConfig?.gap)
const effectiveContainerPaddingInput = computed(
  () => props.containerPadding ?? props.gridConfig?.containerPadding,
)
const effectiveIsDraggable = computed(
  () => props.isDraggable ?? props.dragConfig?.isDraggable ?? true,
)
const effectiveDragThreshold = computed(
  () => props.dragThreshold ?? props.dragConfig?.dragThreshold ?? 0,
)
const effectiveRestoreOnDrag = computed(
  () => props.restoreOnDrag ?? props.dragConfig?.restoreOnDrag ?? false,
)
const effectiveIsResizable = computed(
  () => props.isResizable ?? props.resizeConfig?.isResizable ?? true,
)
const defaultResizeHandles = Object.freeze(['se'] as ResizeHandleAxis[])

function snapshotEffectiveResizeHandles(): readonly ResizeHandleAxis[] {
  const handles = props.resizeConfig?.handles
  return handles === undefined
    ? defaultResizeHandles
    : snapshotResizeHandles(toRaw(handles), 'config.resizeConfig.handles')
}

const appliedResizeHandles = shallowRef(snapshotEffectiveResizeHandles())
function snapshotEffectiveDropConfig(): DropConfigSnapshot {
  const grouped = snapshotDropConfig(toRaw(props.dropConfig), toRaw)
  const flatDropItem =
    props.dropItem === undefined
      ? undefined
      : snapshotDropConfig({ dropItem: toRaw(props.dropItem) }, toRaw, 'config').dropItem
  if (props.isDroppable !== undefined && typeof props.isDroppable !== 'boolean') {
    throw new GridLayoutValidationError('Invalid Drop capability', {
      code: 'invalid-config',
      path: 'config.isDroppable',
      cause: props.isDroppable,
    })
  }
  return Object.freeze({
    isDroppable: props.isDroppable ?? grouped.isDroppable ?? false,
    dropItem: flatDropItem ?? grouped.dropItem ?? Object.freeze({ w: 1, h: 1 }),
    ...(grouped.onDragOver ? { onDragOver: grouped.onDragOver } : {}),
    ...(grouped.createItem ? { createItem: grouped.createItem } : {}),
  })
}

const appliedDropConfig = shallowRef(snapshotEffectiveDropConfig())
const appliedTransferConfig = shallowRef<TransferConfigSnapshot | null>(
  snapshotTransferConfig(toRaw(props.transferConfig), toRaw),
)
const effectiveIsDroppable = computed(() => appliedDropConfig.value.isDroppable ?? false)
const effectiveDropItem = computed<Readonly<{ w: number; h: number }>>(
  () =>
    (appliedDropConfig.value.dropItem ?? Object.freeze({ w: 1, h: 1 })) as Readonly<{
      w: number
      h: number
    }>,
)
const effectiveCollisionMode = computed<CollisionMode>(() => {
  return (
    props.collisionMode ??
    (compactorSnapshot.value.allowOverlap ? 'overlap' : props.preventCollision ? 'prevent' : 'push')
  )
})

function snapshotExplicitWidth(value: unknown): number | null {
  if (value === undefined) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new GridLayoutValidationError('Width must be a non-negative finite number', {
      code: 'invalid-config',
      path: 'config.width',
      cause: value,
    })
  }
  return Object.is(value, -0) ? 0 : value
}

const initialWidth = snapshotExplicitWidth(props.width)
const responsiveMode = shallowRef(props.responsive)
let committedDormantResponsive = snapshotDormantResponsiveInputs<Breakpoint>(
  props.breakpoints,
  props.cols,
  toRaw(props.responsiveLayouts),
)
let committedResponsiveConfig: ResponsiveConfigSnapshot<Breakpoint> | null = responsiveMode.value
  ? snapshotResponsiveConfig(
      committedDormantResponsive.breakpoints,
      committedDormantResponsive.cols,
    )
  : null
const initialProvisionalBreakpoint =
  responsiveMode.value && initialWidth !== null && committedResponsiveConfig
    ? getBreakpointFromWidth(committedResponsiveConfig.breakpoints, initialWidth)
    : null
const spacingBreakpoint = shallowRef<Breakpoint | null>(initialProvisionalBreakpoint)

const effectiveGap = computed<readonly [number, number]>(() =>
  resolveResponsiveSpacing(
    effectiveGapInput.value,
    'config.gap',
    [10, 10],
    responsiveMode.value ? spacingBreakpoint.value : null,
    committedResponsiveConfig,
    responsiveMode.value,
  ),
)
const effectiveContainerPadding = computed<readonly [number, number]>(() =>
  resolveResponsiveSpacing(
    effectiveContainerPaddingInput.value,
    'config.containerPadding',
    [0, 0],
    responsiveMode.value ? spacingBreakpoint.value : null,
    committedResponsiveConfig,
    responsiveMode.value,
  ),
)

const effectiveConfig = computed(() => ({
  autoHeight: effectiveAutoHeight.value,
  autoSize: effectiveAutoSize.value,
  colNum: effectiveColNum.value,
  rowHeight: effectiveRowHeight.value,
  maxRows: effectiveMaxRows.value,
  gap: effectiveGap.value,
  isDraggable: effectiveIsDraggable.value,
  isResizable: effectiveIsResizable.value,
  isDroppable: effectiveIsDroppable.value,
  dropItem: effectiveDropItem.value,
  dragThreshold: effectiveDragThreshold.value,
  restoreOnDrag: effectiveRestoreOnDrag.value,
  collisionMode: effectiveCollisionMode.value,
  bringToFrontOnInteract: props.bringToFrontOnInteract,
}))

const state = reactive({
  width: initialWidth as number | null,
  mergedStyle: {},
  lastLayoutLength: 0,
  isDragging: false,
  suppressTransitions: true,
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
  dropPlaceholder: null as { x: number; y: number; w: number; h: number } | null,
  // 跨网格目标占位符状态
  transferPlaceholder: null as { x: number; y: number; w: number; h: number } | null,
  counters: {
    revision: 0,
    evaluationId: 0,
  },
  positionStyleRevision: 0,
  positionStyleReady: false,
})

const itemInstances = new Map<LayoutItem['i'], GridItemRegistration>()
const registeredItems = new Set<GridItemRegistration>()
const registrationEpisodes = new WeakMap<object, string | null>()

const currentLayout = ref(cloneLayout(props.layout))
let committedLayout = cloneLayout(currentLayout.value)

const itemZIndexRanks = computed(() => {
  const ordered = currentLayout.value
    .map((item, index) => ({ id: item.i, index, zIndex: item.zIndex ?? 0 }))
    .sort((first, second) => first.zIndex - second.zIndex || first.index - second.index)
  return new Map(ordered.map((item, rank) => [item.id, rank]))
})
const currentColNum = ref(
  initialProvisionalBreakpoint && committedResponsiveConfig
    ? committedResponsiveConfig.cols[initialProvisionalBreakpoint]
    : effectiveColNum.value,
)
const wrapper = ref<HTMLElement | null>(null)
const positionStyleController = createGridPositionStyleController({
  state,
  registeredItems,
  getDirection: () => (layoutUsesRtl() ? 'rtl' : 'ltr'),
  getEffectiveScale: () => appliedPositionStrategy.value.transformScale ?? 1,
})
const evaluatePositionStyleBatch = positionStyleController.evaluate
const commitPositionStyleMap = positionStyleController.commit
const disablePositionInteractions = positionStyleController.disableInteractions
const restoreCommittedPositionStyleMap = positionStyleController.restoreCommitted
const getPositionStyle = positionStyleController.getStyle

function resolveEngineConfig(
  responsiveBreakpoint: Breakpoint | null = responsiveMode.value ? spacingBreakpoint.value : null,
  responsiveConfig: ResponsiveConfigSnapshot<Breakpoint> | null = committedResponsiveConfig,
  responsive = responsiveMode.value,
): InternalEffectiveConfig {
  const nextCompactorInput = props.compactor
  const compactorChanged = !Object.is(toRaw(nextCompactorInput), toRaw(compactorInput))
  const nextCompactorSnapshot = compactorChanged
    ? snapshotCompactor(nextCompactorInput)
    : compactorSnapshot.value
  const gap = resolveResponsiveSpacing(
    effectiveGapInput.value,
    'config.gap',
    [10, 10],
    responsiveBreakpoint,
    responsiveConfig,
    responsive,
  )
  const containerPadding = resolveResponsiveSpacing(
    effectiveContainerPaddingInput.value,
    'config.containerPadding',
    [0, 0],
    responsiveBreakpoint,
    responsiveConfig,
    responsive,
  )
  const resolved = snapshotEffectiveConfig({
    cols: currentColNum.value,
    rowHeight: effectiveRowHeight.value,
    gap,
    containerPadding,
    maxRows: effectiveMaxRows.value,
    compactor: nextCompactorSnapshot,
    collisionMode: effectiveCollisionMode.value,
    isDraggable: effectiveIsDraggable.value,
    isResizable: effectiveIsResizable.value,
    restoreOnDrag: effectiveRestoreOnDrag.value,
    bringToFrontOnInteract: props.bringToFrontOnInteract,
  })
  if (compactorChanged) {
    compactorInput = nextCompactorInput
    compactorSnapshot.value = nextCompactorSnapshot
  }
  return resolved
}

let engineConfig = resolveEngineConfig()
const appliedEngineConfig = shallowRef(engineConfig)
const renderedLayoutStyle = computed(() => ({
  ...state.mergedStyle,
  '--vgl-layout-interaction-z-index':
    appliedEngineConfig.value.collisionMode === 'overlap'
      ? '0'
      : String(currentLayout.value.length),
}))
const canNormalizeInitialLayout = !responsiveMode.value || initialProvisionalBreakpoint !== null
const initialEngine = canNormalizeInitialLayout
  ? createNormalizedLayoutEngine(currentLayout.value, engineConfig)
  : null
const engine =
  initialEngine?.engine ??
  createLayoutEngine(currentLayout.value, engineConfig, {
    deferHorizontalBounds: true,
  })
if (initialEngine) {
  currentLayout.value = cloneLayout(initialEngine.layout)
  committedLayout = cloneLayout(initialEngine.layout)
}
const initialLayoutNormalized = initialEngine?.changed ?? false
const initialResponsiveFallback = cloneLayout(committedLayout)
let committedAuthorLayouts: ResponsiveLayoutsInput<Breakpoint> = Object.freeze(
  Object.create(null),
) as ResponsiveLayoutsInput<Breakpoint>
let committedCompleteLayouts: CompleteResponsiveLayouts<Breakpoint> | null = null
let committedResponsivePropIdentity: unknown = null

if (responsiveMode.value && committedResponsiveConfig) {
  committedAuthorLayouts = snapshotResponsiveLayouts(
    committedDormantResponsive.layouts,
    committedResponsiveConfig,
    engineConfig,
  )
  committedResponsivePropIdentity = toRaw(props.responsiveLayouts)
}
let disposing = false
let sealedError: GridLayoutValidationError | null = null
let synchronousCounterDepth = 0
let transitionFrame = 0
const interactionBuffers = new InteractionTransactionBuffer()
let mounted = false
let readyEmitted = false

function syncEngineLayout(layout: ReadonlyLayout): void {
  currentLayout.value = cloneLayout(layout)
}

function confirmEngineEvaluation(evaluation: LayoutEngineEvaluation) {
  const result = engine.confirm(evaluation)
  if (result.status !== 'rejected') {
    engineConfig = evaluation.nextConfig
    appliedEngineConfig.value = engineConfig
    committedLayout = cloneLayout(result.layout)
    if (result.status === 'accepted') syncEngineLayout(result.layout)
  }
  return result
}

const emitter = createEventEmitter()

emitter.on('resizeEvent', (...args: Parameters<typeof resizeEventHandler>) => {
  runAsyncBoundary(() => resizeEventHandler(...args))
})
emitter.on('dragEvent', (...args: Parameters<typeof dragEventHandler>) => {
  runAsyncBoundary(() => dragEventHandler(...args))
})

const transactionControllerRef: {
  current: LayoutTransactionController<Breakpoint> | null
} = { current: null }
const dropRef: { current: UseGridDropReturn | null } = { current: null }
const commandsRef: { current: UseGridCommandsReturn | null } = { current: null }
const itemRegistryRef: { current: GridItemRegistry | null } = { current: null }
const responsiveRef: { current: UseGridResponsiveReturn<Breakpoint> | null } = {
  current: null,
}
const widthRef: { current: UseGridWidthReturn | null } = { current: null }
const configRef: { current: UseGridConfigReturn | null } = { current: null }
const layoutSyncRef: { current: UseGridLayoutSyncReturn | null } = { current: null }

function getTransactionController(): LayoutTransactionController<Breakpoint> {
  if (!transactionControllerRef.current) throw new Error('Transaction controller is unavailable')
  return transactionControllerRef.current
}

function getDrop(): UseGridDropReturn {
  if (!dropRef.current) throw new Error('Drop composable is unavailable')
  return dropRef.current
}

function getCommands(): UseGridCommandsReturn {
  if (!commandsRef.current) throw new Error('Grid commands are unavailable')
  return commandsRef.current
}

function getItemRegistry(): GridItemRegistry {
  if (!itemRegistryRef.current) throw new Error('Item registry is unavailable')
  return itemRegistryRef.current
}

function getResponsive(): UseGridResponsiveReturn<Breakpoint> {
  if (!responsiveRef.current) throw new Error('Responsive composable is unavailable')
  return responsiveRef.current
}

function getWidth(): UseGridWidthReturn {
  if (!widthRef.current) throw new Error('Width composable is unavailable')
  return widthRef.current
}

function getConfig(): UseGridConfigReturn {
  if (!configRef.current) throw new Error('Config composable is unavailable')
  return configRef.current
}

function getLayoutSync(): UseGridLayoutSyncReturn {
  if (!layoutSyncRef.current) throw new Error('Layout sync composable is unavailable')
  return layoutSyncRef.current
}

const interaction = useGridInteraction<Breakpoint>({
  state,
  engine,
  interactionBuffer: interactionBuffers,
  getTransactionController,
  isUnavailable: () => disposing || sealedError !== null,
  runAsyncBoundary,
  getRoot: () => wrapper.value,
  getCurrentLayout: () => currentLayout.value,
  getCommittedLayout: () => committedLayout,
  syncEngineLayout,
  getPositionStrategy: () => appliedPositionStrategy.value,
  getItem: id => itemInstances.get(id),
  validateRegisteredItems: () => getItemRegistry().validate(),
  evaluatePositionStyles: evaluatePositionStyleBatch,
  commitPreviewPositionStyles: (styles, ready) => {
    commitPositionStyleMap(styles, ready, false)
  },
  restoreCommittedPositionStyles: restoreCommittedPositionStyleMap,
  rejectPositionStyles: (...args) => getConfig().rejectPositionStyles(...args),
  nextEvaluationId,
  emitEvaluationError,
  emitOperationRejected,
  emitInteractionStart: payload => emit('interaction-start', payload),
  emitInteractionChange: payload => emit('interaction-change', payload),
  emitInteractionEnd: payload => emit('interaction-end', payload),
  emitLayoutUpdated: (layout, revision) => emitLayoutUpdated(layout, revision, 'interaction'),
  invalidateDropProposal: () => getDrop().invalidateProposal(),
  emitCompact: () => emitter.emit('compact'),
  updateHeight,
  applyDeferredEngineConfig: () => getConfig().applyEngineConfig(),
  schedulePendingObservedWidth: () => getWidth().schedulePendingObserved(),
  isResponsive: () => responsiveMode.value,
  prepareResponsiveLayout: () => getResponsive().applyLayout(),
})
const finishInteraction = interaction.finish
const prepareActiveForTerminal = interaction.prepareForTerminal
const cancelActiveForConfig = interaction.cancelForConfig
const clearInteractionView = interaction.clearView
const cancelPendingFrame = interaction.cancelPendingFrame
const cancelInteraction = interaction.cancel
const rememberFocusedDescendant = interaction.rememberFocusedDescendant
const rememberPointerFocus = interaction.rememberPointerFocus
const interactionDragEvent = interaction.dragEvent
const resizeEvent = interaction.resizeEvent

const transactionController = createLayoutTransactionController<Breakpoint>({
  engine,
  interactionBuffer: interactionBuffers,
  isDisposing: () => disposing,
  isSealed: () => sealedError !== null,
  runAsyncBoundary,
  nextRevision,
  getCommittedLayout: () => committedLayout,
  setCommittedLayout: layout => {
    committedLayout = cloneLayout(layout)
  },
  getCurrentLayout: () => currentLayout.value,
  syncEngineLayout,
  setEngineConfig: config => {
    engineConfig = config
    appliedEngineConfig.value = config
  },
  getDefaultPositionStyles: positionStyleController.getCommitted,
  commitPositionStyles: styles => {
    commitPositionStyleMap(styles, state.width !== null && state.width > 0, true)
  },
  restoreCommittedPositionStyles: restoreCommittedPositionStyleMap,
  syncItemEngineConfig,
  updateHeight,
  getActiveInteraction: interaction.getActive,
  updateActiveInteraction: interaction.updateTransaction,
  finishInteraction,
  clearInteractionView,
  createResponsiveTransaction: result =>
    createCurrentResponsiveTransaction({
      result,
      responsive: responsiveMode.value,
      breakpoint: state.lastBreakpoint,
      completeLayouts: committedCompleteLayouts,
      config: committedResponsiveConfig,
    }),
  commitResponsiveTransaction: (responsive, revision) => {
    committedResponsiveConfig = responsive.config
    committedAuthorLayouts = responsive.authorLayouts
    committedCompleteLayouts = responsive.expectedLayouts
    committedResponsivePropIdentity = toRaw(props.responsiveLayouts)
    state.layouts = cloneResponsiveLayouts(responsive.expectedLayouts)
    state.lastBreakpoint = responsive.breakpoint
    spacingBreakpoint.value = responsive.breakpoint
    currentColNum.value = engineConfig.cols
    if (responsive.previousBreakpoint !== responsive.breakpoint) {
      emit('breakpoint-changed', responsive.breakpoint, cloneLayout(committedLayout), {
        revision,
        source: 'responsive',
      })
    }
  },
  emitUpdateResponsiveLayouts: (layouts, revision, source) => {
    emit('update:responsive-layouts', cloneResponsiveLayouts(layouts), { revision, source })
  },
  emitUpdateLayout: (layout, revision, source) => {
    emit('update:layout', cloneLayout(layout), { revision, source })
  },
  emitInteractionChange: interaction.emitChange,
  emitOperationRejected,
  emitLayoutUpdated,
  emitReadyOnce,
})
transactionControllerRef.current = transactionController
const startPendingDeadline = transactionController.startDeadline

const drop = useGridDrop<Breakpoint>({
  state,
  engine,
  isUnavailable: () => disposing || sealedError !== null,
  isResponsive: () => responsiveMode.value,
  hasActiveInteraction: interaction.hasActive,
  getRoot: () => wrapper.value,
  getConfig: () => appliedEngineConfig.value,
  getStrategy: () => appliedPositionStrategy.value,
  getDropConfig: () => appliedDropConfig.value,
  getDropItem: () => effectiveDropItem.value,
  getCurrentLayout: () => committedLayout,
  getDirection: () => (layoutUsesRtl() ? 'rtl' : 'ltr'),
  evaluatePositionStyles: evaluatePositionStyleBatch,
  syncPreviewLayout: syncEngineLayout,
  commitPreviewStyles: (styles, ready) => commitPositionStyleMap(styles, ready, false),
  restorePreview: () => {
    if (interaction.hasActive()) return
    syncEngineLayout(committedLayout)
    restoreCommittedPositionStyleMap()
    updateHeight()
  },
  updateHeight,
  nextEvaluationId,
  emitRuntimeError: (error, overrides) => {
    emitRuntimeError(error, null, overrides)
  },
  onOperationRejected: payload => emit('operation-rejected', payload),
  onDragOver: (context, event) => emit('drop-drag-over', context, event),
  onCommitRequest: (item, result, event) => {
    getCommands().submit(
      { type: 'add', item },
      {
        source: 'drop-commit',
        operation: 'drop',
        nativeEvent: event,
        settlement: {
          committed: (layout, revision) => {
            const committedItem = layout.find(candidate => Object.is(candidate.i, item.i))
            if (!committedItem) return
            emit(
              'drop',
              {
                status: 'committed',
                proposalId: result.proposalId,
                breakpoint: result.breakpoint,
                item: cloneLayout([committedItem])[0],
                layout: cloneLayout(layout),
                revision,
              },
              event,
            )
          },
          rejected: () => undefined,
        },
      },
    )
  },
  onDragLeave: event => emit('drop-drag-leave', event),
})
dropRef.current = drop
const invalidateDropProposal = drop.invalidateProposal
const finishDropSession = drop.finishSession
const handleDragEnter = drop.handleDragEnter
const handleDragOver = drop.handleDragOver
const handleDrop = drop.handleDrop
const handleDragLeave = drop.handleDragLeave

const itemRegistry = createGridItemRegistry({
  itemInstances,
  registeredItems,
  registrationEpisodes,
  isUnavailable: () => disposing || sealedError !== null,
  getRoot: () => wrapper.value,
  hasLayoutItem: id => getLayoutItem(currentLayout.value, id) !== undefined,
  getActiveInteractionId: () => interaction.getActive()?.id ?? null,
  prepareActiveForTerminal,
  finishActiveForExternalUpdate: () => {
    finishInteraction('cancelled', 'external-update', { nativeEvent: null })
  },
  scheduleValidation: callback => {
    nextTick(() => runAsyncBoundary(callback))
  },
  nextEvaluationId,
  emitError: error => emit('error', error),
})
itemRegistryRef.current = itemRegistry
const increaseItem = itemRegistry.increase
const decreaseItem = itemRegistry.decrease
const updateItem = itemRegistry.update
const getItem = itemRegistry.get
const validateRegisteredItems = itemRegistry.validate

const responsive = useGridResponsive<Breakpoint>({
  mode: responsiveMode,
  spacingBreakpoint,
  currentColNum,
  state,
  engine,
  initialFallback: initialResponsiveFallback,
  getResponsiveProp: () => props.responsive,
  getBreakpoints: () => props.breakpoints,
  getCols: () => props.cols,
  getResponsiveLayouts: () => props.responsiveLayouts,
  getLayout: () => props.layout,
  getEffectiveColNum: () => effectiveColNum.value,
  getCommittedDormant: () => committedDormantResponsive,
  setCommittedDormant: value => {
    committedDormantResponsive = value
  },
  getCommittedConfig: () => committedResponsiveConfig,
  setCommittedConfig: value => {
    committedResponsiveConfig = value
  },
  getCommittedAuthor: () => committedAuthorLayouts,
  setCommittedAuthor: value => {
    committedAuthorLayouts = value
  },
  getCommittedComplete: () => committedCompleteLayouts,
  setCommittedComplete: value => {
    committedCompleteLayouts = value
  },
  getCommittedIdentity: () => committedResponsivePropIdentity,
  setCommittedIdentity: value => {
    committedResponsivePropIdentity = value
  },
  getCommittedLayout: () => committedLayout,
  getEngineConfig: () => engineConfig,
  getPositionStrategy: () => appliedPositionStrategy.value,
  resolveEngineConfig,
  confirmEngineEvaluation,
  getTransactionController,
  getInteraction: () => interaction,
  getDrop,
  isUnavailable: () => disposing || sealedError !== null,
  runAsyncBoundary,
  observeLayoutProp: () => getLayoutSync().observeLayoutProp(),
  evaluatePositionStyles: evaluatePositionStyleBatch,
  rejectPositionStyles: (...args) => getConfig().rejectPositionStyles(...args),
  commitPositionStyles: (styles, ready) => commitPositionStyleMap(styles, ready, true),
  emitRuntimeError,
  emitEvaluationError,
  emitOperationRejected,
  emitBreakpointChanged: (breakpoint, layout, revision, source) => {
    emit('breakpoint-changed', breakpoint, cloneLayout(layout), { revision, source })
  },
  emitLayoutUpdated,
  nextEvaluationId,
  nextRevision,
  syncItemEngineConfig,
  updateHeight,
  emitReadyOnce,
  shouldEmitReady: () => mounted && !readyEmitted && !getWidth().isAwaitingInitialResolution(),
})
responsiveRef.current = responsive
const observeResponsiveInputs = responsive.observeInputs
const observeResponsiveLayoutsProp = responsive.observeLayoutsProp
const responsiveGridLayout = responsive.applyLayout
const initResponsiveFeatures = responsive.initFeatures
const applyResponsiveMode = responsive.applyMode

const width = useGridWidth<Breakpoint>({
  state,
  mode: responsiveMode,
  currentColNum,
  initialWidth,
  getMounted: () => mounted,
  isUnavailable: () => disposing || sealedError !== null,
  runAsyncBoundary,
  getResponsiveProp: () => props.responsive,
  getBreakpoints: () => props.breakpoints,
  getCols: () => props.cols,
  isExplicitWidth: () => props.width !== undefined,
  getCommittedLayout: () => committedLayout,
  getEngineConfig: () => appliedEngineConfig.value,
  getPositionStrategy: () => appliedPositionStrategy.value,
  resolveEngineConfig,
  getInteraction: () => interaction,
  getResponsive,
  invalidateDropProposal: () => drop.invalidateProposal(),
  evaluatePositionStyles: evaluatePositionStyleBatch,
  primePositionStyles: positionStyleController.prime,
  disablePositionInteractions,
  commitPositionStyles: (styles, ready) => commitPositionStyleMap(styles, ready, true),
  rejectPositionStyles: (...args) => getConfig().rejectPositionStyles(...args),
  emitRuntimeError,
  emitWidthChanged: (payload, revision) => {
    emit('width-changed', payload, { revision, source: 'width' })
  },
  emitUpdateWidth: width => emitter.emit('updateWidth', width),
  nextRevision,
  updateHeight,
  emitReadyOnce,
})
widthRef.current = width
const discardPendingObservedWidth = width.discardPendingObserved
const queueObservedWidth = width.queueObserved
const processContainerWidth = width.process

const config = useGridConfig<Breakpoint>({
  state,
  engine,
  currentColNum,
  appliedPositionStrategy,
  initialPositionStrategyInput,
  isDisposing: () => disposing,
  isResponsive: () => responsiveMode.value,
  getEffectiveColNum: () => effectiveColNum.value,
  getCurrentLayout: () => currentLayout.value,
  getCommittedLayout: () => committedLayout,
  getEngineConfig: () => engineConfig,
  resolveEngineConfig,
  confirmEngineEvaluation,
  getInteraction: () => interaction,
  getTransactionController,
  invalidateDropProposal: () => drop.invalidateProposal(),
  evaluatePositionStyles: evaluatePositionStyleBatch,
  commitPositionStyles: (styles, ready) => commitPositionStyleMap(styles, ready, true),
  disablePositionInteractions,
  nextEvaluationId,
  emitRuntimeError,
  emitEvaluationError,
  emitOperationRejected,
  syncItemEngineConfig,
  updateHeight,
})
configRef.current = config
const applyEngineConfig = config.applyEngineConfig
const applyPositionStrategy = config.applyPositionStrategy
const rejectPositionStyleBatch = config.rejectPositionStyles

const autoHeight = useGridAutoHeight<Breakpoint>({
  engine,
  isUnavailable: () => disposing || sealedError !== null,
  isMounted: () => mounted,
  isResponsiveReady: () => !responsiveMode.value || state.lastBreakpoint !== null,
  hasActiveInteraction: interaction.hasActive,
  getWidth: () => state.width,
  getLayout: () => currentLayout.value,
  getConfig: () => appliedEngineConfig.value,
  getPositionStrategy: () => appliedPositionStrategy.value,
  getTransactionController,
  runAsyncBoundary,
  evaluatePositionStyles: evaluatePositionStyleBatch,
  rejectPositionStyles: rejectPositionStyleBatch,
  emitRuntimeError,
  emitEvaluationError,
  emitOperationRejected,
  nextEvaluationId,
})
const syncAutoHeightItem = autoHeight.sync
const removeAutoHeightItem = autoHeight.remove

const commands = useGridCommands<Breakpoint>({
  state,
  engine,
  isDisposing: () => disposing,
  isResponsiveReady: () => !responsiveMode.value || state.lastBreakpoint !== null,
  runSynchronousBoundary: runSynchronousCounterBoundary,
  getCommittedLayout: () => committedLayout,
  getEngineConfig: () => appliedEngineConfig.value,
  getPositionStrategy: () => appliedPositionStrategy.value,
  getTransactionController,
  evaluatePositionStyles: evaluatePositionStyleBatch,
  rejectPositionStyles: rejectPositionStyleBatch,
  emitOperationRejected,
})
commandsRef.current = commands
const setLayout = commands.setLayout
const moveItem = commands.moveItem
const resizeItem = commands.resizeItem
const addItem = commands.addItem
const removeItem = commands.removeItem
const bringToFront = commands.bringToFront
const sendToBack = commands.sendToBack

const transfer = useGridTransfer<Breakpoint>({
  state,
  engine,
  isUnavailable: () => disposing || sealedError !== null,
  hasActiveInteraction: interaction.hasActive,
  getRoot: () => wrapper.value,
  getConfig: () => appliedTransferConfig.value,
  getEngineConfig: () => appliedEngineConfig.value,
  getPositionStrategy: () => appliedPositionStrategy.value,
  getCommittedLayout: () => committedLayout,
  getDirection: () => (layoutUsesRtl() ? 'rtl' : 'ltr'),
  evaluatePositionStyles: evaluatePositionStyleBatch,
  syncPreviewLayout: syncEngineLayout,
  commitPreviewStyles: (styles, ready) => commitPositionStyleMap(styles, ready, false),
  restorePreview: () => {
    if (interaction.hasActive()) return
    syncEngineLayout(committedLayout)
    restoreCommittedPositionStyleMap()
    updateHeight()
  },
  clearExternalDrop: () => finishDropSession(),
  updateHeight,
  suspendSource: interaction.suspendForTransfer,
  finishSource: (reason, event) => interaction.finishTransfer(reason, event),
  submit: (command, options) => commands.submit(command, options),
  emitCommitted: (result, event) => emit('transfer', result, event),
})

const layoutSync = useGridLayoutSync<Breakpoint>({
  state,
  engine,
  isDisposing: () => disposing,
  isResponsive: () => responsiveMode.value,
  getLayout: () => props.layout,
  getCurrentLayout: () => currentLayout.value,
  getCommittedLayout: () => committedLayout,
  setCommittedLayout: layout => {
    committedLayout = cloneLayout(layout)
  },
  getEngineConfig: () => engineConfig,
  setEngineConfig: config => {
    engineConfig = config
    appliedEngineConfig.value = config
  },
  getPositionStrategy: () => appliedPositionStrategy.value,
  resolveEngineConfig,
  getTransactionController,
  getInteraction: () => interaction,
  getDrop,
  hasSupersededInteraction: layout => interactionBuffers.hasSuperseded(layout),
  syncEngineLayout,
  evaluatePositionStyles: evaluatePositionStyleBatch,
  rejectPositionStyles: rejectPositionStyleBatch,
  commitPositionStyles: (styles, ready) => commitPositionStyleMap(styles, ready, true),
  syncItemEngineConfig,
  updateHeight,
  validateRegisteredItems,
  emitRuntimeError,
  emitOperationRejected,
  emitLayoutUpdated,
  nextEvaluationId,
  nextRevision,
})
layoutSyncRef.current = layoutSync
const observeLayoutProp = layoutSync.observeLayoutProp

function replaceEngineLayout(layout: ReadonlyLayout, config = resolveEngineConfig()): boolean {
  const hadActiveInteraction = interaction.hasActive()
  const result = engine.replaceExternal(layout, config)
  if (result.status === 'rejected') return false
  engineConfig = config
  appliedEngineConfig.value = engineConfig
  if (hadActiveInteraction) interaction.clearForExternalReplacement()
  committedLayout = cloneLayout(result.layout)
  syncEngineLayout(result.layout)
  return true
}

function nextCounter(counter: 'revision' | 'evaluationId'): number {
  if (sealedError) throw sealedError
  const current = state.counters[counter]
  const next = current + 1
  if (!Number.isSafeInteger(next) || next >= Number.MAX_SAFE_INTEGER) {
    const error = new GridLayoutValidationError(`Counter ${counter} is exhausted`, {
      code: 'invalid-config',
      path: `config.counter["${counter}"]`,
      cause: {
        reason: 'counter-exhausted',
        counter,
        limit: Number.MAX_SAFE_INTEGER - 1,
      },
    })
    sealCounter(error, synchronousCounterDepth === 0)
    throw error
  }
  state.counters[counter] = next
  return next
}

function sealCounter(error: GridLayoutValidationError, emitRuntime: boolean): void {
  if (sealedError) return
  const pending = transactionController.getPending()
  const revision = interaction.getActive()?.latestRevision ?? pending?.revision ?? null
  sealedError = error
  cancelPendingFrame()
  discardPendingObservedWidth()
  cancelTransitionRestore()
  transactionController.disposePending()
  interactionBuffers.finishTerminal()
  state.dropPlaceholder = null
  state.transferPlaceholder = null
  clearInteractionView()
  if (emitRuntime) {
    emit('error', {
      code: 'invalid-config',
      source: 'config',
      path: error.path,
      revision,
      evaluationId: Number.MAX_SAFE_INTEGER,
      cause: error.cause,
    })
  }
  if (interaction.hasActive()) {
    finishInteraction('cancelled', 'config-changed', { revision, nativeEvent: null })
  }
}

function runAsyncBoundary<T>(callback: () => T): T | undefined {
  if (disposing || sealedError) return undefined
  try {
    return callback()
  } catch (error) {
    if (error === sealedError) return undefined
    throw error
  }
}

function runSynchronousCounterBoundary<T>(callback: () => T): T {
  if (sealedError) throw sealedError
  synchronousCounterDepth += 1
  try {
    return callback()
  } finally {
    synchronousCounterDepth -= 1
  }
}

function nextRevision(): number {
  return nextCounter('revision')
}

function nextEvaluationId(): number {
  return nextCounter('evaluationId')
}

function emitRuntimeError(
  error: unknown,
  revision: number | null,
  overrides: Partial<GridLayoutRuntimeError> = {},
): GridLayoutRuntimeError {
  const validation = error instanceof GridLayoutValidationError ? error : null
  const payload: GridLayoutRuntimeError = {
    code: validation?.code ?? 'invalid-config',
    source: validation?.code === 'invalid-layout' ? 'layout' : 'config',
    path: validation?.path ?? null,
    revision,
    evaluationId: nextEvaluationId(),
    cause: validation?.cause ?? error,
    ...overrides,
  }
  emit('error', { ...payload })
  return payload
}

const containerWidthApi = useContainerWidth(wrapper, {
  explicitWidth: () => props.width,
  onError: error => {
    if (disposing || sealedError) return
    emit('error', {
      ...error,
      evaluationId: nextEvaluationId(),
    })
  },
})

function emitOperationRejected(
  result: LayoutOperationResult,
  reason: LayoutOperationReason = result.reason as LayoutOperationReason,
  options: {
    revision?: number | null
    evaluationId?: number
    operation?: OperationRejectedPayload['operation']
    id?: LayoutItem['i'] | null
    candidate?: ReadonlyLayoutItem | null
    previousLayout?: ReadonlyLayout
    layout?: ReadonlyLayout
    nativeEvent?: Event | null
  } = {},
): OperationRejectedPayload {
  const previousLayout = cloneLayout(options.previousLayout ?? result.previousLayout)
  const layout = cloneLayout(options.layout ?? result.layout)
  const id = options.id !== undefined ? options.id : result.id
  const candidate =
    options.candidate !== undefined
      ? options.candidate
        ? cloneLayout([options.candidate])[0]
        : null
      : id === null
        ? null
        : result.candidate
          ? cloneLayout([result.candidate])[0]
          : (layout.find(item => Object.is(item.i, id)) ??
            previousLayout.find(item => Object.is(item.i, id)) ??
            null)
  const payload: OperationRejectedPayload = {
    revision: options.revision ?? null,
    evaluationId: options.evaluationId ?? nextEvaluationId(),
    operation: options.operation ?? result.operation,
    reason,
    id,
    previousLayout,
    layout,
    candidate,
    nativeEvent: options.nativeEvent ?? null,
  }
  emit('operation-rejected', payload)
  return payload
}

function emitEvaluationError(
  evaluation: LayoutEngineEvaluation,
  revision: number | null,
  evaluationId: number,
): void {
  const failure = evaluation.failure
  if (!failure) return
  if (failure.error instanceof GridLayoutExtensionError) {
    emitRuntimeError(failure.error, revision, {
      evaluationId,
      code: failure.error.code,
      source: failure.error.source,
      path: failure.error.path,
    })
  } else {
    emitRuntimeError(failure.error, revision, { evaluationId })
  }
}

function emitLayoutUpdated(
  layout: ReadonlyLayout,
  revision: number,
  source: LayoutUpdateMeta['source'],
) {
  emit('layout-updated', cloneLayout(layout), { revision, source })
}

function cancelTransitionRestore(): void {
  if (transitionFrame && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(transitionFrame)
  }
  transitionFrame = 0
}

function scheduleTransitionRestore(): void {
  cancelTransitionRestore()
  if (disposing || sealedError) return
  if (typeof requestAnimationFrame !== 'function') {
    nextTick(() => {
      if (disposing || sealedError) return
      state.suppressTransitions = false
    })
    return
  }
  transitionFrame = requestAnimationFrame(() => {
    if (disposing || sealedError) {
      transitionFrame = 0
      return
    }
    transitionFrame = requestAnimationFrame(() => {
      transitionFrame = 0
      if (disposing || sealedError) return
      state.suppressTransitions = false
    })
  })
}

onBeforeMount(() => {
  emit('layout-before-mount', cloneLayout(currentLayout.value))
})

onMounted(() => {
  mounted = true
  transfer.register()
  emit('layout-mounted', cloneLayout(currentLayout.value))
  if (initialLayoutNormalized && !responsiveMode.value) {
    const revision = nextRevision()
    emit('update:layout', cloneLayout(currentLayout.value), {
      revision,
      source: 'config',
    })
    emitLayoutUpdated(currentLayout.value, revision, 'config')
  }

  nextTick(() => {
    runAsyncBoundary(() => {
      state.originalLayout = cloneLayout(currentLayout.value)
      initResponsiveFeatures()
      window.addEventListener('directionchange', handleDirectionChange)
      processContainerWidth(containerWidthApi.width.value, true)
      validateRegisteredItems()
      autoHeight.refresh()
      scheduleTransitionRestore()
    })
  })
})

onBeforeUnmount(() => {
  transfer.unregister()
  disposing = true
  mounted = false
  finishDropSession(false)
  cancelPendingFrame()
  interactionBuffers.finishTerminal()
  discardPendingObservedWidth()
  cancelTransitionRestore()
  transactionController.disposePending()
  autoHeight.destroy()
  const activeInteraction = interaction.getActive()
  if (activeInteraction) {
    finishInteraction('cancelled', 'unmount', {
      revision: activeInteraction.latestRevision,
      nativeEvent: null,
    })
  }
  window.removeEventListener('directionchange', handleDirectionChange)
  emitter.clearAll()
  itemInstances.clear()
  registeredItems.clear()
})

function resizeEventHandler(
  eventType: string,
  i: number | string,
  x: number,
  y: number,
  h: number,
  w: number,
  nativeEvent?: Event,
) {
  resizeEvent(eventType, i, x, y, h, w, nativeEvent)
  if (eventType === 'resizeend') nextTick(() => autoHeight.refresh())
}

function dragEventHandler(
  eventType: string,
  i: number | string,
  x: number,
  y: number,
  h: number,
  w: number,
  nativeEvent?: Event,
) {
  dragEvent(eventType, i, x, y, h, w, nativeEvent)
  if (eventType === 'dragend') nextTick(() => autoHeight.refresh())
}

/** 在本地 interaction 与 document 级跨网格会话之间路由原生拖拽阶段。 */
function dragEvent(
  eventType: string,
  i: number | string,
  x: number,
  y: number,
  h: number,
  w: number,
  nativeEvent?: Event,
): void {
  if (eventType === 'dragstart') {
    if (nativeEvent && transfer.isBusy()) {
      getItem(i)?.resetInteractionState('drag')
      return
    }
    interactionDragEvent(eventType, i, x, y, h, w, nativeEvent)
    if (nativeEvent && interaction.isActive('drag', i)) transfer.start(i, nativeEvent)
    return
  }
  if (eventType === 'dragmove' && nativeEvent && transfer.move(nativeEvent)) return
  if (eventType === 'dragend' && nativeEvent && transfer.end(nativeEvent)) return
  interactionDragEvent(eventType, i, x, y, h, w, nativeEvent)
}

function syncItemEngineConfig(): void {
  const config = appliedEngineConfig.value
  emitter.emit('setColNum', config.cols)
  emitter.emit('setRowHeight', config.rowHeight)
  emitter.emit('setMaxRows', config.maxRows)
  emitter.emit('setDraggable', config.isDraggable)
  emitter.emit('setResizable', config.isResizable)
  emitter.emit('updateWidth', state.width)
}

function emitReadyOnce(): void {
  if (readyEmitted || disposing || sealedError) return
  readyEmitted = true
  emit('layout-ready', cloneLayout(currentLayout.value))
}

watch(
  [() => containerWidthApi.width.value, () => props.width === undefined] as const,
  ([value, observerSource], [, previousObserverSource]) => {
    if (!mounted) return
    if (!observerSource || observerSource !== previousObserverSource) {
      discardPendingObservedWidth()
      runAsyncBoundary(() => processContainerWidth(value, false, true))
      return
    }
    queueObservedWidth(value)
  },
  { flush: 'post' },
)
watch(
  () => state.width,
  value => {
    width.observeStateWidth(value)
    nextTick(() => runAsyncBoundary(autoHeight.refresh))
  },
  { flush: 'post' },
)
watch(
  [
    () => appliedEngineConfig.value.rowHeight,
    () => appliedEngineConfig.value.gap[1],
    () => appliedEngineConfig.value.maxRows,
  ],
  () => nextTick(() => runAsyncBoundary(autoHeight.refresh)),
  { flush: 'post' },
)
watch(
  () => props.layout,
  () => {
    if (responsive.isTransitionFlush()) return
    if (!Object.is(props.responsive, responsiveMode.value)) {
      if (!responsive.isFailureFlush()) applyResponsiveMode(props.responsive)
      return
    }
    runAsyncBoundary(observeLayoutProp)
    nextTick(() => runAsyncBoundary(autoHeight.refresh))
  },
  { deep: true, flush: 'post' },
)
watch(
  [() => props.breakpoints, () => props.cols, () => props.responsiveLayouts],
  () => runAsyncBoundary(observeResponsiveInputs),
  { deep: true, flush: 'post' },
)
watch(
  [
    effectiveColNum,
    effectiveRowHeight,
    effectiveMaxRows,
    effectiveIsDraggable,
    effectiveIsResizable,
    () => effectiveGap.value[0],
    () => effectiveGap.value[1],
    () => effectiveContainerPadding.value[0],
    () => effectiveContainerPadding.value[1],
    () => props.compactor,
    () => props.collisionMode,
    () => props.preventCollision,
  ],
  (value, previous) => {
    runAsyncBoundary(() => {
      const activeInteraction = interaction.getActive()
      const disabled =
        activeInteraction !== null &&
        ((activeInteraction.type === 'drag' && value[3] === false && previous[3] !== false) ||
          (activeInteraction.type === 'resize' && value[4] === false && previous[4] !== false))
      if (responsiveMode.value && state.width !== null) {
        if (activeInteraction) cancelActiveForConfig(disabled ? 'disabled' : 'config-changed')
        responsiveGridLayout()
      } else {
        applyEngineConfig(disabled ? 'disabled' : 'config-changed')
      }
      nextTick(() => runAsyncBoundary(autoHeight.refresh))
    })
  },
  { flush: 'post' },
)
watch(
  () => props.isBounded,
  value => {
    runAsyncBoundary(() => {
      if (interaction.getActive()?.type === 'drag') {
        cancelActiveForConfig('config-changed')
      }
      emitter.emit('setBounded', value)
    })
  },
)
watch(
  () => props.responsive,
  value => {
    if (responsive.isFailureFlush()) return
    runAsyncBoundary(() => applyResponsiveMode(value))
  },
  { flush: 'post' },
)
watch([effectiveRestoreOnDrag, () => props.bringToFrontOnInteract], () => {
  runAsyncBoundary(() => {
    if (interaction.hasActive()) interaction.deferConfigApply()
    else applyEngineConfig()
  })
})
watch(
  () => props.positionStrategy,
  strategy => runAsyncBoundary(() => applyPositionStrategy(strategy)),
  { flush: 'post' },
)
watch(
  [() => props.isDroppable, () => props.dropItem, () => props.dropConfig],
  () => {
    runAsyncBoundary(() => {
      let snapshot: DropConfigSnapshot
      try {
        snapshot = snapshotEffectiveDropConfig()
      } catch (error) {
        emitRuntimeError(error, null, { source: 'config' })
        return
      }
      invalidateDropProposal()
      appliedDropConfig.value = snapshot
    })
  },
  { flush: 'post' },
)
watch(
  () => props.resizeConfig?.handles,
  () => {
    runAsyncBoundary(() => {
      let handles: readonly ResizeHandleAxis[]
      try {
        handles = snapshotEffectiveResizeHandles()
      } catch (error) {
        emitRuntimeError(error, null, { source: 'config' })
        return
      }
      if (interaction.getActive()?.type === 'resize') {
        cancelActiveForConfig('config-changed')
      }
      appliedResizeHandles.value = handles
    })
  },
  { deep: true, flush: 'post' },
)
watch(
  () => props.transferConfig,
  value => {
    runAsyncBoundary(() => {
      let snapshot: TransferConfigSnapshot | null
      try {
        snapshot = snapshotTransferConfig(toRaw(value), toRaw)
      } catch (error) {
        emitRuntimeError(error, null, { source: 'config' })
        return
      }
      transfer.cancel()
      transfer.clearPreview()
      appliedTransferConfig.value = snapshot
    })
  },
  { deep: true, flush: 'post' },
)
watch(
  () => props.isMirrored,
  () => runAsyncBoundary(handleDirectionChange),
)

const adapterColNum = computed(() => appliedEngineConfig.value.cols)
const adapterRowHeight = computed(() => appliedEngineConfig.value.rowHeight)
const adapterMaxRows = computed(() => appliedEngineConfig.value.maxRows)
const adapterGap = computed(() => appliedEngineConfig.value.gap as [number, number])
const adapterContainerPadding = computed(() => appliedEngineConfig.value.containerPadding)
const adapterIsDraggable = computed(() => appliedEngineConfig.value.isDraggable)
const adapterIsResizable = computed(() => appliedEngineConfig.value.isResizable)
const adapterRestoreOnDrag = computed(() => appliedEngineConfig.value.restoreOnDrag)
const adapterCollisionMode = computed(() => appliedEngineConfig.value.collisionMode)

provide(
  LAYOUT_KEY,
  reactive({
    ...toRefs(props),
    ...toRefs(state),
    responsive: responsiveMode,
    autoSize: effectiveAutoSize,
    autoHeight: effectiveAutoHeight,
    colNum: adapterColNum,
    rowHeight: adapterRowHeight,
    maxRows: adapterMaxRows,
    gap: adapterGap,
    containerPadding: adapterContainerPadding,
    isDraggable: adapterIsDraggable,
    isResizable: adapterIsResizable,
    resizeHandles: appliedResizeHandles,
    isDroppable: effectiveIsDroppable,
    dropItem: effectiveDropItem,
    dragThreshold: effectiveDragThreshold,
    restoreOnDrag: adapterRestoreOnDrag,
    collisionMode: adapterCollisionMode,
    positionStrategy: appliedPositionStrategy,
    positionStyleRevision: toRefs(state).positionStyleRevision,
    positionStyleReady: toRefs(state).positionStyleReady,
    increaseItem,
    decreaseItem,
    updateItem,
    syncAutoHeightItem,
    removeAutoHeightItem,
    getLayoutItem: getInjectedLayoutItem,
    getItemZIndex,
    getPositionStyle,
    handleItemConfigChange,
    rejectItemInteraction,
  }) as unknown as LayoutInstance,
)
provide(EMITTER_KEY, emitter)

const exposed = {
  root: wrapper,
  setLayout,
  moveItem,
  resizeItem,
  addItem,
  removeItem,
  bringToFront,
  sendToBack,
}
defineExpose<GridLayoutExpose>(exposed)

function getInjectedLayoutItem(id: LayoutItem['i']): ReadonlyLayoutItem | undefined {
  const item = getLayoutItem(currentLayout.value, id)
  return item ? cloneLayout([item])[0] : undefined
}

function getItemZIndex(id: number | string) {
  return itemZIndexRanks.value.get(id)
}

function activeItemCandidate(): ReadonlyLayoutItem | null {
  const activeInteraction = interaction.getActive()
  if (!activeInteraction) return null
  const item = getLayoutItem(currentLayout.value, activeInteraction.id)
  return item ? cloneLayout([item])[0] : null
}

function handleItemConfigChange(
  item: GridItemRegistration,
  type: 'drag' | 'resize',
  error?: unknown,
): void {
  if (disposing || sealedError) return
  const active = interaction.getActive()
  const activeInteraction = active && active.id === item.i && active.type === type ? active : null
  if (!error) {
    if (activeInteraction) cancelActiveForConfig('config-changed')
    return
  }
  if (!(error instanceof GridLayoutValidationError)) throw error

  const revision = activeInteraction?.latestRevision ?? null
  const candidate = activeItemCandidate()
  if (activeInteraction) prepareActiveForTerminal()
  const evaluationId = nextEvaluationId()
  emitRuntimeError(error, revision, { evaluationId, source: 'config' })
  if (!activeInteraction) return

  const rejected: LayoutOperationResult = {
    operation: type === 'drag' ? 'move' : 'resize',
    id: activeInteraction.id,
    previousLayout: cloneLayout(committedLayout),
    layout: cloneLayout(committedLayout),
    candidate,
    status: 'rejected',
    reason: 'invalid-input',
  }
  emitOperationRejected(rejected, 'invalid-input', {
    revision,
    evaluationId,
    operation: 'config',
    id: activeInteraction.id,
    candidate,
  })
  finishInteraction('cancelled', 'config-changed', { revision, nativeEvent: null })
}

function rejectItemInteraction(
  type: 'drag' | 'resize',
  id: LayoutItem['i'],
  reason: LayoutOperationReason,
  nativeEvent: Event | null,
  error?: unknown,
): void {
  if (disposing || sealedError) return
  const active = interaction.getActive()
  const activeInteraction = active && active.id === id && active.type === type ? active : null
  const revision = activeInteraction?.latestRevision ?? null
  const candidate = activeInteraction ? activeItemCandidate() : (getInjectedLayoutItem(id) ?? null)
  if (activeInteraction && error) prepareActiveForTerminal()
  const evaluationId = nextEvaluationId()
  if (error) emitRuntimeError(error, revision, { evaluationId })
  const rejected: LayoutOperationResult = {
    operation: type === 'drag' ? 'move' : 'resize',
    id,
    previousLayout: cloneLayout(committedLayout),
    layout: cloneLayout(committedLayout),
    candidate,
    status: 'rejected',
    reason,
  }
  emitOperationRejected(rejected, reason, {
    revision,
    evaluationId,
    nativeEvent,
    candidate,
  })
  if (activeInteraction && error) {
    finishInteraction('cancelled', 'geometry-error', { revision, nativeEvent: null })
  }
}

function layoutUpdate() {
  observeLayoutProp()
}

function updateHeight() {
  state.mergedStyle = {
    height: containerHeight(),
  }
}

function containerHeight() {
  if (!effectiveAutoSize.value) return
  if (state.width === null) return '0px'

  const config = appliedEngineConfig.value
  const rows = bottom(currentLayout.value)
  const gapY = config.gap[1]
  const height =
    rows * config.rowHeight + Math.max(0, rows - 1) * gapY + config.containerPadding[1] * 2
  return `${height}px`
}

function derivedGeometryIsFinite(width: number): boolean {
  if (typeof width !== 'number' || !Number.isFinite(width) || width < 0) return false
  if (width === 0) return true
  const config = appliedEngineConfig.value
  const gapX = config.gap[0]
  const paddingX = config.containerPadding[0]
  const totalSpace = width - paddingX * 2 - gapX * (config.cols - 1)
  const cellWidth = totalSpace / config.cols
  return currentLayout.value.every(item => {
    const left = paddingX + item.x * (cellWidth + gapX)
    const right = left + item.w * cellWidth + Math.max(0, item.w - 1) * gapX
    const itemWidth = right - left
    return (
      Number.isFinite(left) &&
      Number.isFinite(right) &&
      Number.isFinite(itemWidth) &&
      left >= 0 &&
      itemWidth >= 0
    )
  })
}

function handleDirectionChange(): void {
  if (disposing || sealedError) return
  invalidateDropProposal()
  const evaluation = evaluatePositionStyleBatch(
    committedLayout,
    appliedPositionStrategy.value,
    state.width,
    appliedEngineConfig.value,
  )
  if (!evaluation.ok) {
    rejectPositionStyleBatch(
      evaluation,
      {
        operation: 'set',
        id: null,
        previousLayout: cloneLayout(committedLayout),
        layout: cloneLayout(committedLayout),
        candidate: null,
        status: 'rejected',
        reason: evaluation.reason,
      },
      'config',
    )
    return
  }
  if (interaction.hasActive()) cancelActiveForConfig('config-changed')
  commitPositionStyleMap(evaluation.styles, evaluation.ready, true)
  emitter.emit('directionchange')
}

function layoutUsesRtl(): boolean {
  const documentUsesRtl = getDocumentDir() === 'rtl'
  return props.isMirrored ? !documentUsesRtl : documentUsesRtl
}

width.primeInitialPositionStyles()
updateHeight()
</script>

<template>
  <div
    ref="wrapper"
    :class="[
      'vgl-layout',
      {
        'vgl-layout--suppress-transition': state.suppressTransitions,
      },
    ]"
    :style="renderedLayoutStyle"
    @focusin="rememberFocusedDescendant"
    @pointerdown.capture="rememberPointerFocus"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @drop="handleDrop"
    @dragleave="handleDragLeave"
  >
    <template v-if="$slots.item">
      <GridItem v-for="(item, index) in currentLayout" :key="item.i" v-bind="item" internal>
        <slot
          name="item"
          :item="item"
          :index="index"
          :style="getItem(item.i)?.state.style ?? {}"
          :is-dragging="interaction.isActive('drag', item.i)"
          :is-resizing="interaction.isActive('resize', item.i)"
        ></slot>
        <template v-if="$slots['resize-handle']" #resize-handle="{ axis, direction }">
          <slot
            name="resize-handle"
            :item="item"
            :index="index"
            :axis="axis"
            :direction="direction"
          ></slot>
        </template>
      </GridItem>
    </template>
    <slot v-else-if="$slots.default"></slot>
    <GridItem
      v-show="state.isDragging"
      class="vgl-item--placeholder"
      :x="state.placeholder.x"
      :y="state.placeholder.y"
      :w="state.placeholder.w"
      :h="state.placeholder.h"
      :i="state.placeholder.i"
      aria-hidden="true"
      decorative
      internal
    ></GridItem>
    <GridItem
      v-if="state.dropPlaceholder"
      class="vgl-item--placeholder"
      :x="state.dropPlaceholder.x"
      :y="state.dropPlaceholder.y"
      :w="state.dropPlaceholder.w"
      :h="state.dropPlaceholder.h"
      :i="'__drop__'"
      aria-hidden="true"
      decorative
      internal
    ></GridItem>
    <GridItem
      v-if="state.transferPlaceholder"
      class="vgl-item--placeholder"
      :x="state.transferPlaceholder.x"
      :y="state.transferPlaceholder.y"
      :w="state.transferPlaceholder.w"
      :h="state.transferPlaceholder.h"
      :i="'__transfer__'"
      aria-hidden="true"
      decorative
      internal
    ></GridItem>
  </div>
</template>
