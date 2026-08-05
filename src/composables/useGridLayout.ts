import {
  getCurrentScope,
  isRef,
  onScopeDispose,
  readonly,
  shallowRef,
  toRaw,
  toValue,
  watch,
} from 'vue'

import { cloneLayout } from '../helpers/common'
import { verticalCompactor } from '../core/compactors'
import { GridLayoutValidationError } from '../core/errors'
import {
  calculateContainerMetrics,
  createNormalizedLayoutEngine,
  layoutsGeometryEqual,
  layoutsSemanticallyEqual,
  snapshotEffectiveConfig,
  snapshotStrictLayout,
} from '../core/layout-engine'
import { snapshotCompactor } from '../core/validation'

import type { MaybeRefOrGetter, Ref } from 'vue'
import type { GridLayoutExtensionError } from '../core/errors'
import type {
  CollisionMode,
  Compactor,
  Layout,
  LayoutItem,
  LayoutOperationResult,
  LayoutOperationResultBase,
  ReadonlyLayout,
  ReadonlyLayoutItem,
  RejectedLayoutOperationResult,
} from '../helpers/types'
import type {
  InternalEffectiveConfig,
  InternalEngineFailure,
  InternalInteractionSession,
  LayoutEngineEvaluation,
} from '../core/layout-engine'

/** An opaque token that identifies one active drag or resize interaction. */
export type GridInteractionToken = string & {
  /** Prevents callers from substituting an arbitrary string for an interaction token. */
  readonly __brand: 'GridInteractionToken'
}

/** Input used to start a continuous grid interaction. */
export interface GridInteractionStart {
  /** Whether the interaction moves or resizes an item. */
  type: 'drag' | 'resize'
  /** The id of the item to interact with. */
  id: LayoutItem['i']
  /** The native event that started the interaction, when available. */
  nativeEvent: Event | null
}

/** A proposed position or size for an active grid interaction. */
export type GridInteractionCandidate =
  | {
      /** Identifies a move candidate. */
      type: 'drag'
      /** The proposed column coordinate. */
      x: number
      /** The proposed row coordinate. */
      y: number
      /** The latest native event, when available. */
      nativeEvent: Event | null
    }
  | {
      /** Identifies a resize candidate. */
      type: 'resize'
      /** The proposed width in grid columns. */
      w: number
      /** The proposed height in grid rows. */
      h: number
      /** The latest native event, when available. */
      nativeEvent: Event | null
    }

/** The action that committed a headless layout change. */
export type LayoutChangeReason = 'set' | 'move' | 'resize' | 'add' | 'remove' | 'layer' | 'config'

/** Readonly state for the current drag interaction. */
export interface GridDragState {
  /** Whether a drag interaction is active. */
  readonly status: 'idle' | 'active'
  /** The active interaction token, or `null` while idle. */
  readonly token: GridInteractionToken | null
  /** The active item id, or `null` while idle. */
  readonly id: LayoutItem['i'] | null
  /** The item's coordinates when dragging began, or `null` while idle. */
  readonly origin: Readonly<{ x: number; y: number }> | null
  /** The latest accepted coordinates, or `null` while idle. */
  readonly current: Readonly<{ x: number; y: number }> | null
}

/** Readonly state for the current resize interaction. */
export interface GridResizeState {
  /** Whether a resize interaction is active. */
  readonly status: 'idle' | 'active'
  /** The active interaction token, or `null` while idle. */
  readonly token: GridInteractionToken | null
  /** The active item id, or `null` while idle. */
  readonly id: LayoutItem['i'] | null
  /** The item's size when resizing began, or `null` while idle. */
  readonly origin: Readonly<{ w: number; h: number }> | null
  /** The latest accepted size, or `null` while idle. */
  readonly current: Readonly<{ w: number; h: number }> | null
}

/** A recoverable runtime failure reported by components and composables. */
export interface GridLayoutRuntimeError {
  /** A stable machine-readable error code. */
  code:
    | 'invalid-layout'
    | 'invalid-config'
    | 'partial-responsive-update'
    | 'invalid-registration'
    | 'extension-error'
    | 'extension-invalid-result'
    | 'derived-geometry-overflow'
  /** The subsystem that reported the error. */
  source:
    | 'layout'
    | 'config'
    | 'container-width'
    | 'geometry'
    | 'compactor'
    | 'position-strategy'
    | 'drop-config'
    | 'grid-item'
    | 'auto-height'
  /** The invalid field path, or `null` when no field applies. */
  path: string | null
  /** The related layout revision, or `null` before a revision was allocated. */
  revision: number | null
  /** The id of the evaluation that reported the error. */
  evaluationId: number
  /** The original invalid value or thrown error. */
  cause: unknown
}

/** The reason an active interaction ended with a cancelled terminal state. */
export type InteractionCancelReason =
  | 'cancelled'
  | 'config-changed'
  | 'external-update'
  | 'external-not-committed'
  | 'disabled'
  | 'unmount'
  | 'geometry-error'
  | 'extension-error'
  | 'extension-invalid-result'
  | 'transferred'

/** Fields shared by every terminal drag or resize payload. */
export interface InteractionTerminalBase {
  /** The interaction kind. */
  type: 'drag' | 'resize'
  /** The id of the item involved in the interaction. */
  id: LayoutItem['i']
  /** The final revision, or `null` if no accepted candidate received one. */
  revision: number | null
  /** The committed layout from before the interaction. */
  previousLayout: ReadonlyLayout
  /** The committed layout after the interaction ended. */
  layout: ReadonlyLayout
  /** The item snapshot from before the interaction. */
  oldItem: ReadonlyLayoutItem
  /** The final item snapshot, or `null` if the item no longer exists. */
  item: ReadonlyLayoutItem | null
  /** The last native event associated with the interaction, when available. */
  nativeEvent: Event | null
}

