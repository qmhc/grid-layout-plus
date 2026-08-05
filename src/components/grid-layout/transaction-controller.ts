/**
 * 受控布局变更从引擎 proposal 到父组件确认的事务状态机。
 *
 * 职责：保存 pending transaction、合并元数据、处理 responsive 双确认、deadline、回滚和拒绝事件。
 * 边界：不解释拖拽/缩放手势，也不直接观察 props；interaction 与 layout-sync composable 提供这些信号。
 * 关键约束：同一时刻只有一个 pending transaction，任何替换、超时或外部更新都必须显式结束旧事务。
 */
import { nextTick } from 'vue'

import { layoutsSemanticallyEqual, mergeLayoutMetadata } from '../../core/layout-engine'
import { cloneLayout } from '../../helpers/common'

import type { InteractionTransactionBuffer } from '../../core/transaction-buffer'
import type {
  InternalEffectiveConfig,
  LayoutEngineEvaluation,
  LayoutEnginePort,
} from '../../core/layout-engine'
import type {
  Layout,
  LayoutItem,
  LayoutOperationReason,
  LayoutOperationResult,
  ReadonlyLayout,
  ReadonlyLayoutItem,
} from '../../helpers/types'
import type {
  InteractionTerminalPayload,
  OperationRejectedPayload,
} from '../../composables/useGridLayout'
import type { LayoutTransactionReceipt, LayoutUpdateMeta } from '../types'
import type { PositionStyleMap } from './position-style-controller'
import type { PendingResponsiveTransaction } from './responsive-model'

/** 尚未被父组件受控 props 确认的单次布局事务。 */
export interface PendingLayoutTransaction<B extends string> {
  evaluation: LayoutEngineEvaluation
  revision: number
  expectedLayout: Layout
  baseLayout: Layout
  operation: OperationRejectedPayload['operation']
  source: LayoutUpdateMeta['source']
  interaction: boolean
  metadataDirty: boolean
  deadlineStarted: boolean
  positionStyles: PositionStyleMap
  responsive: PendingResponsiveTransaction<B> | null
  settlement: LayoutTransactionSettlement | null
}

/** 内部工作流在受控事务终止时获取一次性通知。 */
export interface LayoutTransactionSettlement {
  committed(layout: ReadonlyLayout, revision: number): void
  rejected(reason: LayoutOperationReason): void
}

