/**
 * 受控 layout props 与内部布局引擎之间的同步 composable。
 *
 * 职责：观察父组件回写、接纳外部更新，并确认受控 layout transaction。
 * 边界：不生成拖入 proposal，也不处理指针手势；这些输入分别来自 drop 与 interaction composable。
 * 关键约束：props 是最终权威来源；部分 responsive 回写和 superseded 交互必须被隔离。
 */
import {
  layoutsGeometryEqual,
  layoutsSemanticallyEqual,
  mergeLayoutMetadata,
  snapshotStrictLayout,
  snapshotUnresolvedLayout,
} from '../../core/layout-engine'
import { cloneLayout } from '../../helpers/common'

import type { InternalEffectiveConfig, LayoutEnginePort } from '../../core/layout-engine'
import type {
  GridLayoutRuntimeError,
  OperationRejectedPayload,
} from '../../composables/useGridLayout'
import type {
  Layout,
  LayoutItem,
  LayoutOperationReason,
  LayoutOperationResult,
  PositionStrategy,
  ReadonlyLayout,
  ReadonlyLayoutItem,
} from '../../helpers/types'
import type { LayoutUpdateMeta } from '../types'
import type { UseGridDropReturn } from './use-drop'
import type { UseGridInteractionReturn } from './use-interaction'
import type { PositionStyleBatchResult, PositionStyleMap } from './position-style-controller'
import type {
  LayoutTransactionController,
  PendingLayoutTransaction,
} from './transaction-controller'

