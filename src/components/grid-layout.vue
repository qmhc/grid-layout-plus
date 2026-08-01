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
import { createEventEmitter, isNull } from '@vexip-ui/utils'
import { useContainerWidth } from '../composables/useContainerWidth'
import { EMITTER_KEY, LAYOUT_KEY, bottom, cloneLayout, getLayoutItem } from '../helpers/common'
import { getDocumentDir } from '../helpers/dom'
import {
  cloneResponsiveLayouts,
  createCompleteResponsiveLayouts,
  getBreakpointFromWidth,
  getColsFromBreakpoint,
  snapshotDormantResponsiveInputs,
  snapshotResponsiveConfig,
  snapshotResponsiveLayouts,
  sortBreakpoints,
} from '../helpers/responsive'
import { verticalCompactor } from '../core/compactors'
import { GridLayoutExtensionError, GridLayoutValidationError } from '../core/errors'
import {
  createLayoutEngine,
  createNormalizedLayoutEngine,
  layoutsGeometryEqual,
  layoutsSemanticallyEqual,
  mergeLayoutMetadata,
  snapshotEffectiveConfig,
  snapshotStrictLayout,
  snapshotUnresolvedLayout,
} from '../core/layout-engine'
import { transformStrategy } from '../core/position-strategies'
import { validatePositionGeometry, validatePositionStyleResult } from '../core/position-style'
import { InteractionTransactionBuffer } from '../core/transaction-buffer'
import { gridToPixelRect, isDerivedGeometryError, pointerToGridPosition } from '../core/utils'
import {
  readPlainDataObject,
  snapshotCompactor,
  snapshotDropConfig,
  snapshotDropResult,
  snapshotPositionStrategy,
} from '../core/validation'

import type {
  Breakpoint,
  CollisionMode,
  Compactor,
  CompleteResponsiveLayouts,
  Layout,
  LayoutItem,
  LayoutOperationReason,
  LayoutOperationResult,
  PositionStrategy,
  ReadonlyLayout,
  ReadonlyLayoutItem,
  ResponsiveLayoutsInput,
} from '../helpers/types'
import type { LayoutInstance } from '../helpers/internal-types'
import type { DormantResponsiveSnapshot, ResponsiveConfigSnapshot } from '../helpers/responsive'
import type {
  InternalEffectiveConfig,
  InternalInteractionSession,
  InternalLayoutCommand,
  LayoutEngineEvaluation,
} from '../core/layout-engine'
import type {
  DropCandidate,
  DropDragOverContext,
  DropDragOverInput,
  DropEvaluationResult,
  GridLayoutEmits,
  GridLayoutExpose,
  GridLayoutProps,
  InteractionChangePayload,
  InteractionStartPayload,
  LayoutTransactionReceipt,
  LayoutUpdateMeta,
  WidthChangedPayload,
} from './types'
import type {
  GridLayoutRuntimeError,
  InteractionCancelReason,
  InteractionTerminalPayload,
  OperationRejectedPayload,
  OperationRejectedReason,
} from '../composables/useGridLayout'
import type { DropConfigSnapshot } from '../core/validation'

const props = withDefaults(defineProps<GridLayoutProps>(), {
  autoSize: undefined,
  colNum: undefined,
  rowHeight: undefined,
  maxRows: undefined,
  margin: undefined,
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

let compactorInput = props.compactor
const compactorSnapshot = shallowRef(snapshotCompactor(compactorInput))
let positionStrategyInput = toRaw(props.positionStrategy)
const appliedPositionStrategy = shallowRef(snapshotPositionStrategy(positionStrategyInput))

/**
 * Config 合并逻辑：扁平 props 优先于分组 config。
 * 扁平 prop 显式传入时（非 undefined）优先使用；
 * 否则使用分组 config 中的值；最后回退到默认值。
 */

const effectiveAutoSize = computed(() => props.autoSize ?? props.gridConfig?.autoSize ?? true)
const effectiveColNum = computed(() => props.colNum ?? props.gridConfig?.colNum ?? 12)
const effectiveRowHeight = computed(() => props.rowHeight ?? props.gridConfig?.rowHeight ?? 150)
const effectiveMaxRows = computed(() => props.maxRows ?? props.gridConfig?.maxRows ?? Infinity)
const effectiveMarginInput = computed(() => props.margin ?? props.gridConfig?.margin)
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
  })
}

const appliedDropConfig = shallowRef(snapshotEffectiveDropConfig())
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
let dormantResponsiveErrorEpisode: Readonly<{ path: string | null; cause: unknown }> | null = null
let responsiveModeTransitionFlush = false
let responsiveModeFailureFlush = false
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

function invalidSpacing(path: string, cause: unknown): never {
  throw new GridLayoutValidationError(`Invalid responsive spacing at ${path}`, {
    code: 'invalid-config',
    path,
    cause,
  })
}

function resolveSpacing(
  value: unknown,
  path: 'config.margin' | 'config.containerPadding',
  fallback: readonly [number, number],
  breakpoint: Breakpoint | null,
  config: ResponsiveConfigSnapshot<Breakpoint> | null,
  responsive = responsiveMode.value,
): readonly [number, number] {
  if (value === undefined) return fallback
  if (Array.isArray(value)) return value as unknown as readonly [number, number]
  if (!responsive || breakpoint === null || !config) invalidSpacing(path, value)

  const properties = readPlainDataObject(value, {
    code: 'invalid-config',
    path,
  })
  const keys = Object.keys(properties)
  if (keys.length !== config.keys.length || config.keys.some(key => !keys.includes(key))) {
    const key =
      config.keys.find(candidate => !keys.includes(candidate)) ??
      keys.find(candidate => !config.keys.includes(candidate as Breakpoint)) ??
      ''
    invalidSpacing(`${path}[${JSON.stringify(key)}]`, key)
  }
  return properties[breakpoint] as readonly [number, number]
}

const effectiveMargin = computed<readonly [number, number]>(() =>
  resolveSpacing(
    effectiveMarginInput.value,
    'config.margin',
    [10, 10],
    responsiveMode.value ? spacingBreakpoint.value : null,
    committedResponsiveConfig,
  ),
)
const effectiveContainerPadding = computed<readonly [number, number]>(() =>
  resolveSpacing(
    effectiveContainerPaddingInput.value,
    'config.containerPadding',
    effectiveMargin.value,
    responsiveMode.value ? spacingBreakpoint.value : null,
    committedResponsiveConfig,
  ),
)