interface ActiveTransactionInteraction {
  endRequested: boolean
  previousLayout: Layout
  latestNativeEvent: Event | null
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

interface LayoutTransactionControllerOptions<B extends string> {
  engine: LayoutEnginePort
  interactionBuffer: InteractionTransactionBuffer
  isDisposing(): boolean
  isSealed(): boolean
  runAsyncBoundary<T>(callback: () => T): T | undefined
  nextRevision(): number
  getCommittedLayout(): ReadonlyLayout
  setCommittedLayout(layout: ReadonlyLayout): void
  getCurrentLayout(): ReadonlyLayout
  syncEngineLayout(layout: ReadonlyLayout): void
  setEngineConfig(config: InternalEffectiveConfig): void
  getDefaultPositionStyles(): PositionStyleMap
  commitPositionStyles(styles: PositionStyleMap): void
  restoreCommittedPositionStyles(): void
  syncItemEngineConfig(): void
  updateHeight(): void
  getActiveInteraction(): ActiveTransactionInteraction | null
  updateActiveInteraction(revision: number, nativeEvent: Event | null): void
  finishInteraction(
    status: InteractionTerminalPayload['status'],
    reason: InteractionTerminalPayload['reason'],
    options: {
      revision?: number | null
      nativeEvent?: Event | null
      emitUpdated?: boolean
    },
  ): void
  clearInteractionView(): void
  createResponsiveTransaction(result: LayoutOperationResult): PendingResponsiveTransaction<B> | null
  commitResponsiveTransaction(responsive: PendingResponsiveTransaction<B>, revision: number): void
  emitUpdateResponsiveLayouts(
    layouts: PendingResponsiveTransaction<B>['expectedLayouts'],
    revision: number,
    source: LayoutUpdateMeta['source'],
  ): void
  emitUpdateLayout(
    layout: ReadonlyLayout,
    revision: number,
    source: LayoutUpdateMeta['source'],
  ): void
  emitInteractionChange(
    result: LayoutOperationResult,
    revision: number,
    nativeEvent: Event | null,
  ): void
  emitOperationRejected(
    result: LayoutOperationResult,
    reason: LayoutOperationReason,
    options?: OperationRejectedOptions,
  ): OperationRejectedPayload
  emitLayoutUpdated(
    layout: ReadonlyLayout,
    revision: number,
    source: LayoutUpdateMeta['source'],
  ): void
  emitReadyOnce(): void
}

export interface LayoutTransactionController<B extends string> {
  getPending(): PendingLayoutTransaction<B> | null
  begin(
    evaluation: LayoutEngineEvaluation,
    operation: PendingLayoutTransaction<B>['operation'],
    source: LayoutUpdateMeta['source'],
    interaction: boolean,
    nativeEvent?: Event | null,
    evaluatedStyles?: PositionStyleMap,
    responsive?: PendingResponsiveTransaction<B> | null,
    revisionOverride?: number | null,
    settlement?: LayoutTransactionSettlement | null,
  ): LayoutTransactionReceipt
  mergeMetadata(pending: PendingLayoutTransaction<B>, observed: ReadonlyLayout): void
  tryConfirmResponsive(pending: PendingLayoutTransaction<B>, observed: ReadonlyLayout): void
  startDeadline(pending: PendingLayoutTransaction<B>): void
  supersedeNonInteraction(): void
  abandon(pending: PendingLayoutTransaction<B>, rememberSuperseded?: boolean): boolean
  rejectForExternalUpdate(pending: PendingLayoutTransaction<B>): boolean
  invalidateDeadline(): void
  disposePending(): void
}

export function cloneLayoutOperationResult(result: LayoutOperationResult): LayoutOperationResult {
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

/** 管理受控 layout 更新从 proposal 到确认、超时或回滚的完整状态机。 */
export function createLayoutTransactionController<B extends string>(
  options: LayoutTransactionControllerOptions<B>,
): LayoutTransactionController<B> {
  let pendingTransaction: PendingLayoutTransaction<B> | null = null
  let deadlineEpoch = 0

  function applyConfirmedResult(
    pending: PendingLayoutTransaction<B>,
    observed: ReadonlyLayout,
  ): LayoutOperationResult {
    const result = options.engine.confirm(pending.evaluation)
    if (result.status === 'rejected') return result

    options.setEngineConfig(pending.evaluation.nextConfig)
    let committedLayout = cloneLayout(result.layout)
    // 父组件可在确认几何的同时补充 metadata；确认后把它合并回引擎，但不接受位置覆写。
    if (
      pending.metadataDirty ||
      !layoutsSemanticallyEqual(pending.expectedLayout, pending.evaluation.result.layout) ||
      !layoutsSemanticallyEqual(observed, pending.evaluation.result.layout)
    ) {
      committedLayout = cloneLayout(options.engine.mergeExternalMetadata(observed))
    }
    options.setCommittedLayout(committedLayout)

    const interaction = options.getActiveInteraction()
    if (interaction && !interaction.endRequested) {
      options.syncEngineLayout(mergeLayoutMetadata(options.getCurrentLayout(), committedLayout))
    } else {
      options.syncEngineLayout(committedLayout)
    }
    options.commitPositionStyles(pending.positionStyles)
    options.syncItemEngineConfig()
    options.updateHeight()
    return result
  }

  function confirm(pending: PendingLayoutTransaction<B>, observed: ReadonlyLayout): void {
    if (pendingTransaction !== pending) return
    pendingTransaction = null
    deadlineEpoch += 1
    const result = applyConfirmedResult(pending, observed)
    if (result.status === 'rejected') {
      options.emitOperationRejected(result, 'superseded', {
        revision: pending.revision,
        operation: pending.operation,
      })
      pending.settlement?.rejected('superseded')
      return
    }

    const responsive = pending.responsive
    if (responsive) options.commitResponsiveTransaction(responsive, pending.revision)

    if (pending.interaction) {
      const interaction = options.getActiveInteraction()
      if (interaction?.endRequested) {
        const committedLayout = options.getCommittedLayout()
        const unchanged = layoutsSemanticallyEqual(interaction.previousLayout, committedLayout)
        options.finishInteraction(
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
      options.emitLayoutUpdated(options.getCommittedLayout(), pending.revision, pending.source)
      options.interactionBuffer.clearSuperseded()
      if (responsive?.readyAfter) options.emitReadyOnce()
    }
    pending.settlement?.committed(options.getCommittedLayout(), pending.revision)
  }

  function mergeMetadata(pending: PendingLayoutTransaction<B>, observed: ReadonlyLayout): void {
    pending.expectedLayout = mergeLayoutMetadata(pending.expectedLayout, observed)
    pending.metadataDirty = true
    if (options.getActiveInteraction()) {
      options.syncEngineLayout(mergeLayoutMetadata(options.getCurrentLayout(), observed))
    }
  }

  /**
   * 尝试完成事务。Responsive 模式下 layout 与 responsiveLayouts 必须分别确认，
   * 任一侧尚未回写时都只能继续等待，不能提前提交引擎 evaluation。
   */
  function tryConfirmResponsive(
    pending: PendingLayoutTransaction<B>,
    observed: ReadonlyLayout,
  ): void {
    if (!pending.responsive) {
      confirm(pending, observed)
      return
    }
    if (pending.responsive.layoutConfirmed && pending.responsive.layoutsConfirmed) {
      confirm(pending, observed)
    }
  }

  function emitMetadataAfterRollback(pending: PendingLayoutTransaction<B>): void {
    if (!pending.metadataDirty) return
    const committedLayout = cloneLayout(
      options.engine.mergeExternalMetadata(pending.expectedLayout),
    )
    options.setCommittedLayout(committedLayout)
    options.syncEngineLayout(committedLayout)
    options.emitLayoutUpdated(committedLayout, options.nextRevision(), 'external')
  }

  function timeout(pending: PendingLayoutTransaction<B>): void {
    if (pendingTransaction !== pending || options.isDisposing()) return
    options.engine.rollback(pending.evaluation)
    pendingTransaction = null
    const committedLayout = options.getCommittedLayout()
    options.syncEngineLayout(committedLayout)
    options.restoreCommittedPositionStyles()
    options.emitOperationRejected(pending.evaluation.result, 'external-not-committed', {
      revision: pending.revision,
      operation: pending.operation,
      previousLayout: pending.baseLayout,
      layout: committedLayout,
    })
    pending.settlement?.rejected('external-not-committed')

    if (pending.interaction && options.getActiveInteraction()) {
      options.finishInteraction('cancelled', 'external-not-committed', {
        revision: pending.revision,
        nativeEvent: null,
      })
    } else {
      options.interactionBuffer.clearSuperseded()
    }
    emitMetadataAfterRollback(pending)
    if (pending.responsive?.readyAfter) options.emitReadyOnce()
  }

  /** 给父组件两个 nextTick 回写窗口；到期仍未确认时按受控更新超时处理。 */
  function startDeadline(pending: PendingLayoutTransaction<B>): void {
    if (pending.deadlineStarted || options.isDisposing() || options.isSealed()) return
    pending.deadlineStarted = true
    // epoch 让已排队的 nextTick 在事务被确认、替换或销毁后自动失效。
    const epoch = ++deadlineEpoch
    nextTick(() => {
      options.runAsyncBoundary(() => {
        if (epoch !== deadlineEpoch || pendingTransaction !== pending) return
        nextTick(() => {
          options.runAsyncBoundary(() => {
            if (epoch === deadlineEpoch && pendingTransaction === pending) timeout(pending)
          })
        })
      })
    })
  }

  function supersedeNonInteraction(): void {
    const pending = pendingTransaction
    if (!pending || pending.interaction) return
    options.engine.rollback(pending.evaluation)
    pendingTransaction = null
    deadlineEpoch += 1
    options.interactionBuffer.rememberSuperseded(pending.expectedLayout)
    options.emitOperationRejected(pending.evaluation.result, 'superseded', {
      revision: pending.revision,
      operation: pending.operation,
      previousLayout: pending.baseLayout,
      layout: options.getCommittedLayout(),
    })
    pending.settlement?.rejected('superseded')
  }

  /** 创建新的唯一 pending transaction，并使之前未完成的非交互事务失效。 */
  function begin(
    evaluation: LayoutEngineEvaluation,
    operation: PendingLayoutTransaction<B>['operation'],
    source: LayoutUpdateMeta['source'],
    interaction: boolean,
    nativeEvent: Event | null = null,
    evaluatedStyles: PositionStyleMap = options.getDefaultPositionStyles(),
    responsive: PendingResponsiveTransaction<B> | null = null,
    revisionOverride: number | null = null,
    settlement: LayoutTransactionSettlement | null = null,
  ): LayoutTransactionReceipt {
    responsive ??= options.createResponsiveTransaction(evaluation.result)
    if (pendingTransaction) {
      if (interaction && pendingTransaction.interaction) {
        options.interactionBuffer.rememberSuperseded(pendingTransaction.expectedLayout)
      } else {
        supersedeNonInteraction()
      }
    }

    const result = evaluation.result
    if (result.status !== 'accepted' && !(responsive && result.status === 'unchanged')) {
      return cloneLayoutOperationResult(result) as LayoutTransactionReceipt
    }
    const revision = revisionOverride ?? options.nextRevision()
    const pending: PendingLayoutTransaction<B> = {
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
      settlement,
    }
    pendingTransaction = pending
    if (options.getActiveInteraction()) options.updateActiveInteraction(revision, nativeEvent)

    let completed = false
    try {
      // 先发出受控更新，再由 props watcher 确认；监听器抛错时必须回滚尚未公开提交的 evaluation。
      if (responsive) {
        options.emitUpdateResponsiveLayouts(responsive.expectedLayouts, revision, source)
      }
      options.emitUpdateLayout(result.layout, revision, source)
      if (interaction) options.emitInteractionChange(result, revision, nativeEvent)
      completed = true
    } finally {
      if (!completed) {
        options.engine.rollback(evaluation)
        if (pendingTransaction === pending) pendingTransaction = null
        options.clearInteractionView()
      }
    }
    if (!interaction) startDeadline(pending)
    return {
      status: 'pending',
      revision,
      proposal:
        result.status === 'accepted'
          ? (cloneLayoutOperationResult(result) as Extract<
              LayoutOperationResult,
              { status: 'accepted' }
            >)
          : {
              ...cloneLayoutOperationResult(result),
              status: 'accepted',
              reason: 'applied',
            },
    }
  }

  function abandon(pending: PendingLayoutTransaction<B>, rememberSuperseded = false): boolean {
    if (pendingTransaction !== pending) return false
    options.engine.rollback(pending.evaluation)
    pendingTransaction = null
    deadlineEpoch += 1
    if (rememberSuperseded) options.interactionBuffer.rememberSuperseded(pending.expectedLayout)
    return true
  }

  function rejectForExternalUpdate(pending: PendingLayoutTransaction<B>): boolean {
    if (!abandon(pending)) return false
    options.emitOperationRejected(pending.evaluation.result, 'external-update', {
      revision: pending.revision,
      operation: pending.operation,
      previousLayout: pending.baseLayout,
      layout: options.getCommittedLayout(),
    })
    pending.settlement?.rejected('external-update')
    return true
  }

  function disposePending(): void {
    const pending = pendingTransaction
    deadlineEpoch += 1
    if (!pending) return
    options.engine.rollback(pending.evaluation)
    pendingTransaction = null
    if (pending.operation === 'transfer') {
      options.emitOperationRejected(pending.evaluation.result, 'cancelled', {
        revision: pending.revision,
        operation: 'transfer',
        previousLayout: pending.baseLayout,
        layout: options.getCommittedLayout(),
      })
    }
    pending.settlement?.rejected('cancelled')
  }

  return {
    getPending: () => pendingTransaction,
    begin,
    mergeMetadata,
    tryConfirmResponsive,
    startDeadline,
    supersedeNonInteraction,
    abandon,
    rejectForExternalUpdate,
    invalidateDeadline: () => {
      deadlineEpoch += 1
    },
    disposePending,
  }
}
