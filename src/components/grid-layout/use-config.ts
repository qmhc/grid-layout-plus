/**
 * GridLayout 运行时配置与 position strategy 的提交 composable。
 *
 * 职责：求值引擎配置、切换定位策略，并统一处理 position style 失败后的回滚与事件。
 * 边界：不负责计算 Vue props 的优先级；调用方需传入已经解析好的 effective config。
 * 关键约束：配置失败时必须恢复列数、回滚引擎求值，并安全结束正在进行的交互。
 */
import { toRaw } from 'vue'

import { GridLayoutValidationError } from '../../core/errors'
import { cloneLayout, getLayoutItem } from '../../helpers/common'
import { snapshotPositionStrategy } from '../../core/validation'

import type { Ref, ShallowRef } from 'vue'
import type {
  InternalEffectiveConfig,
  LayoutEngineEvaluation,
  LayoutEnginePort,
} from '../../core/layout-engine'
import type {
  LayoutItem,
  LayoutOperationReason,
  LayoutOperationResult,
  PositionStrategy,
  ReadonlyLayout,
  ReadonlyLayoutItem,
} from '../../helpers/types'
import type {
  GridLayoutRuntimeError,
  InteractionCancelReason,
  OperationRejectedPayload,
} from '../../composables/useGridLayout'
import type { UseGridInteractionReturn } from './use-interaction'
import type { PositionStyleBatchResult, PositionStyleMap } from './position-style-controller'
import type { LayoutTransactionController } from './transaction-controller'

