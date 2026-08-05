/**
 * 外部元素拖入 GridLayout 的原生 DragEvent 会话 composable。
 *
 * 职责：维护 drag session、占位 proposal 和预览布局，并在松手时创建完整 item。
 * 边界：受控 layout 的提案与确认由通用 transaction controller 管理。
 */
import { toRaw } from 'vue'

import { GridLayoutExtensionError, GridLayoutValidationError } from '../../core/errors'
import { gridToPixelRect, isDerivedGeometryError, pointerToGridPosition } from '../../core/utils'
import { snapshotDropResult } from '../../core/validation'
import { cloneLayout } from '../../helpers/common'

import type {
  GridLayoutRuntimeError,
  OperationRejectedReason,
} from '../../composables/useGridLayout'
import type {
  InternalEffectiveConfig,
  LayoutEngineEvaluation,
  LayoutEnginePort,
} from '../../core/layout-engine'
import type { DropConfigSnapshot } from '../../core/validation'
import type { PositionStrategy, ReadonlyLayout, ReadonlyLayoutItem } from '../../helpers/types'
import type {
  DropCandidate,
  DropDragOverContext,
  DropDragOverInput,
  DropEvaluationResult,
} from '../types'
import type { OperationRejectedPayload } from '../../composables/useGridLayout'
import type { PositionStyleBatchResult, PositionStyleMap } from './position-style-controller'

/** 当前外部拖入位置对应的预览 proposal。 */
export interface DropProposalRecord<B extends string> {
  readonly sessionId: number
  readonly proposalId: number
  readonly breakpoint: B | null
  readonly candidate: DropCandidate
  readonly previewLayout: ReadonlyLayout
  readonly insertionIndex: number
}

interface DropPlaceholderState<B extends string> {
  width: number | null
  lastBreakpoint: B | null
  dropPlaceholder: { x: number; y: number; w: number; h: number } | null
}

interface UseGridDropOptions<B extends string> {
  state: DropPlaceholderState<B>
  engine: LayoutEnginePort
  isUnavailable(): boolean
  isResponsive(): boolean
  hasActiveInteraction(): boolean
  getRoot(): HTMLElement | null
  getConfig(): InternalEffectiveConfig
  getStrategy(): PositionStrategy
  getDropConfig(): DropConfigSnapshot
  getDropItem(): Readonly<{ w: number; h: number }>
  getCurrentLayout(): ReadonlyLayout
  getDirection(): 'ltr' | 'rtl'
  evaluatePositionStyles(
    layout: ReadonlyLayout,
    strategy: PositionStrategy,
    width: number | null,
    config: InternalEffectiveConfig,
  ): PositionStyleBatchResult
  syncPreviewLayout(layout: ReadonlyLayout): void
  commitPreviewStyles(styles: PositionStyleMap, ready: boolean): void
  restorePreview(): void
  updateHeight(): void
  prepareCommitEvaluation(): void
  nextEvaluationId(): number
  emitRuntimeError(error: unknown, overrides: Partial<GridLayoutRuntimeError>): void
  onOperationRejected(payload: OperationRejectedPayload): void
  onDragOver(context: DropDragOverContext<B>, event: DragEvent): void
  onCommitRequest(
    item: ReadonlyLayoutItem,
    result: Extract<DropEvaluationResult<B>, { status: 'accepted' }>,
    event: DragEvent,
    evaluation: LayoutEngineEvaluation,
  ): void
  onDragLeave(event: DragEvent): void
}

export interface UseGridDropReturn {
  handleDragEnter(event: DragEvent): void
  handleDragOver(event: DragEvent): void
  handleDrop(event: DragEvent): void
  handleDragLeave(event: DragEvent): void
  finishSession(restore?: boolean): void
  invalidateProposal(restore?: boolean): void
  hasProposal(): boolean
}

function cloneDropCandidate(candidate: DropCandidate): DropCandidate {
  return { ...candidate }
}

function hasDropGeometry(item: ReadonlyLayoutItem, candidate: DropCandidate): boolean {
  return (
    item.x === candidate.x &&
    item.y === candidate.y &&
    item.w === candidate.w &&
    item.h === candidate.h
  )
}