/** The committed, unchanged, or cancelled result of a continuous interaction. */
export type InteractionTerminalPayload =
  | (InteractionTerminalBase & {
      /** Indicates that the final candidate changed the committed layout. */
      status: 'committed'
      /** The final candidate was applied. */
      reason: 'applied'
    })
  | (InteractionTerminalBase & {
      /** Indicates that the interaction ended without a semantic layout change. */
      status: 'unchanged'
      /** The final layout matched the previous layout. */
      reason: 'same-value'
    })
  | (InteractionTerminalBase & {
      /** Indicates that the interaction ended with a cancelled terminal state. */
      status: 'cancelled'
      /** The condition that cancelled the interaction. */
      reason: InteractionCancelReason
    })

/** The result of starting a continuous grid interaction. */
export type GridInteractionStartResult =
  | {
      /** Indicates that the interaction started. */
      status: 'accepted'
      /** The opaque token required by subsequent interaction commands. */
      token: GridInteractionToken
      /** The active item at interaction start. */
      item: ReadonlyLayoutItem
      /** The committed layout at interaction start. */
      layout: ReadonlyLayout
    }
  | {
      /** Indicates that layout rules rejected the interaction start. */
      status: 'rejected'
      /** The rejected layout operation. */
      result: RejectedLayoutOperationResult
    }

/** The result of ending or cancelling a continuous interaction. */
export type InteractionCommandResult =
  | {
      /** Indicates that the interaction reached a terminal state. */
      status: 'terminal'
      /** The committed, unchanged, or cancelled interaction payload. */
      terminal: InteractionTerminalPayload
    }
  | {
      /** Indicates that the supplied token does not identify the expected active interaction. */
      status: 'rejected'
      /** Why the token could not be used. */
      reason: 'invalid-token' | 'no-active-interaction' | 'token-type-mismatch'
      /** The token supplied by the caller. */
      token: GridInteractionToken
    }

/** A layout rejection reason, including reasons specific to external drops. */
export type OperationRejectedReason =
  RejectedLayoutOperationResult['reason'] | 'callback-rejected' | 'no-position'

/** Details passed to an operation-rejection callback or event. */
export interface OperationRejectedPayload {
  /** The related revision, or `null` if no revision was allocated. */
  revision: number | null
  /** The id of the evaluation that rejected the operation. */
  evaluationId: number
  /** The kind of operation that was rejected. */
  operation: LayoutOperationResultBase['operation'] | 'config' | 'drop' | 'transfer'
  /** The rule or condition that rejected the operation. */
  reason: OperationRejectedReason
  /** The target item id, or `null` for layout-wide operations. */
  id: LayoutItem['i'] | null
  /** The layout committed before the rejected operation. */
  previousLayout: ReadonlyLayout
  /** The layout retained after the rejection. */
  layout: ReadonlyLayout
  /** The rejected item or drop candidate, when available. */
  candidate: ReadonlyLayoutItem | Readonly<Omit<LayoutItem, 'i' | 'moved'>> | null
  /** The native event associated with the operation, when available. */
  nativeEvent: Event | null
}

/** Options accepted by {@link useGridLayout}. */
export interface UseGridLayoutOptions {
  /** A writable controlled layout ref, or an initial layout for internally managed state. */
  layout: Ref<Layout> | ReadonlyLayout
  /** The number of grid columns. */
  cols: MaybeRefOrGetter<number>
  /**
   * The height of one grid row in pixels.
   *
   * @defaultValue `150`
   */
  rowHeight?: MaybeRefOrGetter<number>
  /**
   * The horizontal and vertical gaps in pixels.
   *
   * @defaultValue `[10, 10]`
   */
  gap?: MaybeRefOrGetter<readonly [number, number]>
  /**
   * The horizontal and vertical container padding in pixels.
   *
   * @defaultValue `[0, 0]`
   */
  containerPadding?: MaybeRefOrGetter<readonly [number, number]>
  /**
   * The maximum number of rows the layout may occupy.
   *
   * @defaultValue `Infinity`
   */
  maxRows?: MaybeRefOrGetter<number>
  /**
   * The algorithm used to remove layout gaps.
   *
   * @defaultValue `verticalCompactor`
   */
  compactor?: MaybeRefOrGetter<Compactor>
  /**
   * How layout operations handle item collisions.
   *
   * @defaultValue `'push'`
   */
  collisionMode?: MaybeRefOrGetter<CollisionMode>
  /**
   * Whether drag interactions are accepted.
   *
   * @defaultValue `true`
   */
  isDraggable?: MaybeRefOrGetter<boolean>
  /**
   * Whether resize interactions are accepted.
   *
   * @defaultValue `true`
   */
  isResizable?: MaybeRefOrGetter<boolean>
  /**
   * Whether an active item stays at its pointer candidate until release.
   *
   * @defaultValue `false`
   */
  restoreOnDrag?: MaybeRefOrGetter<boolean>
  /**
   * Whether an interaction raises its item in overlap mode.
   *
   * @defaultValue `true`
   */
  bringToFrontOnInteract?: MaybeRefOrGetter<boolean>
  /**
   * Receives each layout committed by an operation or configuration change.
   *
   * @param layout - A readonly snapshot of the committed layout.
   * @param reason - The action that produced the change.
   */
  onLayoutChange?: (layout: ReadonlyLayout, reason: LayoutChangeReason) => void
  /**
   * Receives operations rejected by validation, configuration, or layout rules.
   *
   * @param payload - The rejected operation and retained layout state.
   */
  onOperationRejected?: (payload: OperationRejectedPayload) => void
  /**
   * Receives the terminal state of each continuous interaction.
   *
   * @param payload - The committed, unchanged, or cancelled terminal state.
   */
  onInteractionEnd?: (payload: InteractionTerminalPayload) => void
  /**
   * Receives recoverable runtime errors while the composable retains its last valid state.
   *
   * @param error - The structured runtime error.
   */
  onError?: (error: GridLayoutRuntimeError) => void
}