interface ConfigViewState {
  width: number | null
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

interface UseGridConfigOptions<B extends string> {
  state: ConfigViewState
  engine: LayoutEnginePort
  currentColNum: Ref<number>
  appliedPositionStrategy: ShallowRef<PositionStrategy>
  initialPositionStrategyInput: unknown
  isDisposing(): boolean
  isResponsive(): boolean
  getEffectiveColNum(): number
  getCurrentLayout(): ReadonlyLayout
  getCommittedLayout(): ReadonlyLayout
  getEngineConfig(): InternalEffectiveConfig
  resolveEngineConfig(): InternalEffectiveConfig
  confirmEngineEvaluation(evaluation: LayoutEngineEvaluation): LayoutOperationResult
  getInteraction(): UseGridInteractionReturn
  getTransactionController(): LayoutTransactionController<B>
  invalidateDropProposal(): void
  evaluatePositionStyles(
    layout: ReadonlyLayout,
    strategy: PositionStrategy,
    width: number | null,
    config: InternalEffectiveConfig,
  ): PositionStyleBatchResult
  commitPositionStyles(styles: PositionStyleMap, ready: boolean): void
  disablePositionInteractions(): void
  nextEvaluationId(): number
  emitRuntimeError(
    error: unknown,
    revision: number | null,
    overrides?: Partial<GridLayoutRuntimeError>,
  ): GridLayoutRuntimeError
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
  syncItemEngineConfig(): void
  updateHeight(): void
}

export interface UseGridConfigReturn {
  applyEngineConfig(
    activeCancelReason?: Extract<InteractionCancelReason, 'config-changed' | 'disabled'>,
  ): LayoutOperationResult
  applyPositionStrategy(strategy: PositionStrategy): void
  rejectPositionStyles(
    failure: Extract<PositionStyleBatchResult, { ok: false }>,
    result: LayoutOperationResult,
    operation: OperationRejectedPayload['operation'],
    options?: { initial?: boolean; deferInteractionFinish?: boolean },
  ): LayoutOperationResult
}

/** 管理布局引擎配置和 position strategy 的求值、提交与失败回滚。 */
export function useGridConfig<B extends string>(
  options: UseGridConfigOptions<B>,
): UseGridConfigReturn {
  let positionStrategyInput = options.initialPositionStrategyInput

  function activeCandidate(): ReadonlyLayoutItem | null {
    const interaction = options.getInteraction().getActive()
    if (!interaction) return null
    const item = getLayoutItem(options.getCurrentLayout(), interaction.id)
    return item ? cloneLayout([item])[0]! : null
  }

  function rejectPositionStyles(
    failure: Extract<PositionStyleBatchResult, { ok: false }>,
    result: LayoutOperationResult,
    operation: OperationRejectedPayload['operation'],
    rejectOptions: { initial?: boolean; deferInteractionFinish?: boolean } = {},
  ): LayoutOperationResult {
    const interactionApi = options.getInteraction()
    const interaction = interactionApi.getActive()
    const revision = interaction?.latestRevision ?? null
    const candidate = interaction
      ? (result.candidate ?? getLayoutItem(options.getCurrentLayout(), interaction.id) ?? null)
      : result.candidate
    if (interaction) {
      if (rejectOptions.deferInteractionFinish) interactionApi.clearView()
      else interactionApi.prepareForTerminal()
    }
    options.disablePositionInteractions()
    const evaluationId = options.nextEvaluationId()
    options.emitRuntimeError(failure.cause, revision, {
      code: failure.runtimeCode,
      source: failure.source,
      path: failure.path,
      evaluationId,
      ...(failure.source === 'geometry' ? { cause: failure.cause } : {}),
    })
    const committedLayout = options.getCommittedLayout()
    const rejected: LayoutOperationResult = {
      operation: result.operation,
      id: result.id,
      previousLayout: cloneLayout(committedLayout),
      layout: cloneLayout(committedLayout),
      candidate: result.candidate,
      status: 'rejected',
      reason: failure.reason,
    }
    if (!rejectOptions.initial && (failure.source !== 'geometry' || interaction)) {
      options.emitOperationRejected(rejected, failure.reason, {
        revision,
        evaluationId,
        operation,
        id: interaction?.id ?? result.id,
        candidate,
        previousLayout: committedLayout,
        layout: committedLayout,
      })
    }
    if (interaction && !rejectOptions.deferInteractionFinish) {
      interactionApi.finish(
        'cancelled',
        failure.source === 'geometry' ? 'geometry-error' : failure.reason,
        { revision, nativeEvent: null },
      )
    }
    return rejected
  }

  /** 对新的 effective config 做可回滚求值；产生布局变化时进入受控事务等待父组件确认。 */
  function applyEngineConfig(
    activeCancelReason: Extract<
      InteractionCancelReason,
      'config-changed' | 'disabled'
    > = 'config-changed',
  ): LayoutOperationResult {
    options.invalidateDropProposal()
    const committedLayout = options.getCommittedLayout()
    if (options.isDisposing()) {
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
    options.getTransactionController().supersedeNonInteraction()
    const previousColNum = options.currentColNum.value
    try {
      if (!options.isResponsive()) options.currentColNum.value = options.getEffectiveColNum()
      const evaluation = options.engine.evaluate({
        type: 'config',
        config: options.resolveEngineConfig(),
      })
      const result = evaluation.result
      if (result.status === 'rejected') {
        options.currentColNum.value = options.getEngineConfig().cols
        const interactionApi = options.getInteraction()
        const interaction = interactionApi.getActive()
        const revision = interaction?.latestRevision ?? null
        const candidate = activeCandidate()
        if (interaction) interactionApi.prepareForTerminal()
        const evaluationId = options.nextEvaluationId()
        options.emitEvaluationError(evaluation, revision, evaluationId)
        options.emitOperationRejected(result, result.reason, {
          revision,
          evaluationId,
          operation: 'config',
          id: interaction?.id ?? null,
          candidate,
        })
        if (interaction) {
          interactionApi.finish('cancelled', 'config-changed', {
            revision,
            nativeEvent: null,
          })
        }
        return result
      }
      const styleEvaluation = options.evaluatePositionStyles(
        result.layout,
        options.appliedPositionStrategy.value,
        options.state.width,
        evaluation.nextConfig,
      )
      if (!styleEvaluation.ok) {
        options.engine.rollback(evaluation)
        options.currentColNum.value = previousColNum
        return rejectPositionStyles(styleEvaluation, result, 'config')
      }
      const interactionApi = options.getInteraction()
      if (interactionApi.hasActive()) {
        interactionApi.cancelForConfig(activeCancelReason)
      }
      if (result.status === 'accepted') {
        options
          .getTransactionController()
          .begin(evaluation, 'config', 'config', false, null, styleEvaluation.styles)
        return result
      }
      options.confirmEngineEvaluation(evaluation)
      options.currentColNum.value = options.getEngineConfig().cols
      options.commitPositionStyles(styleEvaluation.styles, styleEvaluation.ready)
      options.syncItemEngineConfig()
      options.updateHeight()
      return result
    } catch (error) {
      options.currentColNum.value = previousColNum
      const interactionApi = options.getInteraction()
      const interaction = interactionApi.getActive()
      const revision = interaction?.latestRevision ?? null
      const candidate = activeCandidate()
      if (interaction) interactionApi.prepareForTerminal()
      const evaluationId = options.nextEvaluationId()
      options.emitRuntimeError(error, revision, { evaluationId })
      const result: LayoutOperationResult = {
        operation: 'set',
        id: null,
        previousLayout: cloneLayout(committedLayout),
        layout: cloneLayout(committedLayout),
        candidate: null,
        status: 'rejected',
        reason: 'invalid-input',
      }
      options.emitOperationRejected(result, 'invalid-input', {
        revision,
        evaluationId,
        operation: 'config',
        id: interaction?.id ?? null,
        candidate,
      })
      if (interaction) {
        interactionApi.finish('cancelled', 'config-changed', {
          revision,
          nativeEvent: null,
        })
      }
      return result
    }
  }

  function rejectPositionStrategy(error: GridLayoutValidationError): void {
    const interactionApi = options.getInteraction()
    const interaction = interactionApi.getActive()
    const revision = interaction?.latestRevision ?? null
    const candidate = activeCandidate()
    if (interaction) interactionApi.prepareForTerminal()
    const evaluationId = options.nextEvaluationId()
    options.emitRuntimeError(error, revision, {
      code: 'invalid-config',
      source: 'config',
      path: error.path,
      evaluationId,
    })
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
      operation: 'config',
      id: interaction?.id ?? null,
      candidate,
    })
    if (interaction) {
      interactionApi.finish('cancelled', 'config-changed', {
        revision,
        nativeEvent: null,
      })
    }
  }

  /** 切换定位策略前先对完整 committed layout 批量求值，失败时保留旧策略与旧样式。 */
  function applyPositionStrategy(strategy: PositionStrategy): void {
    options.invalidateDropProposal()
    const rawStrategy = toRaw(strategy)
    if (Object.is(rawStrategy, positionStrategyInput)) return

    let snapshot: PositionStrategy
    try {
      snapshot = snapshotPositionStrategy(rawStrategy)
    } catch (error) {
      if (!(error instanceof GridLayoutValidationError)) throw error
      rejectPositionStrategy(error)
      return
    }

    const committedLayout = options.getCommittedLayout()
    const evaluation = options.evaluatePositionStyles(
      committedLayout,
      snapshot,
      options.state.width,
      options.getEngineConfig(),
    )
    if (!evaluation.ok) {
      rejectPositionStyles(
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
    const interactionApi = options.getInteraction()
    if (interactionApi.hasActive()) {
      interactionApi.cancelForConfig('config-changed')
    }
    positionStrategyInput = rawStrategy
    options.appliedPositionStrategy.value = snapshot
    options.commitPositionStyles(evaluation.styles, evaluation.ready)
  }

  return { applyEngineConfig, applyPositionStrategy, rejectPositionStyles }
}