interface LayoutSyncViewState<B extends string> {
  width: number | null
  lastBreakpoint: B | null
  layouts: Record<B, Layout>
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

interface UseGridLayoutSyncOptions<B extends string> {
  state: LayoutSyncViewState<B>
  engine: LayoutEnginePort
  isDisposing(): boolean
  isResponsive(): boolean
  getLayout(): ReadonlyLayout
  getCurrentLayout(): ReadonlyLayout
  getCommittedLayout(): ReadonlyLayout
  setCommittedLayout(layout: ReadonlyLayout): void
  getEngineConfig(): InternalEffectiveConfig
  setEngineConfig(config: InternalEffectiveConfig): void
  getPositionStrategy(): PositionStrategy
  resolveEngineConfig(): InternalEffectiveConfig
  getTransactionController(): LayoutTransactionController<B>
  getInteraction(): UseGridInteractionReturn
  getDrop(): UseGridDropReturn
  hasSupersededInteraction(layout: ReadonlyLayout): boolean
  syncEngineLayout(layout: ReadonlyLayout): void
  evaluatePositionStyles(
    layout: ReadonlyLayout,
    strategy: PositionStrategy,
    width: number | null,
    config: InternalEffectiveConfig,
  ): PositionStyleBatchResult
  rejectPositionStyles(
    failure: Extract<PositionStyleBatchResult, { ok: false }>,
    result: LayoutOperationResult,
    operation: OperationRejectedPayload['operation'],
  ): LayoutOperationResult
  commitPositionStyles(styles: PositionStyleMap, ready: boolean): void
  syncItemEngineConfig(): void
  updateHeight(): void
  validateRegisteredItems(): void
  emitRuntimeError(
    error: unknown,
    revision: number | null,
    overrides?: Partial<GridLayoutRuntimeError>,
  ): GridLayoutRuntimeError
  emitOperationRejected(
    result: LayoutOperationResult,
    reason?: LayoutOperationReason,
    options?: OperationRejectedOptions,
  ): OperationRejectedPayload
  emitLayoutUpdated(
    layout: ReadonlyLayout,
    revision: number,
    source: LayoutUpdateMeta['source'],
  ): void
  nextEvaluationId(): number
  nextRevision(): number
}

export interface UseGridLayoutSyncReturn {
  observeLayoutProp(): void
}

/** 协调受控 layout、外部更新与 drop 提交的确认协议。 */
export function useGridLayoutSync<B extends string>(
  options: UseGridLayoutSyncOptions<B>,
): UseGridLayoutSyncReturn {
  function snapshotObservedLayout(): Layout | null {
    const transactionController = options.getTransactionController()
    const pending = transactionController.getPending()
    try {
      const config = pending?.evaluation.nextConfig ?? options.getEngineConfig()
      return options.isResponsive() && options.state.width === null
        ? snapshotUnresolvedLayout(options.getLayout(), config)
        : snapshotStrictLayout(options.getLayout(), config)
    } catch (error) {
      const interactionApi = options.getInteraction()
      const interaction = interactionApi.getActive()
      if (!interaction) {
        options.emitRuntimeError(error, pending?.revision ?? null)
        return null
      }

      const revision = interaction.latestRevision
      interactionApi.prepareForTerminal()
      const evaluationId = options.nextEvaluationId()
      options.emitRuntimeError(error, revision, { evaluationId })
      const committedLayout = options.getCommittedLayout()
      const rejected: LayoutOperationResult = {
        operation: 'set',
        id: null,
        previousLayout: cloneLayout(committedLayout),
        layout: cloneLayout(committedLayout),
        candidate: null,
        status: 'rejected',
        reason: 'invalid-input',
      }
      options.emitOperationRejected(rejected, 'invalid-input', {
        revision,
        evaluationId,
        operation: 'set',
      })
      interactionApi.finish('cancelled', 'external-update', {
        revision,
        nativeEvent: null,
      })
      return null
    }
  }

  function acceptExternalLayout(
    observed: ReadonlyLayout,
    pending: PendingLayoutTransaction<B> | null,
  ): void {
    const interactionApi = options.getInteraction()
    const interaction = interactionApi.getActive()
    const nextConfig = options.resolveEngineConfig()
    const styleEvaluation = options.evaluatePositionStyles(
      observed,
      options.getPositionStrategy(),
      options.state.width,
      nextConfig,
    )
    const transactionController = options.getTransactionController()
    if (!styleEvaluation.ok) {
      if (pending && transactionController.abandon(pending, true)) {
        pending.settlement?.rejected('external-update')
      }
      options.rejectPositionStyles(
        styleEvaluation,
        {
          operation: 'set',
          id: null,
          previousLayout: cloneLayout(options.getCommittedLayout()),
          layout: cloneLayout(observed),
          candidate: null,
          status: 'rejected',
          reason: styleEvaluation.reason,
        },
        'set',
      )
      return
    }
    if (pending && transactionController.abandon(pending, true)) {
      pending.settlement?.rejected('external-update')
    }
    const replaced = options.engine.replaceExternal(observed, nextConfig, {
      deferHorizontalBounds: options.isResponsive() && options.state.width === null,
    })
    if (replaced.status === 'rejected') return
    options.setEngineConfig(nextConfig)
    options.setCommittedLayout(replaced.layout)
    options.syncEngineLayout(replaced.layout)
    options.commitPositionStyles(styleEvaluation.styles, styleEvaluation.ready)
    options.syncItemEngineConfig()
    options.updateHeight()

    const committedLayout = options.getCommittedLayout()
    if (pending && !pending.interaction) {
      options.emitOperationRejected(pending.evaluation.result, 'external-update', {
        revision: pending.revision,
        operation: pending.operation,
        previousLayout: pending.baseLayout,
        layout: committedLayout,
      })
    }
    const externalRevision = options.nextRevision()
    if (interaction) {
      interactionApi.finish('cancelled', 'external-update', {
        revision: interaction.latestRevision,
        nativeEvent: null,
      })
    }
    options.emitLayoutUpdated(committedLayout, externalRevision, 'external')
    options.validateRegisteredItems()
  }

  /**
   * 受控 layout 的唯一观察入口。优先确认 pending transaction，
   * 其余差异才作为普通外部更新。
   */
  function observeLayoutProp(): void {
    if (options.isDisposing()) return
    const observed = snapshotObservedLayout()
    if (!observed) return
    const drop = options.getDrop()
    if (drop.hasProposal()) drop.invalidateProposal()

    const transactionController = options.getTransactionController()
    const pending = transactionController.getPending()
    if (pending && layoutsGeometryEqual(observed, pending.expectedLayout)) {
      // 几何一致即可推进事务；父组件可附加元数据，无需元数据与待确认布局完全一致。
      if (!layoutsSemanticallyEqual(observed, pending.expectedLayout)) {
        transactionController.mergeMetadata(pending, observed)
      }
      if (pending.responsive) pending.responsive.layoutConfirmed = true
      transactionController.tryConfirmResponsive(pending, observed)
      return
    }
    if (pending?.responsive) {
      if (!layoutsSemanticallyEqual(observed, options.getCommittedLayout())) {
        options.emitRuntimeError(observed, pending.revision, {
          code: 'partial-responsive-update',
          source: 'layout',
          path: 'layout',
          cause: cloneLayout(observed),
        })
      }
      return
    }
    if (options.hasSupersededInteraction(observed)) return

    const committedLayout = options.getCommittedLayout()
    if (pending) {
      if (layoutsGeometryEqual(observed, committedLayout)) {
        if (!layoutsSemanticallyEqual(observed, committedLayout)) {
          transactionController.mergeMetadata(pending, observed)
          return
        }
        if (pending.interaction) acceptExternalLayout(observed, pending)
        else transactionController.rejectForExternalUpdate(pending)
        return
      }
      acceptExternalLayout(observed, pending)
      return
    }

    if (layoutsGeometryEqual(observed, committedLayout)) {
      if (layoutsSemanticallyEqual(observed, committedLayout)) return
      const styleEvaluation = options.evaluatePositionStyles(
        observed,
        options.getPositionStrategy(),
        options.state.width,
        options.getEngineConfig(),
      )
      if (!styleEvaluation.ok) {
        options.rejectPositionStyles(
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
      const merged = options.engine.mergeExternalMetadata(observed)
      options.setCommittedLayout(merged)
      const interactionApi = options.getInteraction()
      options.syncEngineLayout(
        interactionApi.hasActive()
          ? mergeLayoutMetadata(options.getCurrentLayout(), merged)
          : merged,
      )
      if (!interactionApi.hasActive()) {
        options.commitPositionStyles(styleEvaluation.styles, styleEvaluation.ready)
        options.emitLayoutUpdated(merged, options.nextRevision(), 'external')
      }
      return
    }
    acceptExternalLayout(observed, null)
  }

  return { observeLayoutProp }
}