/** Reactive state and commands returned by {@link useGridLayout}. */
export interface UseGridLayoutReturn {
  /** A readonly snapshot of the committed layout. */
  layout: Readonly<Ref<ReadonlyLayout>>
  /** The latest accepted interaction candidate, or `null` outside an interaction. */
  placeholder: Readonly<Ref<ReadonlyLayoutItem | null>>
  /** Readonly state for the current drag interaction. */
  dragState: Readonly<Ref<GridDragState>>
  /** Readonly state for the current resize interaction. */
  resizeState: Readonly<Ref<GridResizeState>>
  /** Whether a drag or resize interaction is active. */
  isInteracting: Readonly<Ref<boolean>>
  /** The number of rows occupied by the committed layout. */
  containerRows: Readonly<Ref<number>>
  /** The calculated content height in pixels. */
  containerHeight: Readonly<Ref<number>>
  /**
   * Validates and commits a replacement layout.
   *
   * @param layout - The complete layout to commit.
   * @returns The accepted, unchanged, or rejected operation result.
   */
  setLayout(layout: ReadonlyLayout): LayoutOperationResult
  /**
   * Commits new grid coordinates for one item.
   *
   * @param id - The id of the item to move.
   * @param x - The proposed column coordinate.
   * @param y - The proposed row coordinate.
   * @returns The accepted, unchanged, or rejected operation result.
   */
  moveItem(id: LayoutItem['i'], x: number, y: number): LayoutOperationResult
  /**
   * Commits a new grid size for one item.
   *
   * @param id - The id of the item to resize.
   * @param w - The proposed width in grid columns.
   * @param h - The proposed height in grid rows.
   * @returns The accepted, unchanged, or rejected operation result.
   */
  resizeItem(id: LayoutItem['i'], w: number, h: number): LayoutOperationResult
  /**
   * Validates and inserts an item.
   *
   * @param item - The complete item to insert, including a unique id.
   * @returns The accepted, unchanged, or rejected operation result.
   */
  addItem(item: ReadonlyLayoutItem): LayoutOperationResult
  /**
   * Removes an item.
   *
   * @param id - The id of the item to remove.
   * @returns The accepted, unchanged, or rejected operation result.
   */
  removeItem(id: LayoutItem['i']): LayoutOperationResult
  /**
   * Moves an item to the highest layer in overlap mode.
   *
   * @param id - The id of the item to raise.
   * @returns The accepted, unchanged, or rejected operation result.
   */
  bringToFront(id: LayoutItem['i']): LayoutOperationResult
  /**
   * Moves an item to the lowest layer in overlap mode.
   *
   * @param id - The id of the item to lower.
   * @returns The accepted, unchanged, or rejected operation result.
   */
  sendToBack(id: LayoutItem['i']): LayoutOperationResult
  /**
   * Starts a continuous drag or resize interaction.
   *
   * @param input - The interaction kind, target item, and initial native event.
   * @returns An interaction token and initial snapshots, or a rejected operation.
   */
  beginInteraction(input: GridInteractionStart): GridInteractionStartResult
  /**
   * Evaluates and commits the latest candidate for an active interaction.
   *
   * @param token - The token returned by `beginInteraction`.
   * @param candidate - The proposed item position or size.
   * @returns The accepted, unchanged, or rejected layout operation.
   */
  updateInteraction(
    token: GridInteractionToken,
    candidate: GridInteractionCandidate,
  ): LayoutOperationResult
  /**
   * Ends an active interaction and commits its final state when valid.
   *
   * @param token - The token returned by `beginInteraction`.
   * @returns The terminal interaction payload or a token rejection.
   */
  endInteraction(token: GridInteractionToken): InteractionCommandResult
  /**
   * Ends an active interaction with a cancelled terminal state.
   *
   * Candidates accepted before cancellation remain committed.
   *
   * @param token - The token returned by `beginInteraction`.
   * @returns The terminal interaction payload or a token rejection.
   */
  cancelInteraction(token: GridInteractionToken): InteractionCommandResult
}

interface ActiveInteraction {
  readonly token: GridInteractionToken
  readonly session: InternalInteractionSession
  readonly type: 'drag' | 'resize'
  readonly id: LayoutItem['i']
  readonly previousLayout: Layout
  readonly oldItem: LayoutItem
  latestCandidate:
    | Readonly<{ type: 'drag'; x: number; y: number }>
    | Readonly<{ type: 'resize'; w: number; h: number }>
  latestRevision: number | null
  latestNativeEvent: Event | null
}

let instanceSequence = 0

function nextInstanceId(): number {
  instanceSequence++
  if (!Number.isSafeInteger(instanceSequence)) instanceSequence = 1
  return instanceSequence
}

function counterError(
  counter: 'revision' | 'evaluationId' | 'tokenSequence',
): GridLayoutValidationError {
  return new GridLayoutValidationError(`Counter ${counter} is exhausted`, {
    code: 'invalid-config',
    path: `config.counter["${counter}"]`,
    cause: {
      reason: 'counter-exhausted',
      counter,
      limit: Number.MAX_SAFE_INTEGER - 1,
    },
  })
}

function createCounter(counter: 'revision' | 'evaluationId' | 'tokenSequence') {
  let value = 0
  return () => {
    const next = value + 1
    if (!Number.isSafeInteger(next) || next >= Number.MAX_SAFE_INTEGER) {
      throw counterError(counter)
    }
    value = next
    return value
  }
}

