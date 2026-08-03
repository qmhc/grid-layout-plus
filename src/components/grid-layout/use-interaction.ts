/**
 * GridItem 拖拽与缩放的交互 composable，内部以单会话状态机运行。
 *
 * 职责：管理交互 session、RAF 合并、预览样式、焦点恢复以及开始/变化/结束事件。
 * 边界：不持有受控布局的最终提交状态；布局确认、超时和回滚交给 transaction controller。
 * 关键约束：任一时刻只允许一个 active interaction，且每条终态路径都必须清理预览和缓冲区。
 */
import { nextTick } from 'vue'

import { layoutsSemanticallyEqual } from '../../core/layout-engine'
import { cloneLayout, getLayoutItem } from '../../helpers/common'

import type { InteractionTransactionBuffer } from '../../core/transaction-buffer'
import type {
  InternalEffectiveConfig,
  InternalInteractionSession,
  LayoutEngineEvaluation,
  LayoutEnginePort,
} from '../../core/layout-engine'
import type { GridItemRegistration } from '../../helpers/internal-types'
import type {
  Layout,
  LayoutItem,
  LayoutOperationReason,
  LayoutOperationResult,
  PositionStrategy,
  ReadonlyLayout,
  ReadonlyLayoutItem,
} from '../../helpers/types'
import type {
  InteractionCancelReason,
  InteractionTerminalPayload,
  OperationRejectedPayload,
} from '../../composables/useGridLayout'
import type { InteractionChangePayload, InteractionStartPayload } from '../types'
import type { PositionStyleBatchResult, PositionStyleMap } from './position-style-controller'
import type { LayoutTransactionController } from './transaction-controller'

/** 单次 drag/resize session 的内部快照，不作为公共组件 API 暴露。 */
export interface ActiveGridInteraction {
  type: 'drag' | 'resize'
  id: LayoutItem['i']
  session: InternalInteractionSession
  previousLayout: Layout
  oldItem: LayoutItem
  latestRevision: number | null
  latestNativeEvent: Event | null
  endRequested: boolean
  focusedElement: HTMLElement | null
}

interface InteractionViewState {
  width: number | null
  isDragging: boolean
  placeholder: {
    x: number
    y: number
    w: number
    h: number
    i: LayoutItem['i']
  }
}

interface OperationRejectedOptions {
  revision?: number | null
  evaluationId?: number
  operation?: OperationRejectedPayload['operation']
  id?: LayoutItem['i'] | null
  candidate?: ReadonlyLayoutItem | null
  previousLayout?: ReadonlyLayout
  layout?: ReadonlyLayout
  nativeEvent?: Event | null
}

interface UseGridInteractionOptions<B extends string> {
  state: InteractionViewState
  engine: LayoutEnginePort
  interactionBuffer: InteractionTransactionBuffer
  getTransactionController(): LayoutTransactionController<B>
  isUnavailable(): boolean
  runAsyncBoundary<T>(callback: () => T): T | undefined
  getRoot(): HTMLElement | null
  getCurrentLayout(): ReadonlyLayout
  getCommittedLayout(): ReadonlyLayout
  syncEngineLayout(layout: ReadonlyLayout): void
  getPositionStrategy(): PositionStrategy
  getItem(id: LayoutItem['i']): GridItemRegistration | undefined
  validateRegisteredItems(): void
  evaluatePositionStyles(
    layout: ReadonlyLayout,
    strategy: PositionStrategy,
    width: number | null,
    config: InternalEffectiveConfig,
  ): PositionStyleBatchResult
  commitPreviewPositionStyles(styles: PositionStyleMap, ready: boolean): void
  restoreCommittedPositionStyles(): void
  rejectPositionStyles(
    failure: Extract<PositionStyleBatchResult, { ok: false }>,
    result: LayoutOperationResult,
    operation: OperationRejectedPayload['operation'],
    options?: { initial?: boolean; deferInteractionFinish?: boolean },
  ): LayoutOperationResult
  nextEvaluationId(): number
  emitEvaluationError(
    evaluation: LayoutEngineEvaluation,
    revision: number | null,
    evaluationId: number,
  ): void
  emitOperationRejected(
    result: LayoutOperationResult,
    reason: LayoutOperationReason,
    options?: OperationRejectedOptions,
  ): OperationRejectedPayload
  emitInteractionStart(payload: InteractionStartPayload): void
  emitInteractionChange(payload: InteractionChangePayload): void
  emitInteractionEnd(payload: InteractionTerminalPayload): void
  emitLayoutUpdated(layout: ReadonlyLayout, revision: number): void
  invalidateDropProposal(): void
  emitCompact(): void
  updateHeight(): void
  applyDeferredEngineConfig(): void
  schedulePendingObservedWidth(): void
  isResponsive(): boolean
  prepareResponsiveLayout(): void
}

