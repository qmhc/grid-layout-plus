/**
 * 受控 layout props 与内部布局引擎之间的同步 composable。
 *
 * 职责：观察父组件回写、接纳外部更新，并联合确认 transaction、responsive layouts 和 drop commit。
 * 边界：不生成拖入 proposal，也不处理指针手势；这些输入分别来自 drop 与 interaction composable。
 * 关键约束：props 是最终权威来源；部分 responsive 回写、过期 drop epoch 和 superseded 交互必须被隔离。
 */
import { nextTick, toRaw } from 'vue'

import {
  layoutsGeometryEqual,
  layoutsSemanticallyEqual,
  mergeLayoutMetadata,
  snapshotStrictLayout,
  snapshotUnresolvedLayout,
} from '../../core/layout-engine'
import { cloneLayout } from '../../helpers/common'
import { cloneResponsiveLayouts, snapshotResponsiveLayouts } from '../../helpers/responsive'
import { responsiveLayoutsEqual } from './responsive-model'

import type { InternalEffectiveConfig, LayoutEnginePort } from '../../core/layout-engine'
import type {
  GridLayoutRuntimeError,
  OperationRejectedPayload,
} from '../../composables/useGridLayout'
import type { ResponsiveConfigSnapshot } from '../../helpers/responsive'
import type {
  CompleteResponsiveLayouts,
  Layout,
  LayoutItem,
  LayoutOperationReason,
  LayoutOperationResult,
  PositionStrategy,
  ReadonlyLayout,
  ReadonlyLayoutItem,
  ResponsiveLayoutsInput,
} from '../../helpers/types'
import type { LayoutUpdateMeta } from '../types'
import type { DropProposalRecord, UseGridDropReturn } from './use-drop'
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
  getResponsiveLayouts(): ResponsiveLayoutsInput<B>
  getCurrentLayout(): ReadonlyLayout
  getCommittedLayout(): ReadonlyLayout
  setCommittedLayout(layout: ReadonlyLayout): void
  getEngineConfig(): InternalEffectiveConfig
  setEngineConfig(config: InternalEffectiveConfig): void
  getPositionStrategy(): PositionStrategy
  getCommittedResponsiveConfig(): ResponsiveConfigSnapshot<B> | null
  getCommittedCompleteLayouts(): CompleteResponsiveLayouts<B> | null
  setCommittedCompleteLayouts(layouts: CompleteResponsiveLayouts<B>): void
  setCommittedAuthorLayouts(layouts: ResponsiveLayoutsInput<B>): void
  setCommittedResponsiveIdentity(identity: unknown): void
  resolveEngineConfig(): InternalEffectiveConfig
  getTransactionController(): LayoutTransactionController<B>
  getInteraction(): UseGridInteractionReturn
  getDrop(): UseGridDropReturn<B>
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
  runAsyncBoundary<T>(callback: () => T): T | undefined
  observeResponsiveInputs(): void
}

export interface UseGridLayoutSyncReturn {
  observeLayoutProp(): void
  tryConfirmDropCommit(observedOverride?: ReadonlyLayout): boolean
  startDropCommitDeadline(epoch: number): void
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

  function expectedDropCommitLayout(
    observed: ReadonlyLayout,
    proposal: DropProposalRecord<B>,
  ): Layout | null {
    const { insertionIndex, candidate, previewLayout } = proposal
    if (observed.length !== previewLayout.length + 1 || insertionIndex > previewLayout.length) {
      return null
    }
    const inserted = observed[insertionIndex]
    if (!inserted || previewLayout.some(item => Object.is(item.i, inserted.i))) return null
    const expected = cloneLayout(previewLayout)
    expected.splice(insertionIndex, 0, { ...candidate, i: inserted.i })
    return layoutsSemanticallyEqual(observed, expected) ? expected : null
  }

  function responsiveDropCommitMatches(
    observed: ReadonlyLayout,
    proposal: DropProposalRecord<B>,
    config: InternalEffectiveConfig,
  ): CompleteResponsiveLayouts<B> | null {
    const breakpoint = proposal.breakpoint
    const responsiveConfig = options.getCommittedResponsiveConfig()
    const committedComplete = options.getCommittedCompleteLayouts()
    if (
      !options.isResponsive() ||
      breakpoint === null ||
      breakpoint !== options.state.lastBreakpoint ||
      !responsiveConfig ||
      !committedComplete
    ) {
      return null
    }
    const expected = cloneResponsiveLayouts(committedComplete)
    expected[breakpoint] = cloneLayout(observed)
    try {
      const responsive = snapshotResponsiveLayouts(
        toRaw(options.getResponsiveLayouts()),
        responsiveConfig,
        config,
      )
      return responsiveLayoutsEqual(responsive, expected, responsiveConfig) ? expected : null
    } catch {
      return null
    }
  }