function cloneResult(result: LayoutOperationResult): LayoutOperationResult {
  const previousLayout = cloneLayout(result.previousLayout)
  const layout = cloneLayout(result.layout)
  let candidate: ReadonlyLayoutItem | null = null
  if (result.candidate && result.id !== null) {
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

function cloneTerminal(payload: InteractionTerminalPayload): InteractionTerminalPayload {
  const previousLayout = cloneLayout(payload.previousLayout)
  const layout = cloneLayout(payload.layout)
  return {
    ...payload,
    previousLayout,
    layout,
    oldItem: previousLayout.find(item => Object.is(item.i, payload.id))!,
    item: layout.find(item => Object.is(item.i, payload.id)) ?? null,
  }
}

function callAll(callbacks: ReadonlyArray<() => void>): void {
  // 一个监听器失败不能阻止其余终态通知；全部尝试后再抛出最先发生的异常。
  let firstError: unknown
  let hasError = false
  for (const callback of callbacks) {
    try {
      callback()
    } catch (error) {
      if (!hasError) {
        firstError = error
        hasError = true
      }
    }
  }
  if (hasError) throw firstError
}

function hasMovedInput(layout: ReadonlyLayout): boolean {
  return layout.some(item => Object.hasOwn(toRaw(item), 'moved'))
}

function spacingDependency(value: unknown, index: 0 | 1): unknown {
  if (!Array.isArray(value)) return undefined
  const raw = toRaw(value)
  let descriptor: PropertyDescriptor | undefined
  try {
    descriptor = Reflect.getOwnPropertyDescriptor(raw, String(index))
  } catch {
    return raw
  }
  return descriptor && 'value' in descriptor ? value[index] : descriptor
}

/**
 * Creates validated, headless grid-layout state with synchronous commands and interactions.
 *
 * A writable layout ref receives accepted changes. A plain readonly layout initializes state that
 * remains owned by the composable. This ownership mode is fixed when the composable is created.
 *
 * @param options - The initial layout, reactive configuration, and lifecycle callbacks.
 * @returns Readonly layout state and commands for one-off or continuous operations.
 */
export function useGridLayout(options: UseGridLayoutOptions): UseGridLayoutReturn {
  // 是否受控只在创建时判定，避免运行期间因输入形态变化而切换状态所有权。
  const externalLayout = isRef(options.layout) ? options.layout : null
  const instanceId = nextInstanceId()
  const allocateRevision = createCounter('revision')
  const allocateEvaluationId = createCounter('evaluationId')
  const allocateTokenSequence = createCounter('tokenSequence')

  function resolveCompactorInput(): Compactor {
    return options.compactor === undefined ? verticalCompactor : toValue(options.compactor)
  }

  function resolveConfig(compactor: Compactor): InternalEffectiveConfig {
    const gap = options.gap === undefined ? ([10, 10] as const) : toValue(options.gap)
    const explicitMode =
      options.collisionMode === undefined ? undefined : toValue(options.collisionMode)
    return snapshotEffectiveConfig({
      cols: toValue(options.cols),
      rowHeight: options.rowHeight === undefined ? 150 : toValue(options.rowHeight),
      gap,
      containerPadding:
        options.containerPadding === undefined
          ? ([0, 0] as const)
          : toValue(options.containerPadding),
      maxRows: options.maxRows === undefined ? Infinity : toValue(options.maxRows),
      compactor,
      collisionMode: explicitMode ?? (compactor.allowOverlap ? 'overlap' : 'push'),
      isDraggable: options.isDraggable === undefined ? true : toValue(options.isDraggable),
      isResizable: options.isResizable === undefined ? true : toValue(options.isResizable),
      restoreOnDrag: options.restoreOnDrag === undefined ? false : toValue(options.restoreOnDrag),
      bringToFrontOnInteract:
        options.bringToFrontOnInteract === undefined
          ? true
          : toValue(options.bringToFrontOnInteract),
    })
  }

  let effectiveCompactorInput = resolveCompactorInput()
  let effectiveConfig = resolveConfig(snapshotCompactor(effectiveCompactorInput))
  const initialInput: ReadonlyLayout = externalLayout
    ? externalLayout.value
    : (options.layout as ReadonlyLayout)
  const initialized = createNormalizedLayoutEngine(initialInput, effectiveConfig)
  const initialLayout = initialized.layout
  const engine = initialized.engine
  const initialMetrics = initialized.metrics

  const layoutState = shallowRef<ReadonlyLayout>(cloneLayout(initialLayout))
  const placeholderState = shallowRef<ReadonlyLayoutItem | null>(null)
  const dragStateValue = shallowRef<GridDragState>({
    status: 'idle',
    token: null,
    id: null,
    origin: null,
    current: null,
  })
  const resizeStateValue = shallowRef<GridResizeState>({
    status: 'idle',
    token: null,
    id: null,
    origin: null,
    current: null,
  })
  const containerRowsValue = shallowRef(initialMetrics.rows)
  const containerHeightValue = shallowRef(initialMetrics.height)
  let activeInteraction: ActiveInteraction | null = null
  const isInteractingValue = shallowRef(false)

  let guardedRefValue: Layout | null = null
  if (externalLayout && initialized.changed) {
    externalLayout.value = cloneLayout(initialLayout)
  }

  function syncLayout(layout: ReadonlyLayout, config = effectiveConfig): void {
    const snapshot = cloneLayout(layout)
    const metrics = calculateContainerMetrics(snapshot, config)
    layoutState.value = snapshot
    containerRowsValue.value = metrics.rows
    containerHeightValue.value = metrics.height
  }

  function writeExternalRef(layout: ReadonlyLayout): void {
    if (!externalLayout) return
    const snapshot = cloneLayout(layout)
    // 记录写入对象身份，让同步 watcher 忽略 composable 自己产生的回写。
    guardedRefValue = snapshot
    externalLayout.value = snapshot
  }

  function runtimeError(
    error: GridLayoutValidationError | GridLayoutExtensionError,
    evaluationId: number,
    revision: number | null,
    source: GridLayoutRuntimeError['source'],
    derivedGeometry = false,
  ): GridLayoutRuntimeError {
    return {
      code: derivedGeometry ? 'derived-geometry-overflow' : error.code,
      source,
      path: error.path,
      revision,
      evaluationId,
      cause: error.cause,
    }
  }

  function rejectedPayload(
    result: RejectedLayoutOperationResult,
    evaluationId: number,
    revision: number | null,
    operation: OperationRejectedPayload['operation'] = result.operation,
    nativeEvent: Event | null = null,
  ): OperationRejectedPayload {
    const detached = cloneResult(result) as RejectedLayoutOperationResult
    return {
      revision,
      evaluationId,
      operation,
      reason: detached.reason,
      id: detached.id,
      previousLayout: detached.previousLayout,
      layout: detached.layout,
      candidate: detached.candidate,
      nativeEvent,
    }
  }

  function failureCallback(
    failure: InternalEngineFailure,
    evaluationId: number,
    revision: number | null,
  ): (() => void) | null {
    if (!options.onError) return null
    const source = failure.kind === 'geometry' ? 'geometry' : 'compactor'
    const error = runtimeError(
      failure.error,
      evaluationId,
      revision,
      source,
      failure.kind === 'geometry',
    )
    return () => options.onError!(error)
  }

  function notifyRejected(
    evaluation: LayoutEngineEvaluation,
    evaluationId: number,
    revision: number | null,
    operation?: OperationRejectedPayload['operation'],
    nativeEvent: Event | null = null,
    terminal?: InteractionTerminalPayload,
    includeOperationRejected = true,
  ): void {
    const callbacks: Array<() => void> = []
    if (evaluation.failure) {
      const callback = failureCallback(evaluation.failure, evaluationId, revision)
      if (callback) callbacks.push(callback)
    }
    if (includeOperationRejected && options.onOperationRejected) {
      const payload = rejectedPayload(
        evaluation.result as RejectedLayoutOperationResult,
        evaluationId,
        revision,
        operation,
        nativeEvent,
      )
      callbacks.push(() => options.onOperationRejected!(payload))
    }
    if (terminal && options.onInteractionEnd) {
      const payload = cloneTerminal(terminal)
      callbacks.push(() => options.onInteractionEnd!(payload))
    }
    callAll(callbacks)
  }

  function createTerminal(
    interaction: ActiveInteraction,
    status: 'committed' | 'unchanged' | 'cancelled',
    reason: 'applied' | 'same-value' | InteractionCancelReason,
    nativeEvent: Event | null,
  ): InteractionTerminalPayload {
    const previousLayout = cloneLayout(interaction.previousLayout)
    const layout = cloneLayout(layoutState.value)
    const base = {
      type: interaction.type,
      id: interaction.id,
      revision: interaction.latestRevision,
      previousLayout,
      layout,
      oldItem: previousLayout.find(item => Object.is(item.i, interaction.id))!,
      item: layout.find(item => Object.is(item.i, interaction.id)) ?? null,
      nativeEvent,
    }
    if (status === 'committed') return { ...base, status, reason: 'applied' }
    if (status === 'unchanged') return { ...base, status, reason: 'same-value' }
    return { ...base, status, reason: reason as InteractionCancelReason }
  }

  function clearInteraction(interaction: ActiveInteraction): void {
    engine.closeInteraction(interaction.session)
    if (activeInteraction === interaction) activeInteraction = null
    isInteractingValue.value = false
    placeholderState.value = null
    dragStateValue.value = {
      status: 'idle',
      token: null,
      id: null,
      origin: null,
      current: null,
    }
    resizeStateValue.value = {
      status: 'idle',
      token: null,
      id: null,
      origin: null,
      current: null,
    }
  }

  function finishInteraction(
    interaction: ActiveInteraction,
    status: 'committed' | 'unchanged' | 'cancelled',
    reason: 'applied' | 'same-value' | InteractionCancelReason,
    nativeEvent: Event | null,
    notify = true,
  ): InteractionTerminalPayload {
    clearInteraction(interaction)
    const terminal = createTerminal(interaction, status, reason, nativeEvent)
    if (notify && options.onInteractionEnd) {
      options.onInteractionEnd(cloneTerminal(terminal))
    }
    return terminal
  }

  function runOperation(
    command: Parameters<typeof engine.evaluate>[0],
    reason: Exclude<LayoutChangeReason, 'config'>,
  ): LayoutOperationResult {
    const evaluationId = allocateEvaluationId()
    const evaluation = engine.evaluate(command)
    if (evaluation.result.status === 'rejected') {
      const confirmed = engine.confirm(evaluation) as RejectedLayoutOperationResult
      notifyRejected({ ...evaluation, result: confirmed }, evaluationId, null)
      return cloneResult(confirmed)
    }

    const confirmed = engine.confirm(evaluation)
    if (confirmed.status === 'rejected') {
      const rejectedEvaluation = { ...evaluation, result: confirmed }
      notifyRejected(rejectedEvaluation, evaluationId, null)
      return cloneResult(confirmed)
    }
    if (confirmed.status === 'accepted') {
      allocateRevision()
      effectiveConfig = evaluation.nextConfig
      syncLayout(confirmed.layout, effectiveConfig)
      writeExternalRef(confirmed.layout)
      if (options.onLayoutChange) {
        options.onLayoutChange(cloneLayout(confirmed.layout), reason)
      }
    }
    return cloneResult(confirmed)
  }

  function invalidTokenResult(
    type: 'drag' | 'resize',
    id: LayoutItem['i'] | null,
  ): RejectedLayoutOperationResult {
    const previousLayout = cloneLayout(layoutState.value)
    return {
      operation: type === 'drag' ? 'move' : 'resize',
      id,
      previousLayout,
      layout: cloneLayout(layoutState.value),
      candidate: null,
      status: 'rejected',
      reason: 'cancelled',
    }
  }

  function beginInteraction(input: GridInteractionStart): GridInteractionStartResult {
    const evaluationId = allocateEvaluationId()
    const started = engine.beginInteraction({ type: input.type, id: input.id })
    if (started.status === 'rejected') {
      if (started.result.reason !== 'interaction-active' && options.onOperationRejected) {
        options.onOperationRejected(rejectedPayload(started.result, evaluationId, null))
      }
      return {
        status: 'rejected',
        result: cloneResult(started.result) as RejectedLayoutOperationResult,
      }
    }

    const sequence = allocateTokenSequence()
    const token = `grid-layout:${instanceId}:${sequence}` as GridInteractionToken
    const item = started.session.baseLayout.find(entry => Object.is(entry.i, input.id))!
    activeInteraction = {
      token,
      session: started.session,
      type: input.type,
      id: input.id,
      previousLayout: cloneLayout(started.session.baseLayout),
      oldItem: cloneLayout([item])[0],
      latestCandidate:
        input.type === 'drag'
          ? { type: 'drag', x: item.x, y: item.y }
          : { type: 'resize', w: item.w, h: item.h },
      latestRevision: null,
      latestNativeEvent: input.nativeEvent,
    }
    isInteractingValue.value = true

    if (input.type === 'drag') {
      dragStateValue.value = {
        status: 'active',
        token,
        id: input.id,
        origin: { x: item.x, y: item.y },
        current: { x: item.x, y: item.y },
      }
    } else {
      resizeStateValue.value = {
        status: 'active',
        token,
        id: input.id,
        origin: { w: item.w, h: item.h },
        current: { w: item.w, h: item.h },
      }
    }
    const layout = cloneLayout(started.session.baseLayout)
    return {
      status: 'accepted',
      token,
      item: layout.find(entry => Object.is(entry.i, input.id))!,
      layout,
    }
  }

  function updateInteraction(
    token: GridInteractionToken,
    candidate: GridInteractionCandidate,
  ): LayoutOperationResult {
    const evaluationId = allocateEvaluationId()
    const interaction = activeInteraction
    if (!interaction || interaction.token !== token) {
      return invalidTokenResult(candidate.type, null)
    }
    if (interaction.type !== candidate.type) {
      return invalidTokenResult(candidate.type, interaction.id)
    }

    const evaluation = engine.evaluateInteraction(
      interaction.session,
      candidate.type === 'drag'
        ? { type: 'drag', x: candidate.x, y: candidate.y }
        : { type: 'resize', w: candidate.w, h: candidate.h },
    )
    if (evaluation.result.status === 'rejected') {
      const confirmed = engine.confirm(evaluation) as RejectedLayoutOperationResult
      const rejectedEvaluation = { ...evaluation, result: confirmed }
      const terminalReason =
        confirmed.reason === 'extension-error' || confirmed.reason === 'extension-invalid-result'
          ? confirmed.reason
          : null
      if (terminalReason) {
        const terminal = finishInteraction(
          interaction,
          'cancelled',
          terminalReason,
          candidate.nativeEvent,
          false,
        )
        notifyRejected(
          rejectedEvaluation,
          evaluationId,
          interaction.latestRevision,
          undefined,
          candidate.nativeEvent,
          terminal,
        )
      } else {
        notifyRejected(
          rejectedEvaluation,
          evaluationId,
          interaction.latestRevision,
          undefined,
          candidate.nativeEvent,
        )
      }
      return cloneResult(confirmed)
    }

    const confirmed = engine.confirm(evaluation)
    if (confirmed.status === 'rejected') {
      notifyRejected(
        { ...evaluation, result: confirmed },
        evaluationId,
        interaction.latestRevision,
        undefined,
        candidate.nativeEvent,
      )
      return cloneResult(confirmed)
    }
    if (confirmed.status === 'accepted') {
      const revision = allocateRevision()
      interaction.latestCandidate =
        candidate.type === 'drag'
          ? { type: 'drag', x: candidate.x, y: candidate.y }
          : { type: 'resize', w: candidate.w, h: candidate.h }
      interaction.latestRevision = revision
      interaction.latestNativeEvent = candidate.nativeEvent
      effectiveConfig = evaluation.nextConfig
      syncLayout(confirmed.layout, effectiveConfig)
      writeExternalRef(confirmed.layout)
      const target = confirmed.layout.find(item => Object.is(item.i, interaction.id))!
      placeholderState.value = cloneLayout([target])[0]
      if (candidate.type === 'drag') {
        dragStateValue.value = {
          ...dragStateValue.value,
          current: { x: target.x, y: target.y },
        }
      } else {
        resizeStateValue.value = {
          ...resizeStateValue.value,
          current: { w: target.w, h: target.h },
        }
      }
      if (options.onLayoutChange) {
        options.onLayoutChange(
          cloneLayout(confirmed.layout),
          candidate.type === 'drag' ? 'move' : 'resize',
        )
      }
      return cloneResult(confirmed)
    }
    return cloneResult(confirmed)
  }

  function endInteraction(token: GridInteractionToken): InteractionCommandResult {
    const evaluationId = allocateEvaluationId()
    const interaction = activeInteraction
    if (!interaction) return { status: 'rejected', reason: 'no-active-interaction', token }
    if (interaction.token !== token) return { status: 'rejected', reason: 'invalid-token', token }

    const latest = interaction.latestCandidate
    const evaluation = engine.evaluateInteraction(
      interaction.session,
      latest.type === 'drag'
        ? { type: 'drag', x: latest.x, y: latest.y, terminal: true }
        : { type: 'resize', w: latest.w, h: latest.h, terminal: true },
    )
    if (evaluation.result.status === 'rejected') {
      const confirmed = engine.confirm(evaluation) as RejectedLayoutOperationResult
      const rejectedEvaluation = { ...evaluation, result: confirmed }
      const reason =
        confirmed.reason === 'extension-error' || confirmed.reason === 'extension-invalid-result'
          ? confirmed.reason
          : 'cancelled'
      const terminal = finishInteraction(interaction, 'cancelled', reason, null, false)
      notifyRejected(
        rejectedEvaluation,
        evaluationId,
        interaction.latestRevision,
        undefined,
        null,
        terminal,
      )
      return { status: 'terminal', terminal }
    }

    const confirmed = engine.confirm(evaluation)
    if (confirmed.status === 'rejected') {
      const terminal = finishInteraction(interaction, 'cancelled', 'external-update', null, false)
      notifyRejected(
        { ...evaluation, result: confirmed },
        evaluationId,
        interaction.latestRevision,
        undefined,
        null,
        terminal,
      )
      return { status: 'terminal', terminal }
    }
    let layoutChangeCallback: (() => void) | null = null
    if (confirmed.status === 'accepted') {
      const revision = allocateRevision()
      interaction.latestRevision = revision
      effectiveConfig = evaluation.nextConfig
      syncLayout(confirmed.layout, effectiveConfig)
      writeExternalRef(confirmed.layout)
      if (options.onLayoutChange) {
        const layout = cloneLayout(confirmed.layout)
        const reason = interaction.type === 'drag' ? 'move' : 'resize'
        layoutChangeCallback = () => options.onLayoutChange!(layout, reason)
      }
    }

    const unchanged = layoutsSemanticallyEqual(interaction.previousLayout, layoutState.value)
    const terminal = finishInteraction(
      interaction,
      unchanged ? 'unchanged' : 'committed',
      unchanged ? 'same-value' : 'applied',
      null,
      false,
    )
    // 先通知最终布局变化，再通知交互终态；callAll 保证任一回调抛错都不吞掉另一条通知。
    const callbacks: Array<() => void> = []
    if (layoutChangeCallback) callbacks.push(layoutChangeCallback)
    if (options.onInteractionEnd) {
      callbacks.push(() => options.onInteractionEnd!(cloneTerminal(terminal)))
    }
    callAll(callbacks)
    return { status: 'terminal', terminal }
  }

  function cancelInteraction(token: GridInteractionToken): InteractionCommandResult {
    allocateEvaluationId()
    const interaction = activeInteraction
    if (!interaction) return { status: 'rejected', reason: 'no-active-interaction', token }
    if (interaction.token !== token) return { status: 'rejected', reason: 'invalid-token', token }
    const terminal = finishInteraction(interaction, 'cancelled', 'cancelled', null)
    return { status: 'terminal', terminal }
  }

  function configCancelReason(
    interaction: ActiveInteraction,
    nextConfig: InternalEffectiveConfig,
    compactorIdentityChanged: boolean,
  ): 'disabled' | 'config-changed' | null {
    const target = layoutState.value.find(item => Object.is(item.i, interaction.id))
    const enabled =
      interaction.type === 'drag'
        ? (target?.isDraggable ?? nextConfig.isDraggable)
        : (target?.isResizable ?? nextConfig.isResizable)
    if (!enabled) return 'disabled'

    const layoutOrGeometryChanged =
      effectiveConfig.cols !== nextConfig.cols ||
      effectiveConfig.rowHeight !== nextConfig.rowHeight ||
      effectiveConfig.gap[0] !== nextConfig.gap[0] ||
      effectiveConfig.gap[1] !== nextConfig.gap[1] ||
      effectiveConfig.containerPadding[0] !== nextConfig.containerPadding[0] ||
      effectiveConfig.containerPadding[1] !== nextConfig.containerPadding[1] ||
      effectiveConfig.maxRows !== nextConfig.maxRows ||
      effectiveConfig.collisionMode !== nextConfig.collisionMode ||
      compactorIdentityChanged
    return layoutOrGeometryChanged ? 'config-changed' : null
  }

  function withActiveConfigCandidate(
    evaluation: LayoutEngineEvaluation,
    interaction: ActiveInteraction | null,
  ): LayoutEngineEvaluation {
    if (!interaction || evaluation.result.status !== 'rejected') return evaluation
    const target = layoutState.value.find(item => Object.is(item.i, interaction.id))
    return {
      ...evaluation,
      result: {
        ...evaluation.result,
        id: interaction.id,
        candidate: target ? cloneLayout([target])[0] : null,
      },
    }
  }

  function handleConfigChange(): void {
    const evaluationId = allocateEvaluationId()
    let nextCompactorInput: Compactor
    let nextConfig: InternalEffectiveConfig
    let compactorIdentityChanged: boolean
    try {
      nextCompactorInput = resolveCompactorInput()
      compactorIdentityChanged = !Object.is(
        toRaw(nextCompactorInput),
        toRaw(effectiveCompactorInput),
      )
      nextConfig = resolveConfig(
        compactorIdentityChanged
          ? snapshotCompactor(nextCompactorInput)
          : effectiveConfig.compactor,
      )
    } catch (error) {
      if (!(error instanceof GridLayoutValidationError)) throw error
      const interaction = activeInteraction
      const terminal = interaction
        ? finishInteraction(interaction, 'cancelled', 'config-changed', null, false)
        : null
      const result: RejectedLayoutOperationResult = {
        operation: 'set',
        id: interaction?.id ?? null,
        previousLayout: cloneLayout(layoutState.value),
        layout: cloneLayout(layoutState.value),
        candidate: interaction
          ? cloneLayout([layoutState.value.find(item => Object.is(item.i, interaction.id))!])[0]
          : null,
        status: 'rejected',
        reason: 'invalid-input',
      }
      const callbacks: Array<() => void> = []
      if (options.onError) {
        const payload = runtimeError(
          error,
          evaluationId,
          interaction?.latestRevision ?? null,
          'config',
        )
        callbacks.push(() => options.onError!(payload))
      }
      if (interaction && options.onOperationRejected) {
        const payload = rejectedPayload(
          result,
          evaluationId,
          interaction?.latestRevision ?? null,
          'config',
        )
        callbacks.push(() => options.onOperationRejected!(payload))
      }
      if (terminal && options.onInteractionEnd) {
        callbacks.push(() => options.onInteractionEnd!(cloneTerminal(terminal)))
      }
      callAll(callbacks)
      return
    }

    // 配置也走引擎的评估/确认协议，确保约束变化与普通布局命令拥有相同回滚语义。
    const evaluation = engine.evaluate({ type: 'config', config: nextConfig })
    const interaction = activeInteraction
    if (evaluation.result.status === 'rejected') {
      const confirmed = engine.confirm(evaluation)
      const rejectedEvaluation = withActiveConfigCandidate(
        { ...evaluation, result: confirmed },
        interaction,
      )
      const terminal = interaction
        ? finishInteraction(
            interaction,
            'cancelled',
            evaluation.result.reason === 'extension-error' ||
              evaluation.result.reason === 'extension-invalid-result'
              ? evaluation.result.reason
              : 'config-changed',
            null,
            false,
          )
        : undefined
      notifyRejected(
        rejectedEvaluation,
        evaluationId,
        interaction?.latestRevision ?? null,
        'config',
        null,
        terminal,
        Boolean(interaction) || !evaluation.failure || evaluation.failure.kind === 'extension',
      )
      return
    }

    let terminal: InteractionTerminalPayload | null = null
    const cancelReason = interaction
      ? configCancelReason(interaction, nextConfig, compactorIdentityChanged)
      : null
    if (interaction && cancelReason) {
      terminal = finishInteraction(interaction, 'cancelled', cancelReason, null, false)
    }
    const confirmed = engine.confirm(evaluation)
    if (confirmed.status === 'rejected') {
      const rejectedEvaluation = withActiveConfigCandidate(
        { ...evaluation, result: confirmed },
        interaction,
      )
      notifyRejected(
        rejectedEvaluation,
        evaluationId,
        interaction?.latestRevision ?? null,
        'config',
        null,
        terminal ?? undefined,
      )
      return
    }
    if (confirmed.status === 'accepted') allocateRevision()
    effectiveConfig = evaluation.nextConfig
    effectiveCompactorInput = nextCompactorInput
    syncLayout(confirmed.layout, effectiveConfig)
    if (confirmed.status === 'accepted') writeExternalRef(confirmed.layout)

    const callbacks: Array<() => void> = []
    if (terminal && options.onInteractionEnd) {
      callbacks.push(() => options.onInteractionEnd!(cloneTerminal(terminal!)))
    }
    if (confirmed.status === 'accepted' && options.onLayoutChange) {
      callbacks.push(() => options.onLayoutChange!(cloneLayout(confirmed.layout), 'config'))
    }
    callAll(callbacks)
  }

  if (externalLayout) {
    watch(
      externalLayout,
      value => {
        if (value === guardedRefValue) {
          guardedRefValue = null
          return
        }

        const evaluationId = allocateEvaluationId()
        let moved = false
        let nextLayout: Layout
        try {
          nextLayout = snapshotStrictLayout(value, effectiveConfig)
          moved = hasMovedInput(value)
        } catch (error) {
          if (!(error instanceof GridLayoutValidationError)) throw error
          writeExternalRef(layoutState.value)
          const interaction = activeInteraction
          const terminal = interaction
            ? finishInteraction(interaction, 'cancelled', 'external-update', null, false)
            : null
          const result: RejectedLayoutOperationResult = {
            operation: 'set',
            id: null,
            previousLayout: cloneLayout(layoutState.value),
            layout: cloneLayout(layoutState.value),
            candidate: null,
            status: 'rejected',
            reason: 'invalid-input',
          }
          const callbacks: Array<() => void> = []
          if (options.onError) {
            const payload = runtimeError(
              error,
              evaluationId,
              interaction?.latestRevision ?? null,
              'layout',
            )
            callbacks.push(() => options.onError!(payload))
          }
          if (interaction && options.onOperationRejected) {
            const payload = rejectedPayload(result, evaluationId, interaction.latestRevision)
            callbacks.push(() => options.onOperationRejected!(payload))
          }
          if (terminal && options.onInteractionEnd) {
            callbacks.push(() => options.onInteractionEnd!(cloneTerminal(terminal)))
          }
          callAll(callbacks)
          return
        }

        if (layoutsGeometryEqual(nextLayout, layoutState.value)) {
          // 仅 metadata 变化不终止交互，也不重新运行布局算法。
          if (!layoutsSemanticallyEqual(nextLayout, layoutState.value)) {
            const merged = engine.mergeExternalMetadata(nextLayout)
            syncLayout(merged, effectiveConfig)
          }
          if (moved) writeExternalRef(nextLayout)
          return
        }

        const interaction = activeInteraction
        const replaced = engine.replaceExternal(nextLayout, effectiveConfig)
        if (replaced.status === 'rejected') return
        syncLayout(replaced.layout, effectiveConfig)
        if (moved) writeExternalRef(replaced.layout)
        if (interaction) {
          finishInteraction(interaction, 'cancelled', 'external-update', null)
        }
      },
      { flush: 'sync' },
    )
  }

  watch(
    () => {
      const gap = options.gap === undefined ? ([10, 10] as const) : toValue(options.gap)
      const containerPadding =
        options.containerPadding === undefined ? undefined : toValue(options.containerPadding)
      const compactor =
        options.compactor === undefined ? verticalCompactor : toValue(options.compactor)
      return [
        toValue(options.cols),
        options.rowHeight === undefined ? 150 : toValue(options.rowHeight),
        gap,
        spacingDependency(gap, 0),
        spacingDependency(gap, 1),
        containerPadding,
        spacingDependency(containerPadding, 0),
        spacingDependency(containerPadding, 1),
        options.maxRows === undefined ? Infinity : toValue(options.maxRows),
        toRaw(compactor),
        options.collisionMode === undefined ? undefined : toValue(options.collisionMode),
        options.isDraggable === undefined ? true : toValue(options.isDraggable),
        options.isResizable === undefined ? true : toValue(options.isResizable),
        options.restoreOnDrag === undefined ? false : toValue(options.restoreOnDrag),
        options.bringToFrontOnInteract === undefined
          ? true
          : toValue(options.bringToFrontOnInteract),
      ]
    },
    handleConfigChange,
    { flush: 'sync' },
  )

  if (getCurrentScope()) {
    onScopeDispose(() => {
      const interaction = activeInteraction
      if (interaction) finishInteraction(interaction, 'cancelled', 'unmount', null)
    })
  }

  return {
    layout: readonly(layoutState) as Readonly<Ref<ReadonlyLayout>>,
    placeholder: readonly(placeholderState) as Readonly<Ref<ReadonlyLayoutItem | null>>,
    dragState: readonly(dragStateValue) as Readonly<Ref<GridDragState>>,
    resizeState: readonly(resizeStateValue) as Readonly<Ref<GridResizeState>>,
    isInteracting: readonly(isInteractingValue) as Readonly<Ref<boolean>>,
    containerRows: readonly(containerRowsValue) as Readonly<Ref<number>>,
    containerHeight: readonly(containerHeightValue) as Readonly<Ref<number>>,
    setLayout: layout => runOperation({ type: 'set', layout }, 'set'),
    moveItem: (id, x, y) => runOperation({ type: 'move', id, x, y }, 'move'),
    resizeItem: (id, w, h) => runOperation({ type: 'resize', id, w, h }, 'resize'),
    addItem: item => runOperation({ type: 'add', item }, 'add'),
    removeItem: id => runOperation({ type: 'remove', id }, 'remove'),
    bringToFront: id => runOperation({ type: 'layer', id, direction: 'front' }, 'layer'),
    sendToBack: id => runOperation({ type: 'layer', id, direction: 'back' }, 'layer'),
    beginInteraction,
    updateInteraction,
    endInteraction,
    cancelInteraction,
  }
}