export interface UseGridInteractionReturn {
  getActive(): ActiveGridInteraction | null
  hasActive(): boolean
  isActive(type: 'drag' | 'resize', id: LayoutItem['i']): boolean
  updateTransaction(revision: number, nativeEvent: Event | null): void
  deferConfigApply(): void
  cancelForConfig(reason: Extract<InteractionCancelReason, 'config-changed' | 'disabled'>): void
  prepareForTerminal(): void
  finish(
    status: InteractionTerminalPayload['status'],
    reason: InteractionTerminalPayload['reason'],
    options?: {
      revision?: number | null
      nativeEvent?: Event | null
      emitUpdated?: boolean
      silent?: boolean
    },
  ): void
  clearForExternalReplacement(): void
  clearView(): void
  cancelPendingFrame(): void
  cancel(token?: unknown): boolean
  suspendForTransfer(): void
  finishTransfer(reason: 'transferred' | 'cancelled', nativeEvent: Event | null): void
  emitChange(result: LayoutOperationResult, revision: number, nativeEvent: Event | null): void
  rememberFocusedDescendant(event: FocusEvent): void
  rememberPointerFocus(): void
  dragEvent(
    eventName: string,
    id: LayoutItem['i'],
    x: number,
    y: number,
    h: number,
    w: number,
    nativeEvent?: Event,
  ): void
  resizeEvent(
    eventName: string | undefined,
    id: LayoutItem['i'],
    x: number,
    y: number,
    h: number,
    w: number,
    nativeEvent?: Event,
  ): void
}