const effectiveConfig = computed(() => ({
  autoSize: effectiveAutoSize.value,
  colNum: effectiveColNum.value,
  rowHeight: effectiveRowHeight.value,
  maxRows: effectiveMaxRows.value,
  margin: effectiveMargin.value,
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
  counters: {
    revision: 0,
    evaluationId: 0,
  },
  positionStyleRevision: 0,
  positionStyleReady: false,
})

const itemInstances = new Map<number | string, any>()
const registeredItems = new Set<any>()
const registrationEpisodes = new WeakMap<object, string | null>()

const currentLayout = ref(cloneLayout(props.layout))
let committedLayout = cloneLayout(currentLayout.value)

interface DropProposalRecord {
  readonly sessionId: number
  readonly proposalId: number
  readonly breakpoint: Breakpoint | null
  readonly candidate: DropCandidate
  readonly previewLayout: ReadonlyLayout
  readonly insertionIndex: number
}

interface PendingDropCommit {
  readonly proposal: DropProposalRecord
  readonly epoch: number
}

let dropProposalSequence = 0
let dropSessionSequence = 0
let dropSessionId: number | null = null
let currentDropProposal: DropProposalRecord | null = null
let pendingDropCommit: PendingDropCommit | null = null
let deferredDropLayoutObservation = false
let deferredDropResponsiveLayoutsObservation = false
let dropCommitEpoch = 0
let dropEnterDepth = 0
let dropLeaveFrame = 0
let dropSessionListenersAttached = false
type PositionStyleMap = ReadonlyMap<LayoutItem['i'], Readonly<Record<string, string>>>

type PositionStyleBatchResult =
  | {
      ok: true
      styles: PositionStyleMap
      ready: boolean
    }
  | {
      ok: false
      cause: unknown
      path: string
      reason: 'invalid-input'
      runtimeCode: Extract<
        GridLayoutRuntimeError['code'],
        'invalid-layout' | 'invalid-config' | 'derived-geometry-overflow'
      >
      source: 'geometry'
    }
  | {
      ok: false
      cause: unknown
      path: string
      reason: Extract<LayoutOperationReason, 'extension-error' | 'extension-invalid-result'>
      runtimeCode: Extract<
        GridLayoutRuntimeError['code'],
        'extension-error' | 'extension-invalid-result'
      >
      source: 'position-strategy'
    }

const emptyPositionStyle = Object.freeze(Object.create(null)) as Readonly<Record<string, string>>
const positionStyles = shallowRef<ReadonlyMap<LayoutItem['i'], Readonly<Record<string, string>>>>(
  new Map(),
)
let committedPositionStyles: ReadonlyMap<
  LayoutItem['i'],
  Readonly<Record<string, string>>
> = new Map()
let positionStyleBlocked = false
const initialPositionWidth = initialWidth
let initialPositionStyleEvaluation: PositionStyleBatchResult | null = null
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
  const margin = resolveSpacing(
    effectiveMarginInput.value,
    'config.margin',
    [10, 10],
    responsiveBreakpoint,
    responsiveConfig,
    responsive,
  )
  const containerPadding = resolveSpacing(
    effectiveContainerPaddingInput.value,
    'config.containerPadding',
    margin,
    responsiveBreakpoint,
    responsiveConfig,
    responsive,
  )
  const resolved = snapshotEffectiveConfig({
    cols: currentColNum.value,
    rowHeight: effectiveRowHeight.value,
    margin,
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
let activeEngineInteraction: {
  type: 'drag' | 'resize'
  id: number | string
  session: InternalInteractionSession
  previousLayout: Layout
  oldItem: LayoutItem
  latestRevision: number | null
  latestNativeEvent: Event | null
  endRequested: boolean
  focusedElement: HTMLElement | null
} | null = null
let interactionViewRevision = 0
let disposing = false
let sealedError: GridLayoutValidationError | null = null
let synchronousCounterDepth = 0
let deadlineEpoch = 0
let pendingFrame = 0
let widthFrame = 0
let pendingObservedWidth: number | null = null
let hasPendingObservedWidth = false
let observedWidthFlushQueued = false
let transitionFrame = 0
let pointerFocusedElement: HTMLElement | null = null
const interactionBuffers = new InteractionTransactionBuffer()
let deferredConfigApply = false
let mounted = false
let readyEmitted = false
let awaitingInitialWidthResolution = true
let applyingContainerWidth = false
const unguardedWidth = Symbol('unguarded-width')
let guardedStateWidth: number | null | symbol = unguardedWidth

interface PendingTransaction {
  evaluation: LayoutEngineEvaluation
  revision: number
  expectedLayout: Layout
  baseLayout: Layout
  operation: LayoutOperationResult['operation'] | 'config'
  source: LayoutUpdateMeta['source']
  interaction: boolean
  metadataDirty: boolean
  deadlineStarted: boolean
  positionStyles: ReadonlyMap<LayoutItem['i'], Readonly<Record<string, string>>>
  responsive: PendingResponsiveTransaction | null
}

interface PendingResponsiveTransaction {
  expectedLayouts: CompleteResponsiveLayouts<Breakpoint>
  authorLayouts: ResponsiveLayoutsInput<Breakpoint>
  config: ResponsiveConfigSnapshot<Breakpoint>
  breakpoint: Breakpoint
  previousBreakpoint: Breakpoint | null
  layoutConfirmed: boolean
  layoutsConfirmed: boolean
  readyAfter: boolean
}

let pendingTransaction: PendingTransaction | null = null

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

function replaceEngineLayout(layout: ReadonlyLayout, config = resolveEngineConfig()): boolean {
  const hadActiveInteraction = activeEngineInteraction !== null
  const result = engine.replaceExternal(layout, config)
  if (result.status === 'rejected') return false
  engineConfig = config
  appliedEngineConfig.value = engineConfig
  activeEngineInteraction = null
  if (hadActiveInteraction) clearInteractionView()
  committedLayout = cloneLayout(result.layout)
  syncEngineLayout(result.layout)
  return true
}
const emitter = createEventEmitter()

emitter.on('resizeEvent', (...args: Parameters<typeof resizeEventHandler>) => {
  runAsyncBoundary(() => resizeEventHandler(...args))
})
emitter.on('dragEvent', (...args: Parameters<typeof dragEventHandler>) => {
  runAsyncBoundary(() => dragEventHandler(...args))
})

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
  const revision = activeEngineInteraction?.latestRevision ?? pendingTransaction?.revision ?? null
  sealedError = error
  deadlineEpoch += 1
  cancelPendingFrame()
  discardPendingObservedWidth()
  cancelTransitionRestore()
  if (pendingTransaction) {
    engine.rollback(pendingTransaction.evaluation)
    pendingTransaction = null
  }
  interactionBuffers.finishTerminal()
  state.dropPlaceholder = null
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
  if (activeEngineInteraction) {
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

function cloneResult(result: LayoutOperationResult): LayoutOperationResult {
  const previousLayout = cloneLayout(result.previousLayout)
  const layout = cloneLayout(result.layout)
  let candidate: ReadonlyLayoutItem | null = null
  if (result.candidate) {
    const source =
      result.operation === 'remove'
        ? previousLayout.find(item => Object.is(item.i, result.id))
        : layout.find(item => Object.is(item.i, result.id))
    candidate = source ?? cloneLayout([result.candidate])[0]
  }
  return {
    ...result,
    previousLayout,
    layout,
    candidate,
  } as LayoutOperationResult
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

function rememberSuperseded(layout: ReadonlyLayout): void {
  interactionBuffers.rememberSuperseded(layout)
}

function createNativeEvent(type: string, nativeEvent?: Event | null): Event {
  return nativeEvent ?? new Event(type)
}

function emitInteractionStart(nativeEvent?: Event | null): void {
  const interaction = activeEngineInteraction
  if (!interaction) return
  const layout = cloneLayout(interaction.previousLayout)
  const item = layout.find(entry => Object.is(entry.i, interaction.id))!
  const payload: InteractionStartPayload = {
    type: interaction.type,
    id: interaction.id,
    revision: null,
    oldItem: item,
    item,
    layout,
    placeholder: null,
    nativeEvent: createNativeEvent(`${interaction.type}start`, nativeEvent),
  }
  emit('interaction-start', payload)
}

function emitInteractionChange(
  result: LayoutOperationResult,
  revision: number,
  nativeEvent: Event | null,
): void {
  const interaction = activeEngineInteraction
  if (!interaction) return
  const layout = cloneLayout(result.layout)
  const item = layout.find(entry => Object.is(entry.i, interaction.id))!
  const previousLayout = cloneLayout(interaction.previousLayout)
  const oldItem = previousLayout.find(entry => Object.is(entry.i, interaction.id))!
  const payload: InteractionChangePayload = {
    type: interaction.type,
    id: interaction.id,
    revision,
    oldItem,
    item,
    layout,
    placeholder: cloneLayout([item])[0],
    nativeEvent,
  }
  emit('interaction-change', payload)
}

function restoreInteractionFocus(element: HTMLElement | null): void {
  if (!element) return
  nextTick(() => {
    if (disposing || sealedError) return
    if (element.isConnected && document.activeElement !== element) {
      element.focus({ preventScroll: true })
    }
  })
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

function finishInteraction(
  status: InteractionTerminalPayload['status'],
  reason: InteractionTerminalPayload['reason'],
  options: {
    revision?: number | null
    nativeEvent?: Event | null
    emitUpdated?: boolean
    silent?: boolean
  } = {},
): void {
  const interaction = activeEngineInteraction
  if (!interaction) return
  const previousLayout = cloneLayout(interaction.previousLayout)
  const layout = cloneLayout(committedLayout)
  const oldItem = previousLayout.find(item => Object.is(item.i, interaction.id))!
  const item = layout.find(entry => Object.is(entry.i, interaction.id)) ?? null
  const focusedElement = interaction.focusedElement
  const revision = options.revision ?? interaction.latestRevision

  clearInteractionView()
  engine.closeInteraction(interaction.session)
  activeEngineInteraction = null
  cancelPendingFrame()
  deadlineEpoch += 1
  interactionBuffers.finishTerminal()
  syncEngineLayout(committedLayout)
  restoreCommittedPositionStyleMap()
  const activeItem = itemInstances.get(interaction.id)
  activeItem?.resetInteractionState(interaction.type)
  activeItem?.refreshPositionStyle()
  updateHeight()

  if (!options.silent) {
    const payload = {
      type: interaction.type,
      id: interaction.id,
      revision,
      previousLayout,
      layout,
      oldItem,
      item,
      nativeEvent: options.nativeEvent ?? null,
      status,
      reason,
    } as InteractionTerminalPayload
    emit('interaction-end', payload)
    if (options.emitUpdated && revision !== null) {
      emitLayoutUpdated(committedLayout, revision, 'interaction')
    }
  }
  if (!disposing && !sealedError) {
    restoreInteractionFocus(focusedElement)
  }

  if (deferredConfigApply && !disposing && !sealedError) {
    deferredConfigApply = false
    nextTick(() => runAsyncBoundary(() => applyEngineConfig()))
  }
  schedulePendingObservedWidth()
}

function mergePendingMetadata(pending: PendingTransaction, observed: ReadonlyLayout): void {
  pending.expectedLayout = mergeLayoutMetadata(pending.expectedLayout, observed)
  pending.metadataDirty = true
  if (activeEngineInteraction) {
    syncEngineLayout(mergeLayoutMetadata(currentLayout.value, observed))
  }
}

function applyConfirmedResult(
  pending: PendingTransaction,
  observed: ReadonlyLayout,
): LayoutOperationResult {
  const result = engine.confirm(pending.evaluation)
  if (result.status === 'rejected') return result

  engineConfig = pending.evaluation.nextConfig
  appliedEngineConfig.value = engineConfig
  committedLayout = cloneLayout(result.layout)
  if (
    pending.metadataDirty ||
    !layoutsSemanticallyEqual(pending.expectedLayout, pending.evaluation.result.layout) ||
    !layoutsSemanticallyEqual(observed, pending.evaluation.result.layout)
  ) {
    committedLayout = cloneLayout(engine.mergeExternalMetadata(observed))
  }

  if (activeEngineInteraction && !activeEngineInteraction.endRequested) {
    syncEngineLayout(mergeLayoutMetadata(currentLayout.value, committedLayout))
  } else {
    syncEngineLayout(committedLayout)
  }
  commitPositionStyleMap(pending.positionStyles, state.width !== null && state.width > 0, true)
  syncItemEngineConfig()
  updateHeight()
  return result
}

function confirmPending(pending: PendingTransaction, observed: ReadonlyLayout): void {
  if (pendingTransaction !== pending) return
  pendingTransaction = null
  deadlineEpoch += 1
  const result = applyConfirmedResult(pending, observed)
  if (result.status === 'rejected') {
    emitOperationRejected(result, 'superseded', {
      revision: pending.revision,
      operation: pending.operation,
    })
    return
  }

  const responsive = pending.responsive
  if (responsive) {
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
        revision: pending.revision,
        source: 'responsive',
      })
    }
  }

  if (pending.interaction) {
    const interaction = activeEngineInteraction
    if (interaction?.endRequested) {
      const unchanged = layoutsSemanticallyEqual(interaction.previousLayout, committedLayout)
      finishInteraction(
        unchanged ? 'unchanged' : 'committed',
        unchanged ? 'same-value' : 'applied',
        {
          revision: pending.revision,
          nativeEvent: interaction.latestNativeEvent,
          emitUpdated: !unchanged,
        },
      )
    }
  } else {
    emitLayoutUpdated(committedLayout, pending.revision, pending.source)
    interactionBuffers.clearSuperseded()
    if (responsive?.readyAfter) emitReadyOnce()
  }
}

function tryConfirmResponsivePending(pending: PendingTransaction, observed: ReadonlyLayout): void {
  if (!pending.responsive) {
    confirmPending(pending, observed)
    return
  }
  if (pending.responsive.layoutConfirmed && pending.responsive.layoutsConfirmed) {
    confirmPending(pending, observed)
  }
}

function emitMetadataAfterRollback(pending: PendingTransaction): void {
  if (!pending.metadataDirty) return
  committedLayout = cloneLayout(engine.mergeExternalMetadata(pending.expectedLayout))
  syncEngineLayout(committedLayout)
  const revision = nextRevision()
  emitLayoutUpdated(committedLayout, revision, 'external')
}

function timeoutPending(pending: PendingTransaction): void {
  if (pendingTransaction !== pending || disposing) return
  engine.rollback(pending.evaluation)
  pendingTransaction = null
  syncEngineLayout(committedLayout)
  restoreCommittedPositionStyleMap()
  emitOperationRejected(pending.evaluation.result, 'external-not-committed', {
    revision: pending.revision,
    operation: pending.operation,
    previousLayout: pending.baseLayout,
    layout: committedLayout,
  })

  if (pending.interaction && activeEngineInteraction) {
    finishInteraction('cancelled', 'external-not-committed', {
      revision: pending.revision,
      nativeEvent: null,
    })
  } else {
    interactionBuffers.clearSuperseded()
  }
  emitMetadataAfterRollback(pending)
  if (pending.responsive?.readyAfter) emitReadyOnce()
}

function startPendingDeadline(pending: PendingTransaction): void {
  if (pending.deadlineStarted || disposing || sealedError) return
  pending.deadlineStarted = true
  const epoch = ++deadlineEpoch
  nextTick(() => {
    runAsyncBoundary(() => {
      if (epoch !== deadlineEpoch || pendingTransaction !== pending) return
      nextTick(() => {
        runAsyncBoundary(() => {
          if (epoch === deadlineEpoch && pendingTransaction === pending) timeoutPending(pending)
        })
      })
    })
  })
}

function supersedeNonInteractionPending(): void {
  const pending = pendingTransaction
  if (!pending || pending.interaction) return
  engine.rollback(pending.evaluation)
  pendingTransaction = null
  deadlineEpoch += 1
  rememberSuperseded(pending.expectedLayout)
  emitOperationRejected(pending.evaluation.result, 'superseded', {
    revision: pending.revision,
    operation: pending.operation,
    previousLayout: pending.baseLayout,
    layout: committedLayout,
  })
}

function beginPendingTransaction(
  evaluation: LayoutEngineEvaluation,
  operation: PendingTransaction['operation'],
  source: LayoutUpdateMeta['source'],
  interaction: boolean,
  nativeEvent: Event | null = null,
  evaluatedStyles: PositionStyleMap = committedPositionStyles,
  responsive: PendingResponsiveTransaction | null = null,
  revisionOverride: number | null = null,
): LayoutTransactionReceipt {
  if (!responsive) responsive = createCurrentResponsiveTransaction(evaluation.result)
  if (pendingTransaction) {
    if (interaction && pendingTransaction.interaction) {
      rememberSuperseded(pendingTransaction.expectedLayout)
    } else {
      supersedeNonInteractionPending()
    }
  }

  const result = evaluation.result
  if (result.status !== 'accepted' && !(responsive && result.status === 'unchanged')) {
    return cloneResult(result) as LayoutTransactionReceipt
  }
  const revision = revisionOverride ?? nextRevision()
  const pending: PendingTransaction = {
    evaluation,
    revision,
    expectedLayout: cloneLayout(result.layout),
    baseLayout: cloneLayout(result.previousLayout),
    operation,
    source,
    interaction,
    metadataDirty: false,
    deadlineStarted: false,
    positionStyles: new Map(evaluatedStyles),
    responsive,
  }
  pendingTransaction = pending
  if (activeEngineInteraction) {
    activeEngineInteraction.latestRevision = revision
    activeEngineInteraction.latestNativeEvent = nativeEvent
  }

  let completed = false
  try {
    if (responsive) {
      emit('update:responsive-layouts', cloneResponsiveLayouts(responsive.expectedLayouts), {
        revision,
        source,
      })
    }
    emit('update:layout', cloneLayout(result.layout), { revision, source })
    if (interaction) emitInteractionChange(result, revision, nativeEvent)
    completed = true
  } finally {
    if (!completed) {
      engine.rollback(evaluation)
      if (pendingTransaction === pending) pendingTransaction = null
      clearInteractionView()
    }
  }
  if (!interaction) startPendingDeadline(pending)
  return {
    status: 'pending',
    revision,
    proposal:
      result.status === 'accepted'
        ? (cloneResult(result) as Extract<LayoutOperationResult, { status: 'accepted' }>)
        : {
            ...cloneResult(result),
            status: 'accepted',
            reason: 'applied',
          },
  }
}

function snapshotObservedLayout(): Layout | null {
  try {
    const config = pendingTransaction?.evaluation.nextConfig ?? engineConfig
    return responsiveMode.value && state.width === null
      ? snapshotUnresolvedLayout(props.layout, config)
      : snapshotStrictLayout(props.layout, config)
  } catch (error) {
    const interaction = activeEngineInteraction
    if (!interaction) {
      emitRuntimeError(error, pendingTransaction?.revision ?? null)
      return null
    }

    const revision = interaction.latestRevision
    prepareActiveForTerminal()
    const evaluationId = nextEvaluationId()
    emitRuntimeError(error, revision, { evaluationId })
    const rejected: LayoutOperationResult = {
      operation: 'set',
      id: null,
      previousLayout: cloneLayout(committedLayout),
      layout: cloneLayout(committedLayout),
      candidate: null,
      status: 'rejected',
      reason: 'invalid-input',
    }
    emitOperationRejected(rejected, 'invalid-input', {
      revision,
      evaluationId,
      operation: 'set',
    })
    finishInteraction('cancelled', 'external-update', {
      revision,
      nativeEvent: null,
    })
    return null
  }
}

function expectedDropCommitLayout(
  observed: ReadonlyLayout,
  proposal: DropProposalRecord,
): Layout | null {
  const { insertionIndex, candidate, previewLayout } = proposal
  if (observed.length !== previewLayout.length + 1 || insertionIndex > previewLayout.length) {
    return null
  }
  const inserted = observed[insertionIndex]
  if (!inserted) return null
  if (previewLayout.some(item => Object.is(item.i, inserted.i))) return null
  const expected = cloneLayout(previewLayout)
  expected.splice(insertionIndex, 0, { ...candidate, i: inserted.i })
  return layoutsSemanticallyEqual(observed, expected) ? expected : null
}

function responsiveDropCommitMatches(
  observed: ReadonlyLayout,
  proposal: DropProposalRecord,
  config: InternalEffectiveConfig,
): CompleteResponsiveLayouts<Breakpoint> | null {
  const breakpoint = proposal.breakpoint
  if (!responsiveMode.value) return null
  if (
    breakpoint === null ||
    breakpoint !== state.lastBreakpoint ||
    !committedResponsiveConfig ||
    !committedCompleteLayouts
  ) {
    return null
  }
  const expected = cloneResponsiveLayouts(committedCompleteLayouts)
  expected[breakpoint] = cloneLayout(observed)
  try {
    const responsive = snapshotResponsiveLayouts(
      toRaw(props.responsiveLayouts),
      committedResponsiveConfig,
      config,
    )
    return responsiveLayoutsEqual(responsive, expected, committedResponsiveConfig) ? expected : null
  } catch {
    return null
  }
}

function tryConfirmDropCommit(observedOverride?: ReadonlyLayout): boolean {
  const pending = pendingDropCommit
  if (!pending || pending.epoch !== dropCommitEpoch) return false
  const proposal = pending.proposal
  if (proposal.proposalId !== dropProposalSequence) return false

  let observed: Layout
  let nextConfig: InternalEffectiveConfig
  try {
    nextConfig = resolveEngineConfig()
    observed = observedOverride
      ? cloneLayout(observedOverride)
      : snapshotStrictLayout(props.layout, nextConfig)
  } catch {
    return false
  }
  const expected = expectedDropCommitLayout(observed, proposal)
  if (!expected) return false
  const responsiveLayouts = responsiveMode.value
    ? responsiveDropCommitMatches(expected, proposal, nextConfig)
    : null
  if (responsiveMode.value && !responsiveLayouts) return false

  const styleEvaluation = evaluatePositionStyleBatch(
    expected,
    appliedPositionStrategy.value,
    state.width,
    nextConfig,
  )
  if (!styleEvaluation.ok) return false
  const replaced = engine.replaceExternal(expected, nextConfig)
  if (replaced.status === 'rejected') return false

  pendingDropCommit = null
  deferredDropLayoutObservation = false
  deferredDropResponsiveLayoutsObservation = false
  dropCommitEpoch += 1
  engineConfig = nextConfig
  appliedEngineConfig.value = nextConfig
  committedLayout = cloneLayout(expected)
  syncEngineLayout(committedLayout)
  commitPositionStyleMap(styleEvaluation.styles, styleEvaluation.ready, true)
  if (responsiveLayouts && proposal.breakpoint !== null && committedResponsiveConfig) {
    committedCompleteLayouts = responsiveLayouts
    committedAuthorLayouts = responsiveLayouts
    committedResponsivePropIdentity = toRaw(props.responsiveLayouts)
    state.layouts = cloneResponsiveLayouts(responsiveLayouts)
  }
  syncItemEngineConfig()
  updateHeight()
  emitLayoutUpdated(committedLayout, nextRevision(), 'drop-commit')
  validateRegisteredItems()
  return true
}

function startDropCommitDeadline(epoch: number): void {
  if (tryConfirmDropCommit()) return
  nextTick(() => {
    runAsyncBoundary(() => {
      if (epoch !== dropCommitEpoch || !pendingDropCommit) return
      if (tryConfirmDropCommit()) return
      nextTick(() => {
        runAsyncBoundary(() => {
          if (epoch !== dropCommitEpoch || !pendingDropCommit) return
          if (!tryConfirmDropCommit()) {
            const replayLayoutObservation = deferredDropLayoutObservation
            const replayResponsiveLayoutsObservation = deferredDropResponsiveLayoutsObservation
            invalidatePendingDropCommit()
            if (replayLayoutObservation) observeLayoutProp()
            if (replayResponsiveLayoutsObservation) observeResponsiveInputs()
          }
        })
      })
    })
  })
}

function acceptExternalLayout(observed: ReadonlyLayout, pending: PendingTransaction | null): void {
  const interaction = activeEngineInteraction
  const nextConfig = resolveEngineConfig()
  const styleEvaluation = evaluatePositionStyleBatch(
    observed,
    appliedPositionStrategy.value,
    state.width,
    nextConfig,
  )
  if (!styleEvaluation.ok) {
    if (pending) {
      engine.rollback(pending.evaluation)
      pendingTransaction = null
      deadlineEpoch += 1
      rememberSuperseded(pending.expectedLayout)
    }
    rejectPositionStyleBatch(
      styleEvaluation,
      {
        operation: 'set',
        id: null,
        previousLayout: cloneLayout(committedLayout),
        layout: cloneLayout(observed),
        candidate: null,
        status: 'rejected',
        reason: styleEvaluation.reason,
      },
      'set',
    )
    return
  }
  if (pending) {
    engine.rollback(pending.evaluation)
    pendingTransaction = null
    deadlineEpoch += 1
    rememberSuperseded(pending.expectedLayout)
  }
  const replaced = engine.replaceExternal(observed, nextConfig, {
    deferHorizontalBounds: responsiveMode.value && state.width === null,
  })
  if (replaced.status === 'rejected') return
  engineConfig = nextConfig
  appliedEngineConfig.value = engineConfig
  committedLayout = cloneLayout(replaced.layout)
  syncEngineLayout(committedLayout)
  commitPositionStyleMap(styleEvaluation.styles, styleEvaluation.ready, true)
  syncItemEngineConfig()
  updateHeight()

  if (pending && !pending.interaction) {
    emitOperationRejected(pending.evaluation.result, 'external-update', {
      revision: pending.revision,
      operation: pending.operation,
      previousLayout: pending.baseLayout,
      layout: committedLayout,
    })
  }

  const externalRevision = nextRevision()
  if (interaction) {
    finishInteraction('cancelled', 'external-update', {
      revision: interaction.latestRevision,
      nativeEvent: null,
    })
  }
  emitLayoutUpdated(committedLayout, externalRevision, 'external')
  validateRegisteredItems()
}

function observeLayoutProp(): void {
  if (disposing) return
  const observed = snapshotObservedLayout()
  if (!observed) return
  if (pendingDropCommit) {
    if (tryConfirmDropCommit(observed)) return
    if (responsiveMode.value) {
      deferredDropLayoutObservation = true
      return
    }
    invalidatePendingDropCommit()
  }
  if (currentDropProposal) invalidateDropProposal()

  const pending = pendingTransaction
  if (pending && layoutsGeometryEqual(observed, pending.expectedLayout)) {
    if (!layoutsSemanticallyEqual(observed, pending.expectedLayout)) {
      mergePendingMetadata(pending, observed)
    }
    if (pending.responsive) pending.responsive.layoutConfirmed = true
    tryConfirmResponsivePending(pending, observed)
    return
  }

  if (pending?.responsive) {
    if (!layoutsSemanticallyEqual(observed, committedLayout)) {
      emitRuntimeError(observed, pending.revision, {
        code: 'partial-responsive-update',
        source: 'layout',
        path: 'layout',
        cause: cloneLayout(observed),
      })
    }
    return
  }

  if (interactionBuffers.hasSuperseded(observed)) return

  if (pending) {
    if (layoutsGeometryEqual(observed, committedLayout)) {
      if (!layoutsSemanticallyEqual(observed, committedLayout)) {
        mergePendingMetadata(pending, observed)
        return
      }
      if (pending.interaction) {
        acceptExternalLayout(observed, pending)
      } else {
        engine.rollback(pending.evaluation)
        pendingTransaction = null
        deadlineEpoch += 1
        emitOperationRejected(pending.evaluation.result, 'external-update', {
          revision: pending.revision,
          operation: pending.operation,
          previousLayout: pending.baseLayout,
          layout: committedLayout,
        })
      }
      return
    }
    acceptExternalLayout(observed, pending)
    return
  }

  if (layoutsGeometryEqual(observed, committedLayout)) {
    if (layoutsSemanticallyEqual(observed, committedLayout)) return
    const styleEvaluation = evaluatePositionStyleBatch(
      observed,
      appliedPositionStrategy.value,
      state.width,
      appliedEngineConfig.value,
    )
    if (!styleEvaluation.ok) {
      rejectPositionStyleBatch(
        styleEvaluation,
        {
          operation: 'set',
          id: null,
          previousLayout: cloneLayout(committedLayout),
          layout: cloneLayout(observed),
          candidate: null,
          status: 'rejected',
          reason: styleEvaluation.reason,
        },
        'set',
      )
      return
    }
    committedLayout = cloneLayout(engine.mergeExternalMetadata(observed))
    syncEngineLayout(
      activeEngineInteraction
        ? mergeLayoutMetadata(currentLayout.value, committedLayout)
        : committedLayout,
    )
    if (!activeEngineInteraction) {
      commitPositionStyleMap(styleEvaluation.styles, styleEvaluation.ready, true)
      emitLayoutUpdated(committedLayout, nextRevision(), 'external')
    }
    return
  }

  acceptExternalLayout(observed, null)
}

function responsiveLayoutsEqual(
  first: ResponsiveLayoutsInput<Breakpoint>,
  second: CompleteResponsiveLayouts<Breakpoint>,
  config: ResponsiveConfigSnapshot<Breakpoint>,
): boolean {
  return config.keys.every(
    key => first[key] !== undefined && layoutsSemanticallyEqual(first[key]!, second[key]),
  )
}

function responsiveConfigsEqual(
  first: ResponsiveConfigSnapshot<Breakpoint>,
  second: ResponsiveConfigSnapshot<Breakpoint>,
): boolean {
  return (
    first.keys.length === second.keys.length &&
    first.keys.every(
      key =>
        second.keys.includes(key) &&
        first.breakpoints[key] === second.breakpoints[key] &&
        first.cols[key] === second.cols[key],
    )
  )
}

function reportDormantResponsiveError(error: unknown): void {
  const validation = error instanceof GridLayoutValidationError ? error : null
  const path = validation?.path ?? null
  const cause = validation?.cause ?? error
  if (
    dormantResponsiveErrorEpisode?.path === path &&
    Object.is(dormantResponsiveErrorEpisode.cause, cause)
  ) {
    return
  }
  dormantResponsiveErrorEpisode = { path, cause }
  emitRuntimeError(error, null)
}

function snapshotCurrentDormantResponsive(): DormantResponsiveSnapshot<Breakpoint> {
  return snapshotDormantResponsiveInputs<Breakpoint>(
    props.breakpoints,
    props.cols,
    toRaw(props.responsiveLayouts),
  )
}

function deferResponsiveModeRetry(): void {
  if (responsiveModeFailureFlush) return
  responsiveModeFailureFlush = true
  nextTick(() => {
    responsiveModeFailureFlush = false
  })
}

function observeResponsiveInputs(): void {
  if (disposing || responsiveModeTransitionFlush) return
  if (!Object.is(props.responsive, responsiveMode.value)) {
    if (!responsiveModeFailureFlush) applyResponsiveMode(props.responsive)
    return
  }
  if (!responsiveMode.value) {
    try {
      committedDormantResponsive = snapshotCurrentDormantResponsive()
      dormantResponsiveErrorEpisode = null
    } catch (error) {
      reportDormantResponsiveError(error)
    }
    return
  }

  if (pendingDropCommit) {
    if (tryConfirmDropCommit()) return
    try {
      const observedConfig = snapshotResponsiveConfig<Breakpoint>(props.breakpoints, props.cols)
      if (
        committedResponsiveConfig &&
        responsiveConfigsEqual(observedConfig, committedResponsiveConfig)
      ) {
        deferredDropResponsiveLayoutsObservation = true
        return
      }
    } catch {
      // 配置错误由下方响应式配置路径统一报告。
    }
  }

  if (pendingTransaction?.responsive) {
    try {
      const observedConfig = snapshotResponsiveConfig<Breakpoint>(props.breakpoints, props.cols)
      if (responsiveConfigsEqual(observedConfig, pendingTransaction.responsive.config)) {
        observeResponsiveLayoutsProp()
        return
      }
    } catch (error) {
      emitRuntimeError(error, null)
      return
    }
  }

  if (state.width !== null) {
    if (activeEngineInteraction) cancelActiveForConfig('config-changed')
    responsiveGridLayout()
  }
}

function observeResponsiveLayoutsProp(): void {
  if (disposing || !responsiveMode.value) return
  const pending = pendingTransaction
  if (!pending?.responsive) return

  let observed: ResponsiveLayoutsInput<Breakpoint>
  try {
    observed = snapshotResponsiveLayouts(
      toRaw(props.responsiveLayouts),
      pending.responsive.config,
      pending.evaluation.nextConfig,
    )
  } catch (error) {
    emitRuntimeError(error, pending.revision)
    return
  }
  if (
    !responsiveLayoutsEqual(observed, pending.responsive.expectedLayouts, pending.responsive.config)
  ) {
    emitRuntimeError(observed, pending.revision, {
      code: 'partial-responsive-update',
      source: 'layout',
      path: 'layout',
      cause: cloneResponsiveLayouts(observed),
    })
    return
  }
  pending.responsive.layoutsConfirmed = true
  if (pending.responsive.layoutConfirmed) {
    tryConfirmResponsivePending(pending, pending.expectedLayout)
  }
}

onBeforeMount(() => {
  emit('layout-before-mount', cloneLayout(currentLayout.value))
})

onMounted(() => {
  mounted = true
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
      scheduleTransitionRestore()
    })
  })
})

