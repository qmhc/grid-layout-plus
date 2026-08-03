/**
 * GridLayout 对外命令 API 的事务 composable。
 *
 * 职责：统一处理 set、move、resize、add、remove 和 layer 命令的预检、引擎求值与事务创建。
 * 边界：不观察受控 props，也不直接确认布局；最终确认由 transaction controller 与 layout-sync composable 完成。
 * 关键约束：每个命令都在同步 counter 边界内执行，并返回可供调用方追踪的事务回执。
 */
import { cloneLayout } from '../../helpers/common'
import { cloneLayoutOperationResult } from './transaction-controller'

import type {
  InternalEffectiveConfig,
  InternalLayoutCommand,
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
import type { OperationRejectedPayload } from '../../composables/useGridLayout'
import type { LayoutTransactionReceipt } from '../types'
import type { PositionStyleBatchResult } from './position-style-controller'
import type { LayoutTransactionController } from './transaction-controller'
import type { LayoutTransactionSettlement } from './transaction-controller'

interface SubmitOptions {
  source?: 'programmatic' | 'drop-commit' | 'transfer'
  operation?: OperationRejectedPayload['operation']
  nativeEvent?: Event | null
  settlement?: LayoutTransactionSettlement | null
}

interface CommandViewState {
  width: number | null
}

interface UseGridCommandsOptions<B extends string> {
  state: CommandViewState
  engine: LayoutEnginePort
  isDisposing(): boolean
  isResponsiveReady(): boolean
  runSynchronousBoundary<T>(callback: () => T): T
  getCommittedLayout(): ReadonlyLayout
  getEngineConfig(): InternalEffectiveConfig
  getPositionStrategy(): PositionStrategy
  getTransactionController(): LayoutTransactionController<B>
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
  emitOperationRejected(
    result: LayoutOperationResult,
    reason?: LayoutOperationReason,
    options?: {
      candidate?: ReadonlyLayoutItem | null
      operation?: OperationRejectedPayload['operation']
      nativeEvent?: Event | null
    },
  ): OperationRejectedPayload
}

export interface UseGridCommandsReturn {
  submit(command: InternalLayoutCommand, submitOptions?: SubmitOptions): LayoutTransactionReceipt
  submitPrepared(
    evaluation: LayoutEngineEvaluation,
    submitOptions?: SubmitOptions,
  ): LayoutTransactionReceipt
  setLayout(layout: ReadonlyLayout): LayoutTransactionReceipt
  moveItem(id: LayoutItem['i'], x: number, y: number): LayoutTransactionReceipt
  resizeItem(id: LayoutItem['i'], w: number, h: number): LayoutTransactionReceipt
  addItem(item: ReadonlyLayoutItem): LayoutTransactionReceipt
  removeItem(id: LayoutItem['i']): LayoutTransactionReceipt
  updateItemLayer(id: LayoutItem['i'], placement: 'front' | 'back'): LayoutTransactionReceipt
  bringToFront(id: LayoutItem['i']): LayoutTransactionReceipt
  sendToBack(id: LayoutItem['i']): LayoutTransactionReceipt
}

/** 管理公开命令 API 的预检、求值和事务提交。 */
export function useGridCommands<B extends string>(
  options: UseGridCommandsOptions<B>,
): UseGridCommandsReturn {
  function commandOperation(command: InternalLayoutCommand): LayoutOperationResult['operation'] {
    if (command.type === 'config') return 'set'
    if (command.type === 'auto-resize') return 'resize'
    return command.type
  }

  function commandId(command: InternalLayoutCommand): LayoutItem['i'] | null {
    if (
      command.type === 'set' ||
      command.type === 'config' ||
      command.type === 'add' ||
      command.type === 'auto-resize'
    ) {
      return null
    }
    const id: unknown = command.id
    return (typeof id === 'string' && id.length > 0) ||
      (typeof id === 'number' && Number.isSafeInteger(id) && !Object.is(id, -0))
      ? id
      : null
  }

  function rejectUnavailable(
    operation: LayoutOperationResult['operation'],
    disposingId: LayoutItem['i'] | null,
    disabledId: LayoutItem['i'] | null,
    submitOptions: SubmitOptions,
  ): LayoutTransactionReceipt | null {
    const committedLayout = options.getCommittedLayout()
    if (options.isDisposing()) {
      const result: LayoutOperationResult = {
        operation,
        id: disposingId,
        previousLayout: cloneLayout(committedLayout),
        layout: cloneLayout(committedLayout),
        candidate: null,
        status: 'rejected',
        reason: 'cancelled',
      }
      if (submitOptions.operation === 'transfer') {
        options.emitOperationRejected(result, 'cancelled', {
          candidate: null,
          operation: 'transfer',
          nativeEvent: submitOptions.nativeEvent,
        })
      }
      submitOptions.settlement?.rejected('cancelled')
      return cloneLayoutOperationResult(result) as LayoutTransactionReceipt
    }
    if (!options.isResponsiveReady()) {
      const result: LayoutOperationResult = {
        operation,
        id: disabledId,
        previousLayout: cloneLayout(committedLayout),
        layout: cloneLayout(committedLayout),
        candidate: null,
        status: 'rejected',
        reason: 'disabled',
      }
      options.emitOperationRejected(result, 'disabled', { candidate: null })
      submitOptions.settlement?.rejected('disabled')
      return cloneLayoutOperationResult(result) as LayoutTransactionReceipt
    }
    return null
  }

  function commitEvaluation(
    evaluation: LayoutEngineEvaluation,
    submitOptions: SubmitOptions,
  ): LayoutTransactionReceipt {
    const result = evaluation.result
    if (result.status === 'rejected') {
      options.emitOperationRejected(result, undefined, {
        candidate: result.candidate,
        operation: submitOptions.operation,
        nativeEvent: submitOptions.nativeEvent,
      })
      submitOptions.settlement?.rejected(result.reason)
      return cloneLayoutOperationResult(result) as LayoutTransactionReceipt
    }
    if (result.status === 'unchanged') {
      return cloneLayoutOperationResult(result) as LayoutTransactionReceipt
    }
    const styleEvaluation = options.evaluatePositionStyles(
      result.layout,
      options.getPositionStrategy(),
      options.state.width,
      evaluation.nextConfig,
    )
    if (!styleEvaluation.ok) {
      options.engine.rollback(evaluation)
      const rejected = cloneLayoutOperationResult(
        options.rejectPositionStyles(styleEvaluation, result, result.operation),
      ) as LayoutTransactionReceipt
      submitOptions.settlement?.rejected(
        rejected.status === 'rejected' ? rejected.reason : 'extension-invalid-result',
      )
      return rejected
    }
    return options
      .getTransactionController()
      .begin(
        evaluation,
        submitOptions.operation ?? result.operation,
        submitOptions.source ?? 'programmatic',
        false,
        submitOptions.nativeEvent ?? null,
        styleEvaluation.styles,
        undefined,
        null,
        submitOptions.settlement,
      )
  }

  /** 所有公开命令共享的提交入口，保证拒绝事件、样式预检和事务回执语义一致。 */
  function submit(
    command: InternalLayoutCommand,
    submitOptions: SubmitOptions = {},
  ): LayoutTransactionReceipt {
    return options.runSynchronousBoundary(() => {
      const unavailable = rejectUnavailable(
        commandOperation(command),
        'id' in command ? command.id : null,
        commandId(command),
        submitOptions,
      )
      if (unavailable) return unavailable
      const transactionController = options.getTransactionController()
      transactionController.supersedeNonInteraction()
      const evaluation = options.engine.evaluate(command)
      return commitEvaluation(evaluation, submitOptions)
    })
  }

  /** 消费调用方已完成业务校验的求值结果，避免同一命令重复运行布局算法。 */
  function submitPrepared(
    evaluation: LayoutEngineEvaluation,
    submitOptions: SubmitOptions = {},
  ): LayoutTransactionReceipt {
    return options.runSynchronousBoundary(() => {
      const unavailable = rejectUnavailable(
        evaluation.result.operation,
        evaluation.result.id,
        evaluation.result.id,
        submitOptions,
      )
      if (unavailable) {
        options.engine.rollback(evaluation)
        return unavailable
      }
      options.getTransactionController().supersedeNonInteraction()
      return commitEvaluation(evaluation, submitOptions)
    })
  }

  const setLayout = (layout: ReadonlyLayout) => submit({ type: 'set', layout })
  const moveItem = (id: LayoutItem['i'], x: number, y: number) => submit({ type: 'move', id, x, y })
  const resizeItem = (id: LayoutItem['i'], w: number, h: number) =>
    submit({ type: 'resize', id, w, h })
  const addItem = (item: ReadonlyLayoutItem) => submit({ type: 'add', item })
  const removeItem = (id: LayoutItem['i']) => submit({ type: 'remove', id })
  const updateItemLayer = (id: LayoutItem['i'], placement: 'front' | 'back') =>
    submit({ type: 'layer', id, direction: placement })
  const bringToFront = (id: LayoutItem['i']) => updateItemLayer(id, 'front')
  const sendToBack = (id: LayoutItem['i']) => updateItemLayer(id, 'back')

  return {
    submit,
    submitPrepared,
    setLayout,
    moveItem,
    resizeItem,
    addItem,
    removeItem,
    updateItemLayer,
    bringToFront,
    sendToBack,
  }
}