  /**
   * 使用父组件最新回写的 layout 确认 drop commit。
   * Responsive 模式还要求当前 breakpoint 的 responsiveLayouts 同步包含插入项。
   */
  function tryConfirmDropCommit(observedOverride?: ReadonlyLayout): boolean {
    const drop = options.getDrop()
    const pending = drop.getPendingCommit()
    if (!pending || !drop.isPendingCurrent(pending)) return false
    const proposal = pending.proposal

    let observed: Layout
    let nextConfig: InternalEffectiveConfig
    try {
      nextConfig = options.resolveEngineConfig()
      observed = observedOverride
        ? cloneLayout(observedOverride)
        : snapshotStrictLayout(options.getLayout(), nextConfig)
    } catch {
      return false
    }
    const expected = expectedDropCommitLayout(observed, proposal)
    if (!expected) return false
    const responsiveLayouts = options.isResponsive()
      ? responsiveDropCommitMatches(expected, proposal, nextConfig)
      : null
    if (options.isResponsive() && !responsiveLayouts) return false

    const styleEvaluation = options.evaluatePositionStyles(
      expected,
      options.getPositionStrategy(),
      options.state.width,
      nextConfig,
    )
    if (!styleEvaluation.ok) return false
    const replaced = options.engine.replaceExternal(expected, nextConfig)
    if (replaced.status === 'rejected' || !drop.completePendingCommit(pending)) {
      return false
    }
    options.setEngineConfig(nextConfig)
    options.setCommittedLayout(expected)
    options.syncEngineLayout(expected)
    options.commitPositionStyles(styleEvaluation.styles, styleEvaluation.ready)
    const responsiveConfig = options.getCommittedResponsiveConfig()
    if (responsiveLayouts && proposal.breakpoint !== null && responsiveConfig) {
      options.setCommittedCompleteLayouts(responsiveLayouts)
      options.setCommittedAuthorLayouts(responsiveLayouts)
      options.setCommittedResponsiveIdentity(toRaw(options.getResponsiveLayouts()))
      options.state.layouts = cloneResponsiveLayouts(responsiveLayouts)
    }
    options.syncItemEngineConfig()
    options.updateHeight()
    options.emitLayoutUpdated(expected, options.nextRevision(), 'drop-commit')
    options.validateRegisteredItems()
    return true
  }

  function startDropCommitDeadline(epoch: number): void {
    const drop = options.getDrop()
    if (tryConfirmDropCommit()) return
    nextTick(() => {
      options.runAsyncBoundary(() => {
        if (!drop.isPendingEpoch(epoch)) return
        if (tryConfirmDropCommit()) return
        nextTick(() => {
          options.runAsyncBoundary(() => {
            if (!drop.isPendingEpoch(epoch)) return
            if (!tryConfirmDropCommit()) {
              const deferred = drop.takeDeferredObservations()
              if (deferred.layout) observeLayoutProp()
              if (deferred.responsiveLayouts) options.observeResponsiveInputs()
            }
          })
        })
      })
    })
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
      if (pending) transactionController.abandon(pending, true)
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
    if (pending) transactionController.abandon(pending, true)
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
   * 受控 layout 的唯一观察入口。处理顺序不能随意调整：drop 确认优先，
   * 其次是 pending transaction，最后才把差异视为普通外部更新。
   */
  function observeLayoutProp(): void {
    if (options.isDisposing()) return
    const observed = snapshotObservedLayout()
    if (!observed) return
    const drop = options.getDrop()
    if (drop.getPendingCommit()) {
      if (tryConfirmDropCommit(observed)) return
      if (options.isResponsive()) {
        drop.deferLayoutObservation()
        return
      }
      drop.invalidatePendingCommit()
    }
    if (drop.hasProposal()) drop.invalidateProposal()

    const transactionController = options.getTransactionController()
    const pending = transactionController.getPending()
    if (pending && layoutsGeometryEqual(observed, pending.expectedLayout)) {
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

  return { observeLayoutProp, tryConfirmDropCommit, startDropCommitDeadline }
}