onBeforeUnmount(() => {
  disposing = true
  mounted = false
  finishDropSession(false)
  invalidatePendingDropCommit()
  deadlineEpoch += 1
  cancelPendingFrame()
  interactionBuffers.finishTerminal()
  discardPendingObservedWidth()
  cancelTransitionRestore()
  if (pendingTransaction) {
    engine.rollback(pendingTransaction.evaluation)
    pendingTransaction = null
  }
  if (activeEngineInteraction) {
    finishInteraction('cancelled', 'unmount', {
      revision: activeEngineInteraction.latestRevision,
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

function applyEngineConfig(
  activeCancelReason: Extract<
    InteractionCancelReason,
    'config-changed' | 'disabled'
  > = 'config-changed',
): LayoutOperationResult {
  invalidateDropProposal()
  invalidatePendingDropCommit()
  if (disposing) {
    return {
      operation: 'set',
      id: null,
      previousLayout: cloneLayout(committedLayout),
      layout: cloneLayout(committedLayout),
      candidate: null,
      status: 'rejected',
      reason: 'cancelled',
    }
  }
  supersedeNonInteractionPending()
  const previousColNum = currentColNum.value
  try {
    if (!responsiveMode.value) currentColNum.value = effectiveColNum.value
    const evaluation = engine.evaluate({
      type: 'config',
      config: resolveEngineConfig(),
    })
    const result = evaluation.result
    if (result.status === 'rejected') {
      currentColNum.value = engineConfig.cols
      const interaction = activeEngineInteraction
      const revision = interaction?.latestRevision ?? null
      const activeCandidate = interaction
        ? (cloneLayout(
            [getLayoutItem(currentLayout.value, interaction.id)].filter(
              (item): item is ReadonlyLayoutItem => item !== undefined,
            ),
          )[0] ?? null)
        : null
      if (interaction) prepareActiveForTerminal()
      const evaluationId = nextEvaluationId()
      emitEvaluationError(evaluation, revision, evaluationId)
      emitOperationRejected(result, result.reason, {
        revision,
        evaluationId,
        operation: 'config',
        id: interaction?.id ?? null,
        candidate: activeCandidate,
      })
      if (interaction) {
        finishInteraction('cancelled', 'config-changed', {
          revision,
          nativeEvent: null,
        })
      }
      return result
    }
    const styleEvaluation = evaluatePositionStyleBatch(
      result.layout,
      appliedPositionStrategy.value,
      state.width,
      evaluation.nextConfig,
    )
    if (!styleEvaluation.ok) {
      engine.rollback(evaluation)
      currentColNum.value = previousColNum
      return rejectPositionStyleBatch(styleEvaluation, result, 'config')
    }
    if (activeEngineInteraction) cancelActiveForConfig(activeCancelReason)
    if (result.status === 'accepted') {
      beginPendingTransaction(evaluation, 'config', 'config', false, null, styleEvaluation.styles)
      return result
    }
    confirmEngineEvaluation(evaluation)
    currentColNum.value = engineConfig.cols
    commitPositionStyleMap(styleEvaluation.styles, styleEvaluation.ready, true)
    syncItemEngineConfig()
    updateHeight()
    return result
  } catch (error) {
    currentColNum.value = previousColNum
    const interaction = activeEngineInteraction
    const revision = interaction?.latestRevision ?? null
    const activeCandidate = interaction
      ? (cloneLayout(
          [getLayoutItem(currentLayout.value, interaction.id)].filter(
            (item): item is ReadonlyLayoutItem => item !== undefined,
          ),
        )[0] ?? null)
      : null
    if (interaction) prepareActiveForTerminal()
    const evaluationId = nextEvaluationId()
    emitRuntimeError(error, revision, { evaluationId })
    const result: LayoutOperationResult = {
      operation: 'set',
      id: null,
      previousLayout: cloneLayout(committedLayout),
      layout: cloneLayout(committedLayout),
      candidate: null,
      status: 'rejected',
      reason: 'invalid-input',
    }
    emitOperationRejected(result, 'invalid-input', {
      revision,
      evaluationId,
      operation: 'config',
      id: interaction?.id ?? null,
      candidate: activeCandidate,
    })
    if (interaction) {
      finishInteraction('cancelled', 'config-changed', {
        revision,
        nativeEvent: null,
      })
    }
    return result
  }
}

function widthPayloadState(
  breakpoint: Breakpoint | null,
  cols: number,
  config: InternalEffectiveConfig = appliedEngineConfig.value,
): WidthChangedPayload['candidate'] {
  return {
    breakpoint,
    cols,
    margin: [config.margin[0], config.margin[1]],
    containerPadding: [config.containerPadding[0], config.containerPadding[1]],
  }
}

function emitReadyOnce(): void {
  if (readyEmitted || disposing || sealedError) return
  readyEmitted = true
  emit('layout-ready', cloneLayout(currentLayout.value))
}

function discardPendingObservedWidth(): void {
  if (widthFrame && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(widthFrame)
  }
  widthFrame = 0
  pendingObservedWidth = null
  hasPendingObservedWidth = false
  observedWidthFlushQueued = false
}

function schedulePendingObservedWidth(): void {
  if (
    disposing ||
    sealedError ||
    activeEngineInteraction ||
    !hasPendingObservedWidth ||
    observedWidthFlushQueued
  ) {
    return
  }

  observedWidthFlushQueued = true
  const flush = () => {
    widthFrame = 0
    observedWidthFlushQueued = false
    if (disposing || sealedError || activeEngineInteraction || !hasPendingObservedWidth) return
    const observed = pendingObservedWidth
    pendingObservedWidth = null
    hasPendingObservedWidth = false
    runAsyncBoundary(() => processContainerWidth(observed))
  }

  if (typeof requestAnimationFrame === 'function') {
    widthFrame = requestAnimationFrame(flush)
  } else {
    nextTick(flush)
  }
}

function queueObservedWidth(value: number | null): void {
  pendingObservedWidth = value
  hasPendingObservedWidth = true
  schedulePendingObservedWidth()
}

function processContainerWidth(value: number | null, initial = false, force = false): void {
  if (!initial && !force && Object.is(value, state.width)) return
  invalidateDropProposal()
  invalidatePendingDropCommit()
  if (value === null) {
    if (activeEngineInteraction) cancelActiveForConfig('config-changed')
    applyingContainerWidth = true
    guardedStateWidth = null
    state.width = null
    applyingContainerWidth = false
    commitPositionStyleMap(new Map(), false, true)
    emitter.emit('updateWidth', null)
    updateHeight()
    return
  }

  let responsiveConfig: ResponsiveConfigSnapshot<Breakpoint> | null = null
  let candidateBreakpoint: Breakpoint | null = null
  let candidateCols = appliedEngineConfig.value.cols
  let candidateEngineConfig = appliedEngineConfig.value
  try {
    if (responsiveMode.value) {
      responsiveConfig = snapshotResponsiveConfig<Breakpoint>(props.breakpoints, props.cols)
      candidateBreakpoint = getBreakpointFromWidth(responsiveConfig.breakpoints, value)
      candidateCols = responsiveConfig.cols[candidateBreakpoint]
      const previousCols = currentColNum.value
      try {
        currentColNum.value = candidateCols
        candidateEngineConfig = resolveEngineConfig(candidateBreakpoint, responsiveConfig, true)
      } finally {
        currentColNum.value = previousCols
      }
    }
  } catch (error) {
    emitRuntimeError(error, null)
    return
  }
  const initialResolution = awaitingInitialWidthResolution
  awaitingInitialWidthResolution = false
  const revision = nextRevision()
  const source = props.width === undefined ? 'observer' : 'explicit'
  const payload: WidthChangedPayload = {
    width: value,
    state: value === 0 ? 'resolved-zero' : 'resolved',
    source,
    responsive: responsiveMode.value,
    candidate: widthPayloadState(candidateBreakpoint, candidateCols, candidateEngineConfig),
    committed: widthPayloadState(state.lastBreakpoint, appliedEngineConfig.value.cols),
  }
  emit('width-changed', payload, { revision, source: 'width' })

  const styleEvaluation =
    initialResolution && initialPositionStyleEvaluation && Object.is(value, initialPositionWidth)
      ? initialPositionStyleEvaluation
      : evaluatePositionStyleBatch(
          committedLayout,
          appliedPositionStrategy.value,
          value,
          appliedEngineConfig.value,
        )
  initialPositionStyleEvaluation = null
  if (!styleEvaluation.ok) {
    if (initialResolution) commitPositionStyleMap(new Map(), false, true)
    rejectPositionStyleBatch(
      styleEvaluation,
      {
        operation: 'set',
        id: null,
        previousLayout: cloneLayout(committedLayout),
        layout: cloneLayout(committedLayout),
        candidate: null,
        status: 'rejected',
        reason: styleEvaluation.reason,
      },
      'config',
      { initial: initialResolution },
    )
    if (!initialResolution) return
  } else {
    if (activeEngineInteraction) cancelActiveForConfig('config-changed')
    commitPositionStyleMap(styleEvaluation.styles, styleEvaluation.ready, true)
    applyingContainerWidth = true
    guardedStateWidth = value
    state.width = value
    applyingContainerWidth = false
  }
  emitter.emit('updateWidth', value)
  updateHeight()

  const previousResponsiveMode = responsiveMode.value
  if (!responsiveModeFailureFlush && !Object.is(props.responsive, responsiveMode.value)) {
    applyResponsiveMode(props.responsive, revision, initialResolution)
  }
  const responsiveModeChanged = !Object.is(previousResponsiveMode, responsiveMode.value)
  if (responsiveMode.value && !responsiveModeChanged) {
    responsiveGridLayout(revision, initialResolution)
  }
  if (initialResolution && !responsiveMode.value) {
    nextTick(() => {
      nextTick(() => runAsyncBoundary(emitReadyOnce))
    })
  }
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
    if (Object.is(value, guardedStateWidth)) {
      guardedStateWidth = unguardedWidth
      return
    }
    if (mounted && !applyingContainerWidth) {
      runAsyncBoundary(() => processContainerWidth(value, false, true))
    }
  },
  { flush: 'post' },
)
watch(
  () => props.layout,
  () => {
    if (responsiveModeTransitionFlush) return
    if (!Object.is(props.responsive, responsiveMode.value)) {
      if (!responsiveModeFailureFlush) applyResponsiveMode(props.responsive)
      return
    }
    runAsyncBoundary(observeLayoutProp)
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
    () => effectiveMargin.value[0],
    () => effectiveMargin.value[1],
    () => effectiveContainerPadding.value[0],
    () => effectiveContainerPadding.value[1],
    () => props.compactor,
    () => props.collisionMode,
    () => props.preventCollision,
  ],
  (value, previous) => {
    runAsyncBoundary(() => {
      const disabled =
        activeEngineInteraction !== null &&
        ((activeEngineInteraction.type === 'drag' && value[3] === false && previous[3] !== false) ||
          (activeEngineInteraction.type === 'resize' &&
            value[4] === false &&
            previous[4] !== false))
      if (responsiveMode.value && state.width !== null) {
        if (activeEngineInteraction) cancelActiveForConfig(disabled ? 'disabled' : 'config-changed')
        responsiveGridLayout()
      } else {
        applyEngineConfig(disabled ? 'disabled' : 'config-changed')
      }
    })
  },
  { flush: 'post' },
)
watch(
  () => props.isBounded,
  value => {
    runAsyncBoundary(() => {
      if (activeEngineInteraction?.type === 'drag') cancelActiveForConfig('config-changed')
      emitter.emit('setBounded', value)
    })
  },
)
watch(
  () => props.responsive,
  value => {
    if (responsiveModeFailureFlush) return
    runAsyncBoundary(() => applyResponsiveMode(value))
  },
  { flush: 'post' },
)
watch([effectiveRestoreOnDrag, () => props.bringToFrontOnInteract], () => {
  runAsyncBoundary(() => {
    if (activeEngineInteraction) deferredConfigApply = true
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
      invalidatePendingDropCommit()
      appliedDropConfig.value = snapshot
    })
  },
  { flush: 'post' },
)
watch(
  () => props.isMirrored,
  () => runAsyncBoundary(handleDirectionChange),
)

const adapterColNum = computed(() => appliedEngineConfig.value.cols)
const adapterRowHeight = computed(() => appliedEngineConfig.value.rowHeight)
const adapterMaxRows = computed(() => appliedEngineConfig.value.maxRows)
const adapterMargin = computed(() => appliedEngineConfig.value.margin as [number, number])
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
    colNum: adapterColNum,
    rowHeight: adapterRowHeight,
    maxRows: adapterMaxRows,
    margin: adapterMargin,
    containerPadding: adapterContainerPadding,
    isDraggable: adapterIsDraggable,
    isResizable: adapterIsResizable,
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

function increaseItem(item: any) {
  if (disposing || sealedError) {
    item.state.registered = false
    return
  }
  registeredItems.add(item)
  nextTick(() => runAsyncBoundary(validateRegisteredItems))
}

function decreaseItem(item: any) {
  for (const [id, owner] of itemInstances) {
    if (owner === item && activeEngineInteraction?.id === id) {
      prepareActiveForTerminal()
      finishInteraction('cancelled', 'external-update', { nativeEvent: null })
      break
    }
  }
  registeredItems.delete(item)
  if (itemInstances.get(item.i) === item) itemInstances.delete(item.i)
  registrationEpisodes.delete(item)
  if (!disposing && !sealedError) nextTick(() => runAsyncBoundary(validateRegisteredItems))
}

function updateItem(item: any, previousId: LayoutItem['i']): void {
  if (disposing || sealedError) {
    item.state.registered = false
    return
  }
  if (!Object.is(previousId, item.i) && activeEngineInteraction?.id === previousId) {
    prepareActiveForTerminal()
    finishInteraction('cancelled', 'external-update', { nativeEvent: null })
  }
  if (Object.is(previousId, item.i)) {
    validateRegisteredItems()
    return
  }
  nextTick(() => runAsyncBoundary(validateRegisteredItems))
}

function getItem(id: number | string) {
  return itemInstances.get(id)
}

function getInjectedLayoutItem(id: LayoutItem['i']): ReadonlyLayoutItem | undefined {
  const item = getLayoutItem(currentLayout.value, id)
  return item ? cloneLayout([item])[0] : undefined
}

function getItemZIndex(id: number | string) {
  return itemZIndexRanks.value.get(id)
}

function emitRegistrationError(
  item: any,
  reason: string,
  options: { code?: GridLayoutRuntimeError['code']; path?: string } = {},
): void {
  if (registrationEpisodes.get(item) === reason) return
  registrationEpisodes.set(item, reason)
  const id = item.i as LayoutItem['i']
  emit('error', {
    code: options.code ?? 'invalid-registration',
    source: options.code === 'invalid-config' ? 'config' : 'grid-item',
    path: options.path ?? `gridItem[${JSON.stringify(String(id))}]`,
    revision: null,
    evaluationId: nextEvaluationId(),
    cause: options.code === 'invalid-config' ? { id } : { reason, id },
  })
}

function activeItemCandidate(): ReadonlyLayoutItem | null {
  const interaction = activeEngineInteraction
  if (!interaction) return null
  const item = getLayoutItem(currentLayout.value, interaction.id)
  return item ? cloneLayout([item])[0] : null
}

function handleItemConfigChange(item: any, type: 'drag' | 'resize', error?: unknown): void {
  if (disposing || sealedError) return
  const active = activeEngineInteraction
  const interaction = active && active.id === item.i && active.type === type ? active : null
  if (!error) {
    if (interaction) cancelActiveForConfig('config-changed')
    return
  }
  if (!(error instanceof GridLayoutValidationError)) throw error

  const revision = interaction?.latestRevision ?? null
  const candidate = activeItemCandidate()
  if (interaction) prepareActiveForTerminal()
  const evaluationId = nextEvaluationId()
  emitRuntimeError(error, revision, { evaluationId, source: 'config' })
  if (!interaction) return

  const rejected: LayoutOperationResult = {
    operation: type === 'drag' ? 'move' : 'resize',
    id: interaction.id,
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
    id: interaction.id,
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
  const active = activeEngineInteraction
  const interaction = active && active.id === id && active.type === type ? active : null
  const revision = interaction?.latestRevision ?? null
  const candidate = interaction ? activeItemCandidate() : (getInjectedLayoutItem(id) ?? null)
  if (interaction && error) prepareActiveForTerminal()
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
  if (interaction && error) {
    finishInteraction('cancelled', 'geometry-error', { revision, nativeEvent: null })
  }
}

function validateRegisteredItems(): void {
  if (disposing || sealedError) return
  const root = wrapper.value
  if (!root) return
  const previousOwners = new Map(itemInstances)
  itemInstances.clear()
  for (const item of registeredItems) {
    const id = item.i as LayoutItem['i']
    const node = item.wrapper as HTMLElement | undefined
    const wasRegistered = item.state.registered
    let reason: string | null = null
    let path: string | undefined
    let code: GridLayoutRuntimeError['code'] | undefined

    if (!getLayoutItem(currentLayout.value, id)) {
      reason = 'missing-id'
    } else if (
      !item.internal &&
      (!node || node.ownerDocument !== root.ownerDocument || !root.contains(node))
    ) {
      reason = 'outside-root'
    } else if (!item.internal && node?.offsetParent !== root) {
      reason = 'invalid-containing-block'
    } else if (itemInstances.has(id)) {
      reason = 'duplicate'
    }

    item.state.registered = reason === null
    if (reason === null) {
      itemInstances.set(id, item)
      registrationEpisodes.set(item, null)
    } else {
      item.disableInteractionBinding()
      item.resetInteractionState()
      if (wasRegistered) item.refreshPositionStyle()
      const invalidatesActive =
        previousOwners.get(id) === item && activeEngineInteraction?.id === id
      if (invalidatesActive) prepareActiveForTerminal()
      emitRegistrationError(item, reason, { code, path })
      if (invalidatesActive) {
        finishInteraction('cancelled', 'external-update', { nativeEvent: null })
      }
    }
  }
}

function layoutUpdate() {
  observeLayoutProp()
}

function commandId(command: InternalLayoutCommand): LayoutItem['i'] | null {
  if (command.type === 'set' || command.type === 'config' || command.type === 'add') return null
  const id: unknown = command.id
  return (typeof id === 'string' && id.length > 0) ||
    (typeof id === 'number' && Number.isSafeInteger(id) && !Object.is(id, -0))
    ? id
    : null
}

function submitCommand(command: InternalLayoutCommand): LayoutTransactionReceipt {
  return runSynchronousCounterBoundary(() => {
    if (disposing) {
      return {
        operation: command.type === 'config' ? 'set' : command.type,
        id: 'id' in command ? command.id : null,
        previousLayout: cloneLayout(committedLayout),
        layout: cloneLayout(committedLayout),
        candidate: null,
        status: 'rejected',
        reason: 'cancelled',
      } as LayoutTransactionReceipt
    }
    if (responsiveMode.value && state.lastBreakpoint === null) {
      const result: LayoutOperationResult = {
        operation: command.type === 'config' ? 'set' : command.type,
        id: commandId(command),
        previousLayout: cloneLayout(committedLayout),
        layout: cloneLayout(committedLayout),
        candidate: null,
        status: 'rejected',
        reason: 'disabled',
      }
      emitOperationRejected(result, 'disabled', { candidate: null })
      return cloneResult(result) as LayoutTransactionReceipt
    }
    supersedeNonInteractionPending()
    const evaluation = engine.evaluate(command)
    const result = evaluation.result
    if (result.status === 'rejected') {
      emitOperationRejected(result)
      return cloneResult(result) as LayoutTransactionReceipt
    }
    if (result.status === 'unchanged') return cloneResult(result) as LayoutTransactionReceipt
    const styleEvaluation = evaluatePositionStyleBatch(
      result.layout,
      appliedPositionStrategy.value,
      state.width,
      evaluation.nextConfig,
    )
    if (!styleEvaluation.ok) {
      engine.rollback(evaluation)
      return cloneResult(
        rejectPositionStyleBatch(styleEvaluation, result, result.operation),
      ) as LayoutTransactionReceipt
    }
    return beginPendingTransaction(
      evaluation,
      result.operation,
      'programmatic',
      false,
      null,
      styleEvaluation.styles,
    )
  })
}

function setLayout(layout: ReadonlyLayout): LayoutTransactionReceipt {
  return submitCommand({ type: 'set', layout })
}

function moveItem(id: LayoutItem['i'], x: number, y: number): LayoutTransactionReceipt {
  return submitCommand({ type: 'move', id, x, y })
}

function resizeItem(id: LayoutItem['i'], w: number, h: number): LayoutTransactionReceipt {
  return submitCommand({ type: 'resize', id, w, h })
}

function addItem(item: ReadonlyLayoutItem): LayoutTransactionReceipt {
  return submitCommand({ type: 'add', item })
}

function removeItem(id: LayoutItem['i']): LayoutTransactionReceipt {
  return submitCommand({ type: 'remove', id })
}

function updateItemLayer(
  id: LayoutItem['i'],
  placement: 'front' | 'back',
): LayoutTransactionReceipt {
  return submitCommand({ type: 'layer', id, direction: placement })
}

/** 将指定元素移到最前，并归一化所有元素层级。 */
function bringToFront(id: LayoutItem['i']): LayoutTransactionReceipt {
  return updateItemLayer(id, 'front')
}

/** 将指定元素移到最后，并归一化所有元素层级。 */
function sendToBack(id: LayoutItem['i']): LayoutTransactionReceipt {
  return updateItemLayer(id, 'back')
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
  const marginY = config.margin[1]
  const height =
    rows * config.rowHeight + Math.max(0, rows - 1) * marginY + config.containerPadding[1] * 2
  return `${height}px`
}

function derivedGeometryIsFinite(width: number): boolean {
  if (typeof width !== 'number' || !Number.isFinite(width) || width < 0) return false
  if (width === 0) return true
  const config = appliedEngineConfig.value
  const totalSpace = width - config.margin[0] * (config.cols + 1)
  return currentLayout.value.every(item => {
    const left = (totalSpace * item.x) / config.cols + config.margin[0] * (item.x + 1)
    const right =
      (totalSpace * (item.x + item.w)) / config.cols + config.margin[0] * (item.x + item.w + 1)
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
  invalidatePendingDropCommit()
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
  if (activeEngineInteraction) cancelActiveForConfig('config-changed')
  commitPositionStyleMap(evaluation.styles, evaluation.ready, true)
  emitter.emit('directionchange')
}

function layoutUsesRtl(): boolean {
  const documentUsesRtl = getDocumentDir() === 'rtl'
  return props.isMirrored ? !documentUsesRtl : documentUsesRtl
}

function calculatePositionGeometry(
  item: ReadonlyLayoutItem,
  width: number,
  config: InternalEffectiveConfig,
) {
  const rect = gridToPixelRect(item, {
    width,
    cols: config.cols,
    rowHeight: config.rowHeight,
    margin: config.margin,
    containerPadding: config.containerPadding,
    rtl: layoutUsesRtl(),
    effectiveScale: appliedPositionStrategy.value.transformScale ?? 1,
  })
  return validatePositionGeometry(
    rect.top,
    rect.inlineStart,
    rect.width,
    rect.height,
    layoutUsesRtl() ? 'rtl' : 'ltr',
  )
}

function calculateZIndexRanks(layout: ReadonlyLayout): Map<LayoutItem['i'], number> {
  const ordered = layout
    .map((item, index) => ({ id: item.i, index, zIndex: item.zIndex ?? 0 }))
    .sort((first, second) => first.zIndex - second.zIndex || first.index - second.index)
  return new Map(ordered.map((item, rank) => [item.id, rank]))
}

/**
 * 按 Layout 原顺序求值到 detached map；调用方只在整批成功后提交该 map。
 */
function evaluatePositionStyleBatch(
  layout: ReadonlyLayout,
  strategy: PositionStrategy,
  width: number | null,
  config: InternalEffectiveConfig,
): PositionStyleBatchResult {
  if (width === null || width <= 0) return { ok: true, styles: new Map(), ready: false }

  const usesCssTransforms = strategy.usesCssTransforms

  const useRtl = layoutUsesRtl()
  const ranks = calculateZIndexRanks(layout)
  const styles = new Map<LayoutItem['i'], Readonly<Record<string, string>>>()
  for (const [index, item] of layout.entries()) {
    const basePath = `layout[${index}].style`
    let geometry
    try {
      geometry = calculatePositionGeometry(item, width, config)
    } catch (error) {
      const validation = error instanceof GridLayoutValidationError ? error : null
      return {
        ok: false,
        cause: error,
        path: validation?.path ?? basePath,
        reason: 'invalid-input',
        runtimeCode: isDerivedGeometryError(error)
          ? 'derived-geometry-overflow'
          : (validation?.code ?? 'invalid-config'),
        source: 'geometry',
      }
    }

    let ltrValue: unknown
    try {
      ltrValue = strategy.getStyle(
        geometry.top,
        geometry.inlineStart,
        geometry.width,
        geometry.height,
      )
    } catch (error) {
      return {
        ok: false,
        cause: error,
        path: basePath,
        reason: 'extension-error',
        runtimeCode: 'extension-error',
        source: 'position-strategy',
      }
    }
    const ltr = validatePositionStyleResult(ltrValue, usesCssTransforms, 'ltr', geometry, basePath)
    if (!ltr.ok) {
      return {
        ok: false,
        cause: ltr.cause,
        path: ltr.path,
        reason: 'extension-invalid-result',
        runtimeCode: 'extension-invalid-result',
        source: 'position-strategy',
      }
    }

    let rtlValue: unknown
    try {
      rtlValue = strategy.getRtlStyle(
        geometry.top,
        geometry.inlineStart,
        geometry.width,
        geometry.height,
      )
    } catch (error) {
      return {
        ok: false,
        cause: error,
        path: basePath,
        reason: 'extension-error',
        runtimeCode: 'extension-error',
        source: 'position-strategy',
      }
    }
    const rtl = validatePositionStyleResult(rtlValue, usesCssTransforms, 'rtl', geometry, basePath)
    if (!rtl.ok) {
      return {
        ok: false,
        cause: rtl.cause,
        path: rtl.path,
        reason: 'extension-invalid-result',
        runtimeCode: 'extension-invalid-result',
        source: 'position-strategy',
      }
    }

    styles.set(
      item.i,
      Object.freeze({
        ...(useRtl ? rtl.style : ltr.style),
        '--vgl-item-z-index': String(ranks.get(item.i)),
      }),
    )
  }

  // GridItem 会以最小/最大尺寸初始化 resize 约束，提交宽度前同步覆盖这些可达边界。
  try {
    for (const registeredItem of registeredItems) {
      if (!registeredItem.state.registered || !registeredItem.state.resizable) continue
      const item = getLayoutItem(layout, registeredItem.i)
      if (!item || item.static) continue
      const maximumW = Math.min(item.maxW ?? Infinity, config.cols - item.x)
      const maximumH = Math.min(item.maxH ?? Infinity, config.maxRows - item.y)
      for (const [w, h] of [
        [item.minW ?? 1, item.minH ?? 1],
        [maximumW === Infinity ? 1 : maximumW, maximumH === Infinity ? 1 : maximumH],
      ] as const) {
        calculatePositionGeometry({ ...item, x: 0, y: 0, w, h }, width, config)
      }
    }
  } catch (error) {
    const validation = error instanceof GridLayoutValidationError ? error : null
    return {
      ok: false,
      cause: error,
      path: validation?.path ?? 'geometry',
      reason: 'invalid-input',
      runtimeCode: isDerivedGeometryError(error)
        ? 'derived-geometry-overflow'
        : (validation?.code ?? 'invalid-config'),
      source: 'geometry',
    }
  }

  return { ok: true, styles, ready: true }
}

function commitPositionStyleMap(
  styles: PositionStyleMap,
  ready: boolean,
  commit: boolean,
  unblock = true,
): void {
  if (unblock) positionStyleBlocked = false
  positionStyles.value = new Map(styles)
  state.positionStyleReady = ready && !positionStyleBlocked
  state.positionStyleRevision += 1
  if (commit) {
    committedPositionStyles = new Map(styles)
  }
}

function disablePositionInteractions(): void {
  positionStyleBlocked = true
  state.positionStyleReady = false
  for (const item of registeredItems) item.disableInteractionBinding()
}

function restoreCommittedPositionStyleMap(): void {
  commitPositionStyleMap(
    committedPositionStyles,
    state.width !== null && state.width > 0,
    false,
    false,
  )
}

function getPositionStyle(id: LayoutItem['i']): Readonly<Record<string, string>> {
  return positionStyles.value.get(id) ?? emptyPositionStyle
}

function rejectPositionStyleBatch(
  failure: Extract<PositionStyleBatchResult, { ok: false }>,
  result: LayoutOperationResult,
  operation: OperationRejectedPayload['operation'],
  options: { initial?: boolean; deferInteractionFinish?: boolean } = {},
): LayoutOperationResult {
  const interaction = activeEngineInteraction
  const revision = interaction?.latestRevision ?? null
  const candidate = interaction
    ? (result.candidate ?? getLayoutItem(currentLayout.value, interaction.id) ?? null)
    : result.candidate
  if (interaction) {
    if (options.deferInteractionFinish) clearInteractionView()
    else prepareActiveForTerminal()
  }
  disablePositionInteractions()
  const evaluationId = nextEvaluationId()
  emitRuntimeError(failure.cause, revision, {
    code: failure.runtimeCode,
    source: failure.source,
    path: failure.path,
    evaluationId,
    ...(failure.source === 'geometry' ? { cause: failure.cause } : {}),
  })
  const rejected: LayoutOperationResult = {
    operation: result.operation,
    id: result.id,
    previousLayout: cloneLayout(committedLayout),
    layout: cloneLayout(committedLayout),
    candidate: result.candidate,
    status: 'rejected',
    reason: failure.reason,
  }
  if (!options.initial && (failure.source !== 'geometry' || interaction)) {
    emitOperationRejected(rejected, failure.reason, {
      revision,
      evaluationId,
      operation,
      id: interaction?.id ?? result.id,
      candidate,
      previousLayout: committedLayout,
      layout: committedLayout,
    })
  }
  if (interaction && !options.deferInteractionFinish) {
    finishInteraction(
      'cancelled',
      failure.source === 'geometry' ? 'geometry-error' : failure.reason,
      { revision, nativeEvent: null },
    )
  }
  return rejected
}

function rejectPositionStrategyConfig(error: GridLayoutValidationError): void {
  const interaction = activeEngineInteraction
  const revision = interaction?.latestRevision ?? null
  const candidate = interaction ? activeItemCandidate() : null
  if (interaction) prepareActiveForTerminal()
  const evaluationId = nextEvaluationId()
  emitRuntimeError(error, revision, {
    code: 'invalid-config',
    source: 'config',
    path: error.path,
    evaluationId,
  })
  const rejected: LayoutOperationResult = {
    operation: 'set',
    id: null,
    previousLayout: cloneLayout(committedLayout),
    layout: cloneLayout(committedLayout),
    candidate: null,
    status: 'rejected',
    reason: 'invalid-input',
  }
  emitOperationRejected(rejected, 'invalid-input', {
    revision,
    evaluationId,
    operation: 'config',
    id: interaction?.id ?? null,
    candidate,
  })
  if (interaction) {
    finishInteraction('cancelled', 'config-changed', { revision, nativeEvent: null })
  }
}

function applyPositionStrategy(strategy: PositionStrategy): void {
  invalidateDropProposal()
  invalidatePendingDropCommit()
  const rawStrategy = toRaw(strategy)
  if (Object.is(rawStrategy, positionStrategyInput)) return

  let snapshot: PositionStrategy
  try {
    snapshot = snapshotPositionStrategy(rawStrategy)
  } catch (error) {
    if (!(error instanceof GridLayoutValidationError)) throw error
    rejectPositionStrategyConfig(error)
    return
  }

  const evaluation = evaluatePositionStyleBatch(
    committedLayout,
    snapshot,
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
  if (activeEngineInteraction) cancelActiveForConfig('config-changed')
  positionStrategyInput = rawStrategy
  appliedPositionStrategy.value = snapshot
  commitPositionStyleMap(evaluation.styles, evaluation.ready, true)
}

if (initialPositionWidth !== null) {
  initialPositionStyleEvaluation = evaluatePositionStyleBatch(
    committedLayout,
    appliedPositionStrategy.value,
    initialPositionWidth,
    appliedEngineConfig.value,
  )
  if (initialPositionStyleEvaluation.ok) {
    positionStyles.value = new Map(initialPositionStyleEvaluation.styles)
    committedPositionStyles = new Map(initialPositionStyleEvaluation.styles)
    state.positionStyleRevision += 1
  } else {
    positionStyleBlocked = true
  }
}
updateHeight()

function cancelActiveForConfig(
  reason: Extract<InteractionCancelReason, 'config-changed' | 'disabled'>,
) {
  prepareActiveForTerminal()
  finishInteraction('cancelled', reason, { nativeEvent: null })
}

function prepareActiveForTerminal(): void {
  const interaction = activeEngineInteraction
  const pending = pendingTransaction
  if (pending?.interaction) {
    engine.rollback(pending.evaluation)
    pendingTransaction = null
    deadlineEpoch += 1
    rememberSuperseded(pending.expectedLayout)
  }
  cancelPendingFrame()
  clearInteractionView()
  restoreCommittedPositionStyleMap()
  if (interaction) {
    const activeItem = itemInstances.get(interaction.id)
    activeItem?.resetInteractionState(interaction.type)
    activeItem?.refreshPositionStyle()
  }
}

function beginEngineInteraction(
  type: 'drag' | 'resize',
  id: LayoutItem['i'],
  nativeEvent?: Event | null,
): boolean {
  if (disposing || sealedError) return false
  validateRegisteredItems()
  const started = engine.beginInteraction({ type, id })
  if (started.status === 'rejected') {
    if (started.result.reason !== 'interaction-active') {
      emitOperationRejected(started.result, started.result.reason, {
        nativeEvent: nativeEvent ?? null,
      })
    }
    return false
  }
  invalidateDropProposal()
  invalidatePendingDropCommit()
  const previousLayout = cloneLayout(committedLayout)
  const oldItem = previousLayout.find(item => Object.is(item.i, id))!
  const activeElement =
    document.activeElement instanceof HTMLElement && wrapper.value?.contains(document.activeElement)
      ? document.activeElement
      : pointerFocusedElement?.isConnected && wrapper.value?.contains(pointerFocusedElement)
        ? pointerFocusedElement
        : null
  pointerFocusedElement = null
  activeEngineInteraction = {
    type,
    id,
    session: started.session,
    previousLayout,
    oldItem,
    latestRevision: null,
    latestNativeEvent: nativeEvent ?? null,
    endRequested: false,
    focusedElement: activeElement,
  }
  state.placeholder = {
    i: id,
    x: oldItem.x,
    y: oldItem.y,
    w: oldItem.w,
    h: oldItem.h,
  }
  showInteractionView()
  emitInteractionStart(nativeEvent)
  return true
}

function rememberFocusedDescendant(event: FocusEvent): void {
  pointerFocusedElement = event.target instanceof HTMLElement ? event.target : null
}

function rememberPointerFocus(): void {
  const activeElement = document.activeElement
  pointerFocusedElement =
    activeElement instanceof HTMLElement && wrapper.value?.contains(activeElement)
      ? activeElement
      : null
}

function evaluateInteractionCandidate(
  type: 'drag' | 'resize',
  id: LayoutItem['i'],
  next: { x: number; y: number } | { w: number; h: number },
  nativeEvent: Event | null,
  terminal = false,
  terminalState: { cancelReason: InteractionCancelReason | null } | null = null,
): LayoutOperationResult | null {
  const interaction = activeEngineInteraction
  if (!interaction || interaction.type !== type || interaction.id !== id) {
    return null
  }
  const evaluation = engine.evaluateInteraction(
    interaction.session,
    type === 'drag'
      ? {
          type,
          x: (next as { x: number; y: number }).x,
          y: (next as { x: number; y: number }).y,
          ...(terminal ? { terminal: true as const } : {}),
        }
      : {
          type,
          w: (next as { w: number; h: number }).w,
          h: (next as { w: number; h: number }).h,
          ...(terminal ? { terminal: true as const } : {}),
        },
  )
  const result = evaluation.result
  if (result.status === 'rejected') {
    const evaluationId = nextEvaluationId()
    if (evaluation.failure?.kind === 'extension') {
      clearInteractionView()
      emitEvaluationError(evaluation, interaction.latestRevision, evaluationId)
    }
    emitOperationRejected(result, result.reason, {
      revision: interaction.latestRevision,
      evaluationId,
      nativeEvent,
    })
    if (result.reason === 'extension-error' || result.reason === 'extension-invalid-result') {
      if (terminalState) terminalState.cancelReason = result.reason
      else finishInteraction('cancelled', result.reason, { nativeEvent: null })
    }
    return result
  }
  if (result.status === 'unchanged') return result

  const styleEvaluation = evaluatePositionStyleBatch(
    result.layout,
    appliedPositionStrategy.value,
    state.width,
    evaluation.nextConfig,
  )
  if (!styleEvaluation.ok) {
    engine.rollback(evaluation)
    const rejected = rejectPositionStyleBatch(styleEvaluation, result, result.operation, {
      deferInteractionFinish: terminalState !== null,
    })
    if (terminalState) {
      terminalState.cancelReason =
        styleEvaluation.source === 'geometry' ? 'geometry-error' : styleEvaluation.reason
    }
    return rejected
  }
  commitPositionStyleMap(styleEvaluation.styles, styleEvaluation.ready, false)
  syncEngineLayout(result.layout)
  const target = getLayoutItem(currentLayout.value, id)!
  state.placeholder = {
    i: id,
    x: target.x,
    y: target.y,
    w: target.w,
    h: target.h,
  }
  showInteractionView()
  emitter.emit('compact')
  updateHeight()
  beginPendingTransaction(
    evaluation,
    result.operation,
    'interaction',
    true,
    nativeEvent,
    styleEvaluation.styles,
  )
  return result
}

function showInteractionView(): void {
  interactionViewRevision += 1
  state.isDragging = true
}

function clearInteractionView(): void {
  interactionViewRevision += 1
  state.isDragging = false
  state.placeholder = {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    i: '',
  }
}

function cancelPendingFrame(): void {
  if (pendingFrame && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(pendingFrame)
  }
  pendingFrame = 0
  interactionBuffers.clearProposal()
}

function flushPendingCandidate(): LayoutOperationResult | null {
  const candidate = interactionBuffers.takeProposal()
  if (!candidate) return null
  if (pendingFrame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(pendingFrame)
  pendingFrame = 0
  return evaluateInteractionCandidate(
    candidate.type,
    candidate.id,
    candidate.value,
    candidate.nativeEvent,
  )
}

function scheduleInteractionCandidate(
  type: 'drag' | 'resize',
  id: LayoutItem['i'],
  value: { x: number; y: number } | { w: number; h: number },
  nativeEvent: Event | null,
): void {
  if (disposing || sealedError) return
  interactionBuffers.replaceProposal({ type, id, value, nativeEvent })
  if (pendingFrame) return
  if (typeof requestAnimationFrame !== 'function') {
    flushPendingCandidate()
    return
  }
  pendingFrame = requestAnimationFrame(() => {
    pendingFrame = 0
    runAsyncBoundary(flushPendingCandidate)
  })
}

function endActiveInteraction(nativeEvent: Event | null): void {
  const interaction = activeEngineInteraction
  if (!interaction) return
  interaction.latestNativeEvent = nativeEvent
  interaction.endRequested = true
  const pending = pendingTransaction
  if (pending?.interaction) {
    startPendingDeadline(pending)
    return
  }
  const unchanged = layoutsSemanticallyEqual(interaction.previousLayout, committedLayout)
  finishInteraction(unchanged ? 'unchanged' : 'committed', unchanged ? 'same-value' : 'applied', {
    revision: interaction.latestRevision,
    nativeEvent,
    emitUpdated: !unchanged,
  })
}

function cancelInteraction(_token?: unknown): boolean {
  if (!activeEngineInteraction) return false
  const pending = pendingTransaction
  if (pending?.interaction) {
    engine.rollback(pending.evaluation)
    pendingTransaction = null
    rememberSuperseded(pending.expectedLayout)
  }
  cancelPendingFrame()
  finishInteraction('cancelled', 'cancelled', { nativeEvent: null })
  return true
}

function discardNativeTerminalAfterListenerError(
  type: 'drag' | 'resize',
  id: LayoutItem['i'],
): void {
  const interaction = activeEngineInteraction
  if (!interaction || interaction.type !== type || interaction.id !== id) return
  prepareActiveForTerminal()
  finishInteraction('cancelled', 'cancelled', { nativeEvent: null, silent: true })
}

function finishNativeInteraction(
  type: 'drag' | 'resize',
  id: LayoutItem['i'],
  candidate: { x: number; y: number } | { w: number; h: number },
  nativeEvent: Event | null,
): void {
  cancelPendingFrame()
  const terminalState: { cancelReason: InteractionCancelReason | null } = {
    cancelReason: null,
  }
  let listenersCompleted = false
  try {
    evaluateInteractionCandidate(type, id, candidate, nativeEvent, true, terminalState)
    const interaction = activeEngineInteraction
    if (interaction?.type === type && interaction.id === id) {
      const item = getLayoutItem(currentLayout.value, id) ?? null
      const activeItem = itemInstances.get(id)
      if (type === 'drag') activeItem?.finishDragInteraction(item)
      else activeItem?.finishResizeInteraction(item)
    }
    listenersCompleted = true
  } finally {
    if (!listenersCompleted) discardNativeTerminalAfterListenerError(type, id)
  }

  const interaction = activeEngineInteraction
  if (!interaction || interaction.type !== type || interaction.id !== id) return
  if (terminalState.cancelReason) {
    const revision = interaction.latestRevision
    prepareActiveForTerminal()
    finishInteraction('cancelled', terminalState.cancelReason, {
      revision,
      nativeEvent: null,
    })
    return
  }
  endActiveInteraction(nativeEvent)
}

function dragEvent(
  eventName: string,
  id: number | string,
  x: number,
  y: number,
  _h: number,
  _w: number,
  nativeEvent?: Event,
) {
  if (!getLayoutItem(currentLayout.value, id)) return
  if (eventName === 'dragstart') {
    if (responsiveMode.value) responsiveGridLayout()
    if (!beginEngineInteraction('drag', id, nativeEvent)) {
      itemInstances.get(id)?.resetInteractionState('drag')
      return
    }
    evaluateInteractionCandidate('drag', id, { x, y }, nativeEvent ?? null)
    return
  }
  if (eventName === 'dragmove') {
    scheduleInteractionCandidate('drag', id, { x, y }, nativeEvent ?? null)
    return
  }
  if (eventName === 'dragend') {
    finishNativeInteraction('drag', id, { x, y }, nativeEvent ?? null)
  }
}

function resizeEvent(
  eventName: string | undefined,
  id: number | string,
  _x: number,
  _y: number,
  h: number,
  w: number,
  nativeEvent?: Event,
) {
  if (!getLayoutItem(currentLayout.value, id)) return
  if (eventName === 'resizestart') {
    if (responsiveMode.value) responsiveGridLayout()
    if (!beginEngineInteraction('resize', id, nativeEvent)) {
      itemInstances.get(id)?.resetInteractionState('resize')
      return
    }
    evaluateInteractionCandidate('resize', id, { w, h }, nativeEvent ?? null)
    return
  }
  if (eventName === 'resizemove') {
    scheduleInteractionCandidate('resize', id, { w, h }, nativeEvent ?? null)
    return
  }
  if (eventName === 'resizeend') {
    finishNativeInteraction('resize', id, { w, h }, nativeEvent ?? null)
  }
}

function createCurrentResponsiveTransaction(
  result: LayoutOperationResult,
): PendingResponsiveTransaction | null {
  const breakpoint = state.lastBreakpoint
  if (
    !responsiveMode.value ||
    breakpoint === null ||
    !committedCompleteLayouts ||
    !committedResponsiveConfig
  ) {
    return null
  }
  const expectedLayouts = cloneResponsiveLayouts(committedCompleteLayouts)
  expectedLayouts[breakpoint] = cloneLayout(result.layout)
  return {
    expectedLayouts,
    authorLayouts: expectedLayouts,
    config: committedResponsiveConfig,
    breakpoint,
    previousBreakpoint: breakpoint,
    layoutConfirmed: false,
    layoutsConfirmed: false,
    readyAfter: false,
  }
}

function snapshotCommittedAuthorFor(
  config: ResponsiveConfigSnapshot<Breakpoint>,
  nextConfig: InternalEffectiveConfig,
): ResponsiveLayoutsInput<Breakpoint> {
  if (hasExternalResponsiveAuthor()) {
    return snapshotResponsiveLayouts(toRaw(props.responsiveLayouts), config, nextConfig)
  }
  const candidate = Object.create(null) as Partial<Record<Breakpoint, ReadonlyLayout>>
  for (const key of config.keys) {
    const layout = committedAuthorLayouts[key]
    if (!layout) continue
    try {
      snapshotResponsiveLayouts({ [key]: layout }, config, nextConfig)
      candidate[key] = layout
    } catch (error) {
      if (!(error instanceof GridLayoutValidationError) || error.code !== 'invalid-layout') {
        throw error
      }
    }
  }
  return snapshotResponsiveLayouts(candidate, config, nextConfig)
}

function hasExternalResponsiveAuthor(): boolean {
  if (Object.is(toRaw(props.responsiveLayouts), committedResponsivePropIdentity)) return false
  if (!committedResponsiveConfig || !committedCompleteLayouts) return true
  try {
    const observed = snapshotResponsiveLayouts(
      toRaw(props.responsiveLayouts),
      committedResponsiveConfig,
      appliedEngineConfig.value,
    )
    return !responsiveLayoutsEqual(observed, committedCompleteLayouts, committedResponsiveConfig)
  } catch {
    return true
  }
}

function responsiveModelsMatch(
  complete: CompleteResponsiveLayouts<Breakpoint>,
  breakpoint: Breakpoint,
  config: ResponsiveConfigSnapshot<Breakpoint>,
  nextConfig: InternalEffectiveConfig,
): boolean {
  try {
    const observedLayout = snapshotStrictLayout(props.layout, nextConfig)
    const observedLayouts = snapshotResponsiveLayouts(
      toRaw(props.responsiveLayouts),
      config,
      nextConfig,
    )
    return (
      layoutsSemanticallyEqual(observedLayout, complete[breakpoint]) &&
      responsiveLayoutsEqual(observedLayouts, complete, config)
    )
  } catch {
    return false
  }
}

interface PreparedResponsiveLayout {
  config: ResponsiveConfigSnapshot<Breakpoint>
  author: ResponsiveLayoutsInput<Breakpoint>
  complete: CompleteResponsiveLayouts<Breakpoint>
  breakpoint: Breakpoint
  engineConfig: InternalEffectiveConfig
}

function prepareResponsiveLayout(
  configOverride?: ResponsiveConfigSnapshot<Breakpoint>,
  authorOverride?: ResponsiveLayoutsInput<Breakpoint>,
): PreparedResponsiveLayout {
  if (state.width === null) {
    throw new GridLayoutValidationError('Responsive width is unresolved', {
      code: 'invalid-config',
      path: 'config.width',
      cause: null,
    })
  }
  const previousCols = currentColNum.value
  try {
    const config =
      configOverride ?? snapshotResponsiveConfig<Breakpoint>(props.breakpoints, props.cols)
    const breakpoint = getBreakpointFromWidth(config.breakpoints, state.width)
    currentColNum.value = config.cols[breakpoint]
    const candidateConfig = resolveEngineConfig(breakpoint, config, true)
    const author = authorOverride ?? snapshotCommittedAuthorFor(config, candidateConfig)
    const complete = createCompleteResponsiveLayouts(
      author,
      initialResponsiveFallback,
      config,
      candidateConfig,
      'layout',
    )
    return {
      config,
      author,
      complete,
      breakpoint,
      engineConfig: candidateConfig,
    }
  } finally {
    currentColNum.value = previousCols
  }
}

function responsiveGridLayout(
  revisionOverride: number | null = null,
  readyAfter = false,
  preparedOverride?: PreparedResponsiveLayout,
) {
  if (state.width === null) return
  invalidateDropProposal()
  invalidatePendingDropCommit()
  readyAfter ||= mounted && !readyEmitted && !awaitingInitialWidthResolution

  let prepared: PreparedResponsiveLayout
  try {
    prepared = preparedOverride ?? prepareResponsiveLayout()
  } catch (error) {
    const revision = revisionOverride
    const extension = error instanceof GridLayoutExtensionError ? error : null
    const runtime = emitRuntimeError(error, revision, {
      ...(extension
        ? {
            code: extension.code,
            source: extension.source,
            path: extension.path,
          }
        : {}),
    })
    const rejected: LayoutOperationResult = {
      operation: 'set',
      id: null,
      previousLayout: cloneLayout(committedLayout),
      layout: cloneLayout(committedLayout),
      candidate: null,
      status: 'rejected',
      reason: extension?.code ?? 'invalid-input',
    }
    emitOperationRejected(rejected, rejected.reason, {
      revision,
      evaluationId: runtime.evaluationId,
      operation: 'config',
    })
    if (readyAfter) emitReadyOnce()
    return
  }
  const {
    config,
    author,
    complete,
    breakpoint: newBreakpoint,
    engineConfig: candidateEngineConfig,
  } = prepared

  const evaluation = engine.evaluate({
    type: 'set',
    layout: complete[newBreakpoint],
    config: candidateEngineConfig,
  })
  const result = evaluation.result
  if (result.status === 'rejected') {
    const evaluationId = nextEvaluationId()
    emitEvaluationError(evaluation, revisionOverride, evaluationId)
    emitOperationRejected(result, result.reason, {
      revision: revisionOverride,
      evaluationId,
      operation: 'config',
    })
    if (readyAfter) emitReadyOnce()
    return
  }
  const styleEvaluation = evaluatePositionStyleBatch(
    result.layout,
    appliedPositionStrategy.value,
    state.width,
    evaluation.nextConfig,
  )
  if (!styleEvaluation.ok) {
    engine.rollback(evaluation)
    rejectPositionStyleBatch(styleEvaluation, result, 'config', { initial: readyAfter })
    if (readyAfter) emitReadyOnce()
    return
  }

  const revision = revisionOverride ?? nextRevision()
  const responsive: PendingResponsiveTransaction = {
    expectedLayouts: complete,
    authorLayouts: author,
    config,
    breakpoint: newBreakpoint,
    previousBreakpoint: state.lastBreakpoint,
    layoutConfirmed: false,
    layoutsConfirmed: false,
    readyAfter,
  }
  if (
    state.lastBreakpoint === newBreakpoint &&
    layoutsSemanticallyEqual(result.layout, committedLayout)
  ) {
    supersedeNonInteractionPending()
    const confirmed = confirmEngineEvaluation(evaluation)
    if (confirmed.status === 'rejected') {
      if (readyAfter) emitReadyOnce()
      return
    }
    committedResponsiveConfig = config
    committedAuthorLayouts = author
    committedCompleteLayouts = complete
    committedResponsivePropIdentity = toRaw(props.responsiveLayouts)
    state.layouts = cloneResponsiveLayouts(complete)
    currentColNum.value = engineConfig.cols
    commitPositionStyleMap(styleEvaluation.styles, styleEvaluation.ready, true)
    syncItemEngineConfig()
    updateHeight()
    if (readyAfter) emitReadyOnce()
    return
  }
  if (
    responsiveModelsMatch(complete, newBreakpoint, config, evaluation.nextConfig) &&
    (readyAfter || state.lastBreakpoint === newBreakpoint)
  ) {
    supersedeNonInteractionPending()
    const confirmed = confirmEngineEvaluation(evaluation)
    if (confirmed.status === 'rejected') {
      if (readyAfter) emitReadyOnce()
      return
    }
    committedResponsiveConfig = config
    committedAuthorLayouts = author
    committedCompleteLayouts = complete
    committedResponsivePropIdentity = toRaw(props.responsiveLayouts)
    state.layouts = cloneResponsiveLayouts(complete)
    state.lastBreakpoint = newBreakpoint
    spacingBreakpoint.value = newBreakpoint
    currentColNum.value = engineConfig.cols
    commitPositionStyleMap(styleEvaluation.styles, styleEvaluation.ready, true)
    syncItemEngineConfig()
    updateHeight()
    if (responsive.previousBreakpoint !== newBreakpoint) {
      emit('breakpoint-changed', newBreakpoint, cloneLayout(committedLayout), {
        revision,
        source: 'responsive',
      })
    }
    emitLayoutUpdated(committedLayout, revision, 'responsive')
    if (readyAfter) emitReadyOnce()
    return
  }

  beginPendingTransaction(
    evaluation,
    'config',
    'responsive',
    false,
    null,
    styleEvaluation.styles,
    responsive,
    revision,
  )
}

function initResponsiveFeatures() {
  state.layouts = committedCompleteLayouts
    ? cloneResponsiveLayouts(committedCompleteLayouts)
    : (cloneResponsiveLayouts(committedAuthorLayouts) as Record<Breakpoint, Layout>)
}

function applyResponsiveMode(
  value: boolean,
  revisionOverride: number | null = null,
  readyAfter = false,
): void {
  if (Object.is(value, responsiveMode.value)) return

  let dormant: DormantResponsiveSnapshot<Breakpoint>
  try {
    dormant = snapshotCurrentDormantResponsive()
  } catch (error) {
    reportDormantResponsiveError(error)
    deferResponsiveModeRetry()
    return
  }

  if (value) {
    let config: ResponsiveConfigSnapshot<Breakpoint>
    let author: ResponsiveLayoutsInput<Breakpoint>
    let prepared: PreparedResponsiveLayout | undefined
    const previousCols = currentColNum.value
    try {
      config = snapshotResponsiveConfig<Breakpoint>(dormant.breakpoints, dormant.cols)
      const breakpoint =
        state.width === null
          ? config.sorted[0]
          : getBreakpointFromWidth(config.breakpoints, state.width)
      currentColNum.value = config.cols[breakpoint]
      const candidateConfig = resolveEngineConfig(breakpoint, config, true)
      author = snapshotResponsiveLayouts(dormant.layouts, config, candidateConfig)
      if (state.width !== null) {
        const complete = createCompleteResponsiveLayouts(
          author,
          initialResponsiveFallback,
          config,
          candidateConfig,
          'layout',
        )
        prepared = {
          config,
          author,
          complete,
          breakpoint,
          engineConfig: candidateConfig,
        }
      }
    } catch (error) {
      emitRuntimeError(error, null)
      deferResponsiveModeRetry()
      return
    } finally {
      currentColNum.value = previousCols
    }

    if (activeEngineInteraction) cancelActiveForConfig('config-changed')
    supersedeNonInteractionPending()
    responsiveModeTransitionFlush = true
    responsiveMode.value = true
    committedDormantResponsive = dormant
    dormantResponsiveErrorEpisode = null
    committedResponsiveConfig = config
    committedAuthorLayouts = author
    committedCompleteLayouts = null
    committedResponsivePropIdentity = toRaw(props.responsiveLayouts)
    state.lastBreakpoint = null
    spacingBreakpoint.value = null
    state.layouts = cloneResponsiveLayouts(author) as Record<Breakpoint, Layout>
    if (state.width !== null) {
      responsiveGridLayout(revisionOverride, readyAfter, prepared)
    }
    nextTick(() => {
      responsiveModeTransitionFlush = false
      if (pendingTransaction?.responsive) {
        runAsyncBoundary(observeLayoutProp)
        runAsyncBoundary(observeResponsiveInputs)
      }
    })
    return
  }

  const previousBreakpoint = state.lastBreakpoint
  const previousLayout = cloneLayout(committedLayout)
  const previousCols = currentColNum.value
  let nextConfig: InternalEffectiveConfig
  let observed: Layout
  let styles: PositionStyleBatchResult
  try {
    currentColNum.value = effectiveColNum.value
    nextConfig = resolveEngineConfig(null, null, false)
    observed = snapshotStrictLayout(props.layout, nextConfig)
    styles = evaluatePositionStyleBatch(
      observed,
      appliedPositionStrategy.value,
      state.width,
      nextConfig,
    )
    if (!styles.ok) {
      rejectPositionStyleBatch(
        styles,
        {
          operation: 'set',
          id: null,
          previousLayout: cloneLayout(committedLayout),
          layout: observed,
          candidate: null,
          status: 'rejected',
          reason: styles.reason,
        },
        'config',
      )
      deferResponsiveModeRetry()
      return
    }
  } catch (error) {
    emitRuntimeError(error, null)
    deferResponsiveModeRetry()
    return
  } finally {
    currentColNum.value = previousCols
  }

  if (activeEngineInteraction) cancelActiveForConfig('config-changed')
  supersedeNonInteractionPending()

  try {
    const evaluation = engine.evaluate({ type: 'set', layout: observed, config: nextConfig })
    if (evaluation.result.status === 'rejected') {
      emitOperationRejected(evaluation.result, evaluation.result.reason, { operation: 'config' })
      deferResponsiveModeRetry()
      return
    }
    confirmEngineEvaluation(evaluation)
    responsiveMode.value = false
    committedDormantResponsive = dormant
    dormantResponsiveErrorEpisode = null
    currentColNum.value = engineConfig.cols
    committedResponsiveConfig = null
    committedCompleteLayouts = null
    committedAuthorLayouts = Object.freeze(
      Object.create(null),
    ) as ResponsiveLayoutsInput<Breakpoint>
    committedResponsivePropIdentity = null
    state.lastBreakpoint = null
    spacingBreakpoint.value = null
    state.layouts = {} as Record<Breakpoint, Layout>
    commitPositionStyleMap(styles.styles, styles.ready, true)
    syncItemEngineConfig()
    updateHeight()
    if (previousBreakpoint !== null) {
      const revision = nextRevision()
      emit('breakpoint-changed', null, cloneLayout(committedLayout), {
        revision,
        source: 'config',
      })
      if (!layoutsSemanticallyEqual(previousLayout, committedLayout)) {
        emitLayoutUpdated(committedLayout, revision, 'config')
      }
    }
  } catch (error) {
    emitRuntimeError(error, null)
    deferResponsiveModeRetry()
  }
}

function findDifference(layout: Layout, originalLayout: Layout) {
  const originalIds = new Set(originalLayout.map(item => item.i))
  const ids = new Set(layout.map(item => item.i))

  const uniqueResultOne = layout.filter(item => !originalIds.has(item.i))
  const uniqueResultTwo = originalLayout.filter(item => !ids.has(item.i))

  return uniqueResultOne.concat(uniqueResultTwo)
}

// ---------------------------------------------------------------------------
// 外部拖入 proposal
// ---------------------------------------------------------------------------

function cloneDropCandidate(candidate: DropCandidate): DropCandidate {
  return { ...candidate }
}

function setDropEffect(event: DragEvent, effect: 'none' | 'copy'): void {
  try {
    if (event.dataTransfer) event.dataTransfer.dropEffect = effect
  } catch {
    // 某些浏览器将 dropEffect 暴露为只读；这不影响布局判定。
  }
}

function dropCapabilityReady(): boolean {
  return (
    effectiveIsDroppable.value &&
    state.width !== null &&
    state.width > 0 &&
    (!responsiveMode.value || state.lastBreakpoint !== null) &&
    activeEngineInteraction === null
  )
}

function restoreDropPreview(): void {
  if (activeEngineInteraction) return
  syncEngineLayout(committedLayout)
  restoreCommittedPositionStyleMap()
  updateHeight()
}

function invalidateDropProposal(restore = true): void {
  const hadProposal = currentDropProposal !== null || state.dropPlaceholder !== null
  currentDropProposal = null
  state.dropPlaceholder = null
  if (restore && hadProposal) restoreDropPreview()
}

function invalidatePendingDropCommit(): void {
  pendingDropCommit = null
  deferredDropLayoutObservation = false
  deferredDropResponsiveLayoutsObservation = false
  dropCommitEpoch += 1
}

function detachDropSessionListeners(): void {
  if (!dropSessionListenersAttached) return
  dropSessionListenersAttached = false
  document.removeEventListener('dragend', handleDropSessionCancel, true)
  document.removeEventListener('keydown', handleDropSessionKeydown, true)
  document.removeEventListener('visibilitychange', handleDropVisibilityChange)
  window.removeEventListener('blur', handleDropSessionCancel)
}

function finishDropSession(restore = true): void {
  dropSessionId = null
  dropEnterDepth = 0
  if (dropLeaveFrame && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(dropLeaveFrame)
  }
  dropLeaveFrame = 0
  detachDropSessionListeners()
  invalidateDropProposal(restore)
}

function handleDropSessionCancel(): void {
  if (dropSessionId !== null) finishDropSession()
}

function handleDropSessionKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') handleDropSessionCancel()
}

function handleDropVisibilityChange(): void {
  if (document.visibilityState === 'hidden') handleDropSessionCancel()
}

function attachDropSessionListeners(): void {
  if (dropSessionListenersAttached) return
  dropSessionListenersAttached = true
  document.addEventListener('dragend', handleDropSessionCancel, true)
  document.addEventListener('keydown', handleDropSessionKeydown, true)
  document.addEventListener('visibilitychange', handleDropVisibilityChange)
  window.addEventListener('blur', handleDropSessionCancel)
}

function ensureDropSession(): number {
  if (dropSessionId !== null) return dropSessionId
  dropSessionSequence += 1
  if (!Number.isSafeInteger(dropSessionSequence)) {
    throw new GridLayoutValidationError('Drop session counter is exhausted', {
      code: 'invalid-config',
      path: 'config.counter["dropSession"]',
      cause: dropSessionSequence,
    })
  }
  dropSessionId = dropSessionSequence
  attachDropSessionListeners()
  return dropSessionId
}

function nextDropProposalId(): number {
  dropProposalSequence += 1
  if (!Number.isSafeInteger(dropProposalSequence)) {
    throw new GridLayoutValidationError('Drop proposal counter is exhausted', {
      code: 'invalid-config',
      path: 'config.counter["dropProposal"]',
      cause: dropProposalSequence,
    })
  }
  return dropProposalSequence
}

function findSyntheticId(layout: ReadonlyLayout): number {
  const occupied = new Set(
    layout
      .map(item => item.i)
      .filter((id): id is number => typeof id === 'number' && Number.isSafeInteger(id)),
  )
  for (let id = 0; Number.isSafeInteger(id); id += 1) {
    if (!occupied.has(id)) return id
  }
  throw new GridLayoutValidationError('No synthetic Drop id is available', {
    code: 'invalid-config',
    path: 'drop.syntheticId',
    cause: layout.length,
  })
}

function dropGeometry() {
  const width = state.width
  if (width === null || width <= 0) {
    throw new GridLayoutValidationError('Drop geometry is unresolved', {
      code: 'invalid-config',
      path: 'geometry.width',
      cause: width,
    })
  }
  const config = appliedEngineConfig.value
  return {
    width,
    cols: config.cols,
    rowHeight: config.rowHeight,
    margin: config.margin,
    containerPadding: config.containerPadding,
    rtl: layoutUsesRtl(),
    effectiveScale: appliedPositionStrategy.value.transformScale ?? 1,
  }
}

function candidateAtPointer(event: DragEvent, rect: DOMRect, w: number, h: number): DropCandidate {
  const geometry = dropGeometry()
  const pixel = gridToPixelRect({ i: '__drop_geometry__', x: 0, y: 0, w, h }, geometry)
  const grid = pointerToGridPosition({
    clientX: event.clientX,
    clientY: event.clientY,
    containerRect: {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    },
    anchor: { inline: pixel.width / 2, block: pixel.height / 2 },
    geometry,
  })
  return cloneDropCandidate({ x: grid.x, y: grid.y, w, h })
}

function emitDropRejected(
  reason: Exclude<OperationRejectedReason, 'callback-rejected'>,
  event: DragEvent,
  candidate: DropCandidate | null,
  error?: unknown,
): void {
  invalidateDropProposal()
  setDropEffect(event, 'none')
  const evaluationId = nextEvaluationId()
  if (error instanceof GridLayoutExtensionError) {
    emitRuntimeError(error, null, {
      evaluationId,
      code: error.code,
      source: error.source,
      path: error.path,
      cause: error.cause,
    })
  } else if (error instanceof GridLayoutValidationError) {
    const geometryFailure =
      isDerivedGeometryError(error) ||
      /^(?:geometry|layoutItem|pointer|containerRect|anchor|size)\./.test(error.path)
    if (geometryFailure) {
      emitRuntimeError(error, null, {
        evaluationId,
        code: isDerivedGeometryError(error) ? 'derived-geometry-overflow' : error.code,
        source: 'geometry',
        path: error.path,
        cause: error,
      })
    }
  }
  emit('operation-rejected', {
    revision: null,
    evaluationId,
    operation: 'drop',
    reason,
    id: null,
    previousLayout: cloneLayout(committedLayout),
    layout: cloneLayout(committedLayout),
    candidate: candidate ? cloneDropCandidate(candidate) : null,
    nativeEvent: event,
  })
}

function validateDropSize(value: Readonly<{ w: unknown; h: unknown }>): {
  w: number
  h: number
} {
  if (typeof value.w !== 'number' || !Number.isSafeInteger(value.w) || value.w <= 0) {
    throw new GridLayoutValidationError('Invalid default Drop width', {
      code: 'invalid-config',
      path: 'dropItem.w',
      cause: value.w,
    })
  }
  if (typeof value.h !== 'number' || !Number.isSafeInteger(value.h) || value.h <= 0) {
    throw new GridLayoutValidationError('Invalid default Drop height', {
      code: 'invalid-config',
      path: 'dropItem.h',
      cause: value.h,
    })
  }
  return { w: value.w, h: value.h }
}

function evaluateDrop(event: DragEvent, sessionId: number): DropProposalRecord | null {
  invalidateDropProposal()
  setDropEffect(event, 'copy')

  const root = wrapper.value
  if (!root) {
    setDropEffect(event, 'none')
    return null
  }
  const rect = root.getBoundingClientRect()
  let provisional: DropCandidate
  let size: { w: number; h: number }
  try {
    size = validateDropSize(effectiveDropItem.value)
    provisional = candidateAtPointer(event, rect, size.w, size.h)
  } catch (error) {
    emitDropRejected('invalid-input', event, null, error)
    return null
  }

  const breakpoint = responsiveMode.value ? state.lastBreakpoint : null
  const input: DropDragOverInput<Breakpoint> = {
    nativeEvent: event,
    pointer: { clientX: event.clientX, clientY: event.clientY },
    grid: { x: provisional.x, y: provisional.y },
    candidate: cloneDropCandidate(provisional),
    layout: cloneLayout(committedLayout),
    breakpoint,
    cols: appliedEngineConfig.value.cols,
  }

  const callback = appliedDropConfig.value.onDragOver
  if (callback) {
    let callbackResult: unknown
    try {
      callbackResult = callback(input)
    } catch (cause) {
      emitDropRejected(
        'extension-error',
        event,
        provisional,
        new GridLayoutExtensionError('Drop callback failed', {
          code: 'extension-error',
          source: 'drop-config',
          cause,
        }),
      )
      return null
    }
    if (callbackResult === false) {
      invalidateDropProposal()
      setDropEffect(event, 'none')
      return null
    }
    try {
      const override = snapshotDropResult(toRaw(callbackResult), toRaw)
      if (override.w !== undefined || override.h !== undefined) {
        size = { w: override.w ?? size.w, h: override.h ?? size.h }
        provisional = candidateAtPointer(event, rect, size.w, size.h)
      }
    } catch (error) {
      emitDropRejected('extension-invalid-result', event, null, error)
      return null
    }
  }

  const config = appliedEngineConfig.value
  if (size.w > config.cols) {
    emitDropRejected('out-of-bounds', event, provisional)
    return null
  }
  if (config.maxRows !== Infinity && size.h > config.maxRows) {
    emitDropRejected('max-rows', event, provisional)
    return null
  }
  const candidate = cloneDropCandidate({
    ...provisional,
    x: Math.max(0, Math.min(provisional.x, config.cols - size.w)),
    y:
      config.maxRows === Infinity
        ? Math.max(0, provisional.y)
        : Math.max(0, Math.min(provisional.y, config.maxRows - size.h)),
  })
  const syntheticId = findSyntheticId(committedLayout)
  const evaluation = engine.evaluate({
    type: 'add',
    item: { ...candidate, i: syntheticId },
  })
  const result = evaluation.result
  if (result.status === 'rejected') {
    engine.rollback(evaluation)
    const propagatedNoPosition = result.reason === 'out-of-bounds' || result.reason === 'max-rows'
    const reason = propagatedNoPosition ? 'no-position' : result.reason
    emitDropRejected(reason, event, candidate, evaluation.failure?.error)
    return null
  }

  const evaluatedCandidate = result.layout.find(item => Object.is(item.i, syntheticId))
  if (!evaluatedCandidate) {
    engine.rollback(evaluation)
    emitDropRejected(
      'extension-invalid-result',
      event,
      candidate,
      new GridLayoutExtensionError('Compactor removed the synthetic Drop item', {
        code: 'extension-invalid-result',
        source: 'compactor',
        path: 'layout',
        cause: result.layout,
      }),
    )
    return null
  }
  const finalCandidate = cloneDropCandidate(
    Object.fromEntries(
      Object.entries(evaluatedCandidate).filter(([key]) => key !== 'i' && key !== 'moved'),
    ) as DropCandidate,
  )
  const previewLayout = cloneLayout(result.layout.filter(item => !Object.is(item.i, syntheticId)))
  engine.rollback(evaluation)

  const styleEvaluation = evaluatePositionStyleBatch(
    previewLayout,
    appliedPositionStrategy.value,
    state.width,
    config,
  )
  if (!styleEvaluation.ok) {
    if (styleEvaluation.source === 'geometry') {
      emitDropRejected('invalid-input', event, finalCandidate, styleEvaluation.cause)
    } else {
      const error = new GridLayoutExtensionError('Drop preview style evaluation failed', {
        code: styleEvaluation.reason,
        source: 'position-strategy',
        path: styleEvaluation.path,
        cause: styleEvaluation.cause,
      })
      emitDropRejected(styleEvaluation.reason, event, finalCandidate, error)
    }
    return null
  }

  const proposalId = nextDropProposalId()
  const insertionIndex = committedLayout.length
  const proposal: DropProposalRecord = {
    sessionId,
    proposalId,
    breakpoint,
    candidate: cloneDropCandidate(finalCandidate),
    previewLayout: cloneLayout(previewLayout),
    insertionIndex,
  }
  const context: DropDragOverContext<Breakpoint> = {
    nativeEvent: event,
    pointer: { clientX: event.clientX, clientY: event.clientY },
    grid: { x: finalCandidate.x, y: finalCandidate.y },
    candidate: cloneDropCandidate(finalCandidate),
    layout: cloneLayout(committedLayout),
    breakpoint,
    cols: config.cols,
    proposalId,
    previewLayout: cloneLayout(previewLayout),
    insertionIndex,
  }
  currentDropProposal = proposal
  state.dropPlaceholder = {
    x: finalCandidate.x,
    y: finalCandidate.y,
    w: finalCandidate.w,
    h: finalCandidate.h,
  }
  syncEngineLayout(previewLayout)
  commitPositionStyleMap(styleEvaluation.styles, styleEvaluation.ready, false)
  updateHeight()
  event.preventDefault()
  emit('drop-drag-over', context, event)
  return proposal
}

function handleDragEnter(event: DragEvent): void {
  if (disposing || sealedError) return
  setDropEffect(event, 'none')
  invalidateDropProposal()
  if (!dropCapabilityReady()) return
  const root = wrapper.value
  const related = event.relatedTarget
  if (!root || !(related instanceof Node) || !root.contains(related)) {
    dropEnterDepth += 1
  }
  ensureDropSession()
}

function handleDragOver(event: DragEvent): void {
  if (disposing || sealedError) return
  if (!dropCapabilityReady()) {
    invalidateDropProposal()
    setDropEffect(event, 'none')
    return
  }
  const sessionId = ensureDropSession()
  evaluateDrop(event, sessionId)
}

function handleDrop(event: DragEvent): void {
  if (disposing || sealedError) return
  const proposal = currentDropProposal
  if (
    !dropCapabilityReady() ||
    !proposal ||
    proposal.sessionId !== dropSessionId ||
    proposal.breakpoint !== (responsiveMode.value ? state.lastBreakpoint : null)
  ) {
    finishDropSession()
    setDropEffect(event, 'none')
    return
  }

  event.preventDefault()
  const result: Extract<DropEvaluationResult<Breakpoint>, { status: 'accepted' }> = {
    status: 'accepted',
    proposalId: proposal.proposalId,
    breakpoint: proposal.breakpoint,
    candidate: cloneDropCandidate(proposal.candidate),
    previewLayout: cloneLayout(proposal.previewLayout),
    insertionIndex: proposal.insertionIndex,
    nativeEvent: event,
  }
  invalidateDropProposal()
  const epoch = dropCommitEpoch + 1
  dropCommitEpoch = epoch
  pendingDropCommit = { proposal, epoch }
  deferredDropLayoutObservation = false
  deferredDropResponsiveLayoutsObservation = false
  dropSessionId = null
  dropEnterDepth = 0
  detachDropSessionListeners()
  emit('drop', result, event)
  startDropCommitDeadline(epoch)
}

function leaveDropRoot(event: DragEvent): void {
  if (dropSessionId === null) return
  finishDropSession()
  emit('drop-drag-leave', event)
}

function handleDragLeave(event: DragEvent): void {
  if (disposing || sealedError || dropSessionId === null) return
  const root = wrapper.value
  const related = event.relatedTarget
  if (root && related instanceof Node && root.contains(related)) return

  dropEnterDepth = Math.max(0, dropEnterDepth - 1)
  if (dropEnterDepth > 0) return
  if (related !== null || typeof requestAnimationFrame !== 'function') {
    leaveDropRoot(event)
    return
  }
  if (dropLeaveFrame) cancelAnimationFrame(dropLeaveFrame)
  dropLeaveFrame = requestAnimationFrame(() => {
    dropLeaveFrame = 0
    const element =
      typeof document.elementFromPoint === 'function'
        ? document.elementFromPoint(event.clientX, event.clientY)
        : null
    if (!wrapper.value?.contains(element)) leaveDropRoot(event)
  })
}
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
          :is-dragging="
            activeEngineInteraction?.type === 'drag' && activeEngineInteraction.id === item.i
          "
          :is-resizing="
            activeEngineInteraction?.type === 'resize' && activeEngineInteraction.id === item.i
          "
        ></slot>
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
  </div>
</template>