/** 管理原生拖拽/缩放从 session 开始到终态清理的完整交互状态机。 */
export function useGridInteraction<B extends string>(
  options: UseGridInteractionOptions<B>,
): UseGridInteractionReturn {
  let activeInteraction: ActiveGridInteraction | null = null
  let pendingFrame = 0
  let pointerFocusedElement: HTMLElement | null = null
  let deferredConfigApply = false

  function createNativeEvent(type: string, nativeEvent?: Event | null): Event {
    return nativeEvent ?? new Event(type)
  }

  function emitStart(nativeEvent?: Event | null): void {
    const interaction = activeInteraction
    if (!interaction) return
    const layout = cloneLayout(interaction.previousLayout)
    const item = layout.find(entry => Object.is(entry.i, interaction.id))!
    options.emitInteractionStart({
      type: interaction.type,
      id: interaction.id,
      revision: null,
      oldItem: item,
      item,
      layout,
      placeholder: null,
      nativeEvent: createNativeEvent(`${interaction.type}start`, nativeEvent),
    })
  }

  function emitChange(
    result: LayoutOperationResult,
    revision: number,
    nativeEvent: Event | null,
  ): void {
    const interaction = activeInteraction
    if (!interaction) return
    const layout = cloneLayout(result.layout)
    const item = layout.find(entry => Object.is(entry.i, interaction.id))!
    const previousLayout = cloneLayout(interaction.previousLayout)
    const oldItem = previousLayout.find(entry => Object.is(entry.i, interaction.id))!
    options.emitInteractionChange({
      type: interaction.type,
      id: interaction.id,
      revision,
      oldItem,
      item,
      layout,
      placeholder: cloneLayout([item])[0],
      nativeEvent,
    })
  }

  function restoreFocus(element: HTMLElement | null): void {
    if (!element) return
    nextTick(() => {
      if (options.isUnavailable()) return
      if (element.isConnected && document.activeElement !== element) {
        element.focus({ preventScroll: true })
      }
    })
  }

  function clearView(): void {
    options.state.isDragging = false
    options.state.placeholder = { x: 0, y: 0, w: 0, h: 0, i: '' }
  }

  function showView(): void {
    options.state.isDragging = true
  }

  function cancelPendingFrame(): void {
    if (pendingFrame && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(pendingFrame)
    }
    pendingFrame = 0
    options.interactionBuffer.clearProposal()
  }

  /**
   * 统一的交互终态出口。所有 accepted、rejected、cancelled 路径都必须经过这里，
   * 以保证焦点、placeholder、RAF 和 transaction buffer 被成套清理。
   */
  function finish(
    status: InteractionTerminalPayload['status'],
    reason: InteractionTerminalPayload['reason'],
    finishOptions: {
      revision?: number | null
      nativeEvent?: Event | null
      emitUpdated?: boolean
      silent?: boolean
    } = {},
  ): void {
    const interaction = activeInteraction
    if (!interaction) return
    const previousLayout = cloneLayout(interaction.previousLayout)
    const committedLayout = options.getCommittedLayout()
    const layout = cloneLayout(committedLayout)
    const oldItem = previousLayout.find(item => Object.is(item.i, interaction.id))!
    const item = layout.find(entry => Object.is(entry.i, interaction.id)) ?? null
    const focusedElement = interaction.focusedElement
    const revision = finishOptions.revision ?? interaction.latestRevision

    clearView()
    options.engine.closeInteraction(interaction.session)
    activeInteraction = null
    cancelPendingFrame()
    options.getTransactionController().invalidateDeadline()
    options.interactionBuffer.finishTerminal()
    options.syncEngineLayout(committedLayout)
    options.restoreCommittedPositionStyles()
    const activeItem = options.getItem(interaction.id)
    activeItem?.resetInteractionState(interaction.type)
    activeItem?.refreshPositionStyle()
    options.updateHeight()

    if (!finishOptions.silent) {
      options.emitInteractionEnd({
        type: interaction.type,
        id: interaction.id,
        revision,
        previousLayout,
        layout,
        oldItem,
        item,
        nativeEvent: finishOptions.nativeEvent ?? null,
        status,
        reason,
      } as InteractionTerminalPayload)
      if (finishOptions.emitUpdated && revision !== null) {
        options.emitLayoutUpdated(committedLayout, revision)
      }
    }
    if (!options.isUnavailable()) restoreFocus(focusedElement)

    if (deferredConfigApply && !options.isUnavailable()) {
      deferredConfigApply = false
      nextTick(() => options.runAsyncBoundary(options.applyDeferredEngineConfig))
    }
    options.schedulePendingObservedWidth()
  }

  function prepareForTerminal(): void {
    const interaction = activeInteraction
    const transactionController = options.getTransactionController()
    const pending = transactionController.getPending()
    if (pending?.interaction) transactionController.abandon(pending, true)
    cancelPendingFrame()
    clearView()
    options.restoreCommittedPositionStyles()
    if (interaction) {
      const activeItem = options.getItem(interaction.id)
      activeItem?.resetInteractionState(interaction.type)
      activeItem?.refreshPositionStyle()
    }
  }

  /** 回滚源网格的暂态预览，同时保留原生拖拽会话供离开目标后继续。 */
  function suspendForTransfer(): void {
    const pending = options.getTransactionController().getPending()
    if (pending?.interaction) options.getTransactionController().abandon(pending, true)
    cancelPendingFrame()
    clearView()
    options.syncEngineLayout(options.getCommittedLayout())
    options.restoreCommittedPositionStyles()
    options.updateHeight()
  }

  /** 以跨网格终态关闭源网格的内部 drag interaction。 */
  function finishTransfer(reason: 'transferred' | 'cancelled', nativeEvent: Event | null): void {
    if (activeInteraction?.type !== 'drag') return
    suspendForTransfer()
    finish('cancelled', reason, { nativeEvent })
  }

  function cancelForConfig(
    reason: Extract<InteractionCancelReason, 'config-changed' | 'disabled'>,
  ): void {
    prepareForTerminal()
    finish('cancelled', reason, { nativeEvent: null })
  }

  /** 首次原生事件创建 session；后续同类型事件只能更新该 session。 */
  function begin(
    type: 'drag' | 'resize',
    id: LayoutItem['i'],
    nativeEvent?: Event | null,
  ): boolean {
    if (options.isUnavailable()) return false
    options.validateRegisteredItems()
    const started = options.engine.beginInteraction({ type, id })
    if (started.status === 'rejected') {
      if (started.result.reason !== 'interaction-active') {
        options.emitOperationRejected(started.result, started.result.reason, {
          nativeEvent: nativeEvent ?? null,
        })
      }
      return false
    }
    options.invalidateDropProposal()
    const previousLayout = cloneLayout(options.getCommittedLayout())
    const oldItem = previousLayout.find(item => Object.is(item.i, id))!
    const root = options.getRoot()
    const activeElement =
      document.activeElement instanceof HTMLElement && root?.contains(document.activeElement)
        ? document.activeElement
        : pointerFocusedElement?.isConnected && root?.contains(pointerFocusedElement)
          ? pointerFocusedElement
          : null
    pointerFocusedElement = null
    activeInteraction = {
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
    options.state.placeholder = {
      i: id,
      x: oldItem.x,
      y: oldItem.y,
      w: oldItem.w,
      h: oldItem.h,
    }
    showView()
    emitStart(nativeEvent)
    return true
  }

  function evaluateCandidate(
    type: 'drag' | 'resize',
    id: LayoutItem['i'],
    next: { x: number; y: number } | { w: number; h: number },
    nativeEvent: Event | null,
    terminal = false,
    terminalState: { cancelReason: InteractionCancelReason | null } | null = null,
  ): LayoutOperationResult | null {
    const interaction = activeInteraction
    if (!interaction || interaction.type !== type || interaction.id !== id) return null
    const evaluation = options.engine.evaluateInteraction(
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
      const evaluationId = options.nextEvaluationId()
      if (evaluation.failure?.kind === 'extension') {
        clearView()
        options.emitEvaluationError(evaluation, interaction.latestRevision, evaluationId)
      }
      options.emitOperationRejected(result, result.reason, {
        revision: interaction.latestRevision,
        evaluationId,
        nativeEvent,
      })
      if (result.reason === 'extension-error' || result.reason === 'extension-invalid-result') {
        if (terminalState) terminalState.cancelReason = result.reason
        else finish('cancelled', result.reason, { nativeEvent: null })
      }
      return result
    }
    if (result.status === 'unchanged') return result

    const styleEvaluation = options.evaluatePositionStyles(
      result.layout,
      options.getPositionStrategy(),
      options.state.width,
      evaluation.nextConfig,
    )
    if (!styleEvaluation.ok) {
      options.engine.rollback(evaluation)
      const rejected = options.rejectPositionStyles(styleEvaluation, result, result.operation, {
        deferInteractionFinish: terminalState !== null,
      })
      if (terminalState) {
        terminalState.cancelReason =
          styleEvaluation.source === 'geometry' ? 'geometry-error' : styleEvaluation.reason
      }
      return rejected
    }
    options.commitPreviewPositionStyles(styleEvaluation.styles, styleEvaluation.ready)
    options.syncEngineLayout(result.layout)
    const target = getLayoutItem(options.getCurrentLayout(), id)!
    options.state.placeholder = {
      i: id,
      x: target.x,
      y: target.y,
      w: target.w,
      h: target.h,
    }
    showView()
    options.emitCompact()
    options.updateHeight()
    options
      .getTransactionController()
      .begin(evaluation, result.operation, 'interaction', true, nativeEvent, styleEvaluation.styles)
    return result
  }

  function flushPendingCandidate(): LayoutOperationResult | null {
    const candidate = options.interactionBuffer.takeProposal()
    if (!candidate) return null
    if (pendingFrame && typeof cancelAnimationFrame === 'function')
      cancelAnimationFrame(pendingFrame)
    pendingFrame = 0
    return evaluateCandidate(candidate.type, candidate.id, candidate.value, candidate.nativeEvent)
  }

  function scheduleCandidate(
    type: 'drag' | 'resize',
    id: LayoutItem['i'],
    value: { x: number; y: number } | { w: number; h: number },
    nativeEvent: Event | null,
  ): void {
    if (options.isUnavailable()) return
    options.interactionBuffer.replaceProposal({ type, id, value, nativeEvent })
    if (pendingFrame) return
    if (typeof requestAnimationFrame !== 'function') {
      flushPendingCandidate()
      return
    }
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = 0
      options.runAsyncBoundary(flushPendingCandidate)
    })
  }

  function end(nativeEvent: Event | null): void {
    const interaction = activeInteraction
    if (!interaction) return
    interaction.latestNativeEvent = nativeEvent
    interaction.endRequested = true
    const transactionController = options.getTransactionController()
    const pending = transactionController.getPending()
    if (pending?.interaction) {
      transactionController.startDeadline(pending)
      return
    }
    const unchanged = layoutsSemanticallyEqual(
      interaction.previousLayout,
      options.getCommittedLayout(),
    )
    finish(unchanged ? 'unchanged' : 'committed', unchanged ? 'same-value' : 'applied', {
      revision: interaction.latestRevision,
      nativeEvent,
      emitUpdated: !unchanged,
    })
  }

  function cancel(_token?: unknown): boolean {
    if (!activeInteraction) return false
    const transactionController = options.getTransactionController()
    const pending = transactionController.getPending()
    if (pending?.interaction) transactionController.abandon(pending, true)
    cancelPendingFrame()
    finish('cancelled', 'cancelled', { nativeEvent: null })
    return true
  }

  function discardTerminalAfterListenerError(type: 'drag' | 'resize', id: LayoutItem['i']): void {
    const interaction = activeInteraction
    if (!interaction || interaction.type !== type || interaction.id !== id) return
    prepareForTerminal()
    finish('cancelled', 'cancelled', { nativeEvent: null, silent: true })
  }

  function finishNative(
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
      evaluateCandidate(type, id, candidate, nativeEvent, true, terminalState)
      const interaction = activeInteraction
      if (interaction?.type === type && interaction.id === id) {
        const item = getLayoutItem(options.getCurrentLayout(), id) ?? null
        const activeItem = options.getItem(id)
        if (type === 'drag') activeItem?.finishDragInteraction(item)
        else activeItem?.finishResizeInteraction(item)
      }
      listenersCompleted = true
    } finally {
      if (!listenersCompleted) discardTerminalAfterListenerError(type, id)
    }

    const interaction = activeInteraction
    if (!interaction || interaction.type !== type || interaction.id !== id) return
    if (terminalState.cancelReason) {
      const revision = interaction.latestRevision
      prepareForTerminal()
      finish('cancelled', terminalState.cancelReason, { revision, nativeEvent: null })
      return
    }
    end(nativeEvent)
  }

  function dragEvent(
    eventName: string,
    id: LayoutItem['i'],
    x: number,
    y: number,
    _h: number,
    _w: number,
    nativeEvent?: Event,
  ): void {
    if (!getLayoutItem(options.getCurrentLayout(), id)) return
    if (eventName === 'dragstart') {
      if (options.isResponsive()) options.prepareResponsiveLayout()
      if (!begin('drag', id, nativeEvent)) {
        options.getItem(id)?.resetInteractionState('drag')
        return
      }
      evaluateCandidate('drag', id, { x, y }, nativeEvent ?? null)
      return
    }
    if (eventName === 'dragmove') {
      scheduleCandidate('drag', id, { x, y }, nativeEvent ?? null)
      return
    }
    if (eventName === 'dragend') finishNative('drag', id, { x, y }, nativeEvent ?? null)
  }

  function resizeEvent(
    eventName: string | undefined,
    id: LayoutItem['i'],
    _x: number,
    _y: number,
    h: number,
    w: number,
    nativeEvent?: Event,
  ): void {
    if (!getLayoutItem(options.getCurrentLayout(), id)) return
    if (eventName === 'resizestart') {
      if (options.isResponsive()) options.prepareResponsiveLayout()
      if (!begin('resize', id, nativeEvent)) {
        options.getItem(id)?.resetInteractionState('resize')
        return
      }
      evaluateCandidate('resize', id, { w, h }, nativeEvent ?? null)
      return
    }
    if (eventName === 'resizemove') {
      scheduleCandidate('resize', id, { w, h }, nativeEvent ?? null)
      return
    }
    if (eventName === 'resizeend') finishNative('resize', id, { w, h }, nativeEvent ?? null)
  }

  return {
    getActive: () => activeInteraction,
    hasActive: () => activeInteraction !== null,
    isActive: (type, id) => activeInteraction?.type === type && activeInteraction.id === id,
    updateTransaction: (revision, nativeEvent) => {
      if (!activeInteraction) return
      activeInteraction.latestRevision = revision
      activeInteraction.latestNativeEvent = nativeEvent
    },
    deferConfigApply: () => {
      deferredConfigApply = true
    },
    cancelForConfig,
    prepareForTerminal,
    finish,
    clearForExternalReplacement: () => {
      activeInteraction = null
      clearView()
    },
    clearView,
    cancelPendingFrame,
    cancel,
    suspendForTransfer,
    finishTransfer,
    emitChange,
    rememberFocusedDescendant: event => {
      pointerFocusedElement = event.target instanceof HTMLElement ? event.target : null
    },
    rememberPointerFocus: () => {
      const activeElement = document.activeElement
      const root = options.getRoot()
      pointerFocusedElement =
        activeElement instanceof HTMLElement && root?.contains(activeElement) ? activeElement : null
    },
    dragEvent,
    resizeEvent,
  }
}