function setDropEffect(event: DragEvent, effect: 'none' | 'copy'): void {
  try {
    if (event.dataTransfer) event.dataTransfer.dropEffect = effect
  } catch {
    // 某些浏览器将 dropEffect 暴露为只读；这不影响布局判定。
  }
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

/** 管理外部拖入的 DOM session、proposal 预览及 item 创建。 */
export function useGridDrop<B extends string>(options: UseGridDropOptions<B>): UseGridDropReturn {
  let proposalSequence = 0
  let sessionSequence = 0
  let sessionId: number | null = null
  let currentProposal: DropProposalRecord<B> | null = null
  let enterDepth = 0
  let leaveFrame = 0
  let sessionListenersAttached = false

  function capabilityReady(): boolean {
    return (
      options.getDropConfig().isDroppable === true &&
      options.state.width !== null &&
      options.state.width > 0 &&
      (!options.isResponsive() || options.state.lastBreakpoint !== null) &&
      !options.hasActiveInteraction()
    )
  }

  function invalidateProposal(restore = true): void {
    const hadProposal = currentProposal !== null || options.state.dropPlaceholder !== null
    currentProposal = null
    options.state.dropPlaceholder = null
    if (restore && hadProposal) options.restorePreview()
  }

  function handleSessionCancel(): void {
    if (sessionId !== null) finishSession()
  }

  function handleSessionKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') handleSessionCancel()
  }

  function handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden') handleSessionCancel()
  }

  function detachSessionListeners(): void {
    if (!sessionListenersAttached) return
    sessionListenersAttached = false
    document.removeEventListener('dragend', handleSessionCancel, true)
    document.removeEventListener('keydown', handleSessionKeydown, true)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('blur', handleSessionCancel)
  }

  function attachSessionListeners(): void {
    if (sessionListenersAttached) return
    sessionListenersAttached = true
    document.addEventListener('dragend', handleSessionCancel, true)
    document.addEventListener('keydown', handleSessionKeydown, true)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleSessionCancel)
  }

  /** 结束 DOM drag session；restore=false 仅用于 proposal 已交给提交协议的路径。 */
  function finishSession(restore = true): void {
    sessionId = null
    enterDepth = 0
    if (leaveFrame && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(leaveFrame)
    }
    leaveFrame = 0
    detachSessionListeners()
    invalidateProposal(restore)
  }

  function ensureSession(): number {
    if (sessionId !== null) return sessionId
    sessionSequence += 1
    if (!Number.isSafeInteger(sessionSequence)) {
      throw new GridLayoutValidationError('Drop session counter is exhausted', {
        code: 'invalid-config',
        path: 'config.counter["dropSession"]',
        cause: sessionSequence,
      })
    }
    sessionId = sessionSequence
    attachSessionListeners()
    return sessionId
  }

  function nextProposalId(): number {
    proposalSequence += 1
    if (!Number.isSafeInteger(proposalSequence)) {
      throw new GridLayoutValidationError('Drop proposal counter is exhausted', {
        code: 'invalid-config',
        path: 'config.counter["dropProposal"]',
        cause: proposalSequence,
      })
    }
    return proposalSequence
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
    const width = options.state.width
    if (width === null || width <= 0) {
      throw new GridLayoutValidationError('Drop geometry is unresolved', {
        code: 'invalid-config',
        path: 'geometry.width',
        cause: width,
      })
    }
    const config = options.getConfig()
    return {
      width,
      cols: config.cols,
      rowHeight: config.rowHeight,
      gap: config.gap,
      containerPadding: config.containerPadding,
      rtl: options.getDirection() === 'rtl',
      effectiveScale: options.getStrategy().transformScale ?? 1,
    }
  }

  function candidateAtPointer(
    event: DragEvent,
    rect: DOMRect,
    w: number,
    h: number,
  ): DropCandidate {
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
    reason: OperationRejectedReason,
    event: DragEvent,
    candidate: DropCandidate | null,
    error?: unknown,
  ): void {
    invalidateProposal()
    setDropEffect(event, 'none')
    const evaluationId = options.nextEvaluationId()
    if (error instanceof GridLayoutExtensionError) {
      options.emitRuntimeError(error, {
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
        options.emitRuntimeError(error, {
          evaluationId,
          code: isDerivedGeometryError(error) ? 'derived-geometry-overflow' : error.code,
          source: 'geometry',
          path: error.path,
          cause: error,
        })
      }
    }
    const layout = options.getCurrentLayout()
    options.onOperationRejected({
      revision: null,
      evaluationId,
      operation: 'drop',
      reason,
      id: null,
      previousLayout: cloneLayout(layout),
      layout: cloneLayout(layout),
      candidate: candidate ? cloneDropCandidate(candidate) : null,
      nativeEvent: event,
    })
  }

  function evaluateDrop(event: DragEvent, activeSessionId: number): DropProposalRecord<B> | null {
    invalidateProposal()
    setDropEffect(event, 'copy')

    const root = options.getRoot()
    if (!root) {
      setDropEffect(event, 'none')
      return null
    }
    const rect = root.getBoundingClientRect()
    let provisional: DropCandidate
    let size: { w: number; h: number }
    try {
      size = validateDropSize(options.getDropItem())
      provisional = candidateAtPointer(event, rect, size.w, size.h)
    } catch (error) {
      emitDropRejected('invalid-input', event, null, error)
      return null
    }

    const currentLayout = options.getCurrentLayout()
    const breakpoint = options.isResponsive() ? options.state.lastBreakpoint : null
    const input: DropDragOverInput<B> = {
      nativeEvent: event,
      pointer: { clientX: event.clientX, clientY: event.clientY },
      grid: { x: provisional.x, y: provisional.y },
      candidate: cloneDropCandidate(provisional),
      layout: cloneLayout(currentLayout),
      breakpoint,
      cols: options.getConfig().cols,
    }

    const callback = options.getDropConfig().onDragOver
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
        invalidateProposal()
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

    const config = options.getConfig()
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
    const syntheticId = findSyntheticId(currentLayout)
    // 用临时 id 让新增项完整经过布局引擎；得到最终几何后立即回滚，不把预览写入已提交状态。
    const evaluation = options.engine.evaluate({
      type: 'add',
      item: { ...candidate, i: syntheticId },
    })
    const result = evaluation.result
    if (result.status === 'rejected') {
      options.engine.rollback(evaluation)
      const propagatedNoPosition = result.reason === 'out-of-bounds' || result.reason === 'max-rows'
      const reason = propagatedNoPosition ? 'no-position' : result.reason
      emitDropRejected(reason, event, candidate, evaluation.failure?.error)
      return null
    }

    const evaluatedCandidate = result.layout.find(item => Object.is(item.i, syntheticId))
    if (!evaluatedCandidate) {
      options.engine.rollback(evaluation)
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
    options.engine.rollback(evaluation)

    const styleEvaluation = options.evaluatePositionStyles(
      previewLayout,
      options.getStrategy(),
      options.state.width,
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

    const proposalId = nextProposalId()
    const insertionIndex = currentLayout.length
    const proposal: DropProposalRecord<B> = {
      sessionId: activeSessionId,
      proposalId,
      breakpoint,
      candidate: cloneDropCandidate(finalCandidate),
      previewLayout: cloneLayout(previewLayout),
      insertionIndex,
    }
    const context: DropDragOverContext<B> = {
      nativeEvent: event,
      pointer: { clientX: event.clientX, clientY: event.clientY },
      grid: { x: finalCandidate.x, y: finalCandidate.y },
      candidate: cloneDropCandidate(finalCandidate),
      layout: cloneLayout(currentLayout),
      breakpoint,
      cols: config.cols,
      proposalId,
      previewLayout: cloneLayout(previewLayout),
      insertionIndex,
    }
    currentProposal = proposal
    options.state.dropPlaceholder = {
      x: finalCandidate.x,
      y: finalCandidate.y,
      w: finalCandidate.w,
      h: finalCandidate.h,
    }
    options.syncPreviewLayout(previewLayout)
    options.commitPreviewStyles(styleEvaluation.styles, styleEvaluation.ready)
    options.updateHeight()
    event.preventDefault()
    options.onDragOver(context, event)
    return proposal
  }

  function handleDragEnter(event: DragEvent): void {
    if (options.isUnavailable()) return
    setDropEffect(event, 'none')
    invalidateProposal()
    if (!capabilityReady()) return
    const root = options.getRoot()
    const related = event.relatedTarget
    if (!root || !(related instanceof Node) || !root.contains(related)) enterDepth += 1
    ensureSession()
  }

  function handleDragOver(event: DragEvent): void {
    if (options.isUnavailable()) return
    if (!capabilityReady()) {
      invalidateProposal()
      setDropEffect(event, 'none')
      return
    }
    evaluateDrop(event, ensureSession())
  }

  function handleDrop(event: DragEvent): void {
    if (options.isUnavailable()) return
    const proposal = currentProposal
    if (
      !capabilityReady() ||
      !proposal ||
      proposal.sessionId !== sessionId ||
      proposal.breakpoint !== (options.isResponsive() ? options.state.lastBreakpoint : null)
    ) {
      finishSession()
      setDropEffect(event, 'none')
      return
    }

    event.preventDefault()
    const result: Extract<DropEvaluationResult<B>, { status: 'accepted' }> = {
      status: 'accepted',
      proposalId: proposal.proposalId,
      breakpoint: proposal.breakpoint,
      candidate: cloneDropCandidate(proposal.candidate),
      previewLayout: cloneLayout(proposal.previewLayout),
      insertionIndex: proposal.insertionIndex,
      nativeEvent: event,
    }
    const createItem = options.getDropConfig().createItem
    if (!createItem) {
      emitDropRejected('invalid-input', event, proposal.candidate)
      finishSession(false)
      return
    }

    let created: unknown
    try {
      created = createItem({
        ...result,
        candidate: cloneDropCandidate(result.candidate),
        previewLayout: cloneLayout(result.previewLayout),
      })
    } catch (cause) {
      emitDropRejected(
        'extension-error',
        event,
        proposal.candidate,
        new GridLayoutExtensionError('Drop item factory failed', {
          code: 'extension-error',
          source: 'drop-config',
          path: 'config.dropConfig.createItem',
          cause,
        }),
      )
      finishSession(false)
      return
    }
    if (created === false) {
      emitDropRejected('callback-rejected', event, proposal.candidate)
      finishSession(false)
      return
    }

    let item: ReadonlyLayoutItem
    try {
      const snapshot = cloneLayout([toRaw(created) as ReadonlyLayoutItem])[0]
      item = {
        ...snapshot,
        x: proposal.candidate.x,
        y: proposal.candidate.y,
        w: proposal.candidate.w,
        h: proposal.candidate.h,
      }
    } catch (cause) {
      emitDropRejected(
        'extension-invalid-result',
        event,
        proposal.candidate,
        new GridLayoutExtensionError('Invalid Drop item factory result', {
          code: 'extension-invalid-result',
          source: 'drop-config',
          path: 'dropCreateItemResult',
          cause,
        }),
      )
      finishSession(false)
      return
    }

    options.prepareCommitEvaluation()
    // createItem 可添加 id 和约束，但不得改变已接受的 drop 几何，因此用正式 item 再求值一次。
    const verification = options.engine.evaluate({ type: 'add', item })
    const verifiedItem =
      verification.result.status === 'rejected'
        ? null
        : verification.result.layout.find(candidate => Object.is(candidate.i, item.i))
    if (
      verification.result.status !== 'rejected' &&
      (!verifiedItem || !hasDropGeometry(verifiedItem, proposal.candidate))
    ) {
      options.engine.rollback(verification)
      emitDropRejected(
        'extension-invalid-result',
        event,
        proposal.candidate,
        new GridLayoutExtensionError('Drop item factory constraints changed accepted geometry', {
          code: 'extension-invalid-result',
          source: 'drop-config',
          path: 'dropCreateItemResult',
          cause: item,
        }),
      )
      finishSession(false)
      return
    }

    invalidateProposal()
    sessionId = null
    enterDepth = 0
    detachSessionListeners()
    options.onCommitRequest(item, result, event, verification)
  }

  function leaveRoot(event: DragEvent): void {
    if (sessionId === null) return
    finishSession()
    options.onDragLeave(event)
  }

  function handleDragLeave(event: DragEvent): void {
    if (options.isUnavailable() || sessionId === null) return
    const root = options.getRoot()
    const related = event.relatedTarget
    if (root && related instanceof Node && root.contains(related)) return

    enterDepth = Math.max(0, enterDepth - 1)
    if (enterDepth > 0) return
    if (related !== null || typeof requestAnimationFrame !== 'function') {
      leaveRoot(event)
      return
    }
    if (leaveFrame) cancelAnimationFrame(leaveFrame)
    leaveFrame = requestAnimationFrame(() => {
      leaveFrame = 0
      const element =
        typeof document.elementFromPoint === 'function'
          ? document.elementFromPoint(event.clientX, event.clientY)
          : null
      if (!options.getRoot()?.contains(element)) leaveRoot(event)
    })
  }

  return {
    handleDragEnter,
    handleDragOver,
    handleDrop,
    handleDragLeave,
    finishSession,
    invalidateProposal,
    hasProposal: () => currentProposal !== null,
  }
}
