/**
 * GridLayout responsive 模式与 breakpoint 布局的 composable，内部维护切换状态机。
 *
 * 职责：快照响应式配置、生成完整 layouts、切换模式，并协调 layout 与 responsiveLayouts 双重确认。
 * 边界：不监听容器宽度来源；width composable 只把解析后的宽度和切换时机交给本模块。
 * 关键约束：breakpoint 变更只有在引擎、样式和受控 props 一致后才能更新 committed responsive model。
 */
import { nextTick, toRaw } from 'vue'

import { GridLayoutExtensionError, GridLayoutValidationError } from '../../core/errors'
import { layoutsSemanticallyEqual, snapshotStrictLayout } from '../../core/layout-engine'
import { cloneLayout } from '../../helpers/common'
import {
  cloneResponsiveLayouts,
  createCompleteResponsiveLayouts,
  getBreakpointFromWidth,
  snapshotDormantResponsiveInputs,
  snapshotResponsiveConfig,
  snapshotResponsiveLayouts,
} from '../../helpers/responsive'
import {
  responsiveConfigsEqual,
  responsiveLayoutsEqual,
  responsiveModelsMatch,
  snapshotCommittedResponsiveAuthor,
} from './responsive-model'

import type { Ref, ShallowRef } from 'vue'
import type {
  InternalEffectiveConfig,
  LayoutEngineEvaluation,
  LayoutEnginePort,
} from '../../core/layout-engine'
import type { DormantResponsiveSnapshot, ResponsiveConfigSnapshot } from '../../helpers/responsive'
import type {
  Breakpoints,
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
import type {
  GridLayoutRuntimeError,
  OperationRejectedPayload,
} from '../../composables/useGridLayout'
import type { LayoutUpdateMeta } from '../types'
import type { UseGridDropReturn } from './use-drop'
import type { UseGridInteractionReturn } from './use-interaction'
import type { PositionStyleBatchResult, PositionStyleMap } from './position-style-controller'
import type { PendingResponsiveTransaction } from './responsive-model'
import type { LayoutTransactionController } from './transaction-controller'

interface ResponsiveViewState<B extends string> {
  width: number | null
  lastBreakpoint: B | null
  layouts: Record<B, Layout>
}

interface PreparedResponsiveLayout<B extends string> {
  config: ResponsiveConfigSnapshot<B>
  author: ResponsiveLayoutsInput<B>
  complete: CompleteResponsiveLayouts<B>
  breakpoint: B
  engineConfig: InternalEffectiveConfig
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

interface UseGridResponsiveOptions<B extends string> {
  mode: ShallowRef<boolean>
  spacingBreakpoint: ShallowRef<B | null>
  currentColNum: Ref<number>
  state: ResponsiveViewState<B>
  engine: LayoutEnginePort
  initialFallback: ReadonlyLayout
  getResponsiveProp(): boolean
  getBreakpoints(): Breakpoints<B>
  getCols(): Readonly<Record<B, number>>
  getResponsiveLayouts(): ResponsiveLayoutsInput<B>
  getLayout(): ReadonlyLayout
  getEffectiveColNum(): number
  getCommittedDormant(): DormantResponsiveSnapshot<B>
  setCommittedDormant(value: DormantResponsiveSnapshot<B>): void
  getCommittedConfig(): ResponsiveConfigSnapshot<B> | null
  setCommittedConfig(value: ResponsiveConfigSnapshot<B> | null): void
  getCommittedAuthor(): ResponsiveLayoutsInput<B>
  setCommittedAuthor(value: ResponsiveLayoutsInput<B>): void
  getCommittedComplete(): CompleteResponsiveLayouts<B> | null
  setCommittedComplete(value: CompleteResponsiveLayouts<B> | null): void
  getCommittedIdentity(): unknown
  setCommittedIdentity(value: unknown): void
  getCommittedLayout(): ReadonlyLayout
  getEngineConfig(): InternalEffectiveConfig
  getPositionStrategy(): PositionStrategy
  resolveEngineConfig(
    breakpoint?: B | null,
    config?: ResponsiveConfigSnapshot<B> | null,
    responsive?: boolean,
  ): InternalEffectiveConfig
  confirmEngineEvaluation(evaluation: LayoutEngineEvaluation): LayoutOperationResult
  getTransactionController(): LayoutTransactionController<B>
  getInteraction(): UseGridInteractionReturn
  getDrop(): UseGridDropReturn
  isUnavailable(): boolean
  runAsyncBoundary<T>(callback: () => T): T | undefined
  observeLayoutProp(): void
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
    options?: { initial?: boolean; deferInteractionFinish?: boolean },
  ): LayoutOperationResult
  commitPositionStyles(styles: PositionStyleMap, ready: boolean): void
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
  emitBreakpointChanged(
    breakpoint: B | null,
    layout: ReadonlyLayout,
    revision: number,
    source: LayoutUpdateMeta['source'],
  ): void
  emitLayoutUpdated(
    layout: ReadonlyLayout,
    revision: number,
    source: LayoutUpdateMeta['source'],
  ): void
  nextEvaluationId(): number
  nextRevision(): number
  syncItemEngineConfig(): void
  updateHeight(): void
  emitReadyOnce(): void
  shouldEmitReady(): boolean
}

export interface UseGridResponsiveReturn<B extends string> {
  observeInputs(): void
  observeLayoutsProp(): void
  applyLayout(
    revisionOverride?: number | null,
    readyAfter?: boolean,
    preparedOverride?: PreparedResponsiveLayout<B>,
  ): void
  applyMode(value: boolean, revisionOverride?: number | null, readyAfter?: boolean): void
  initFeatures(): void
  isTransitionFlush(): boolean
  isFailureFlush(): boolean
}

/** 管理 responsive 模式、breakpoint 快照及受控 layouts 的切换状态机。 */
export function useGridResponsive<B extends string>(
  options: UseGridResponsiveOptions<B>,
): UseGridResponsiveReturn<B> {
  let dormantErrorEpisode: Readonly<{ path: string | null; cause: unknown }> | null = null
  let transitionFlush = false
  let failureFlush = false

  function snapshotCurrentDormant(): DormantResponsiveSnapshot<B> {
    return snapshotDormantResponsiveInputs<B>(
      options.getBreakpoints(),
      options.getCols(),
      toRaw(options.getResponsiveLayouts()),
    )
  }

  function reportDormantError(error: unknown): void {
    const validation = error instanceof GridLayoutValidationError ? error : null
    const path = validation?.path ?? null
    const cause = validation?.cause ?? error
    if (dormantErrorEpisode?.path === path && Object.is(dormantErrorEpisode.cause, cause)) return
    dormantErrorEpisode = { path, cause }
    options.emitRuntimeError(error, null)
  }

  function deferModeRetry(): void {
    if (failureFlush) return
    failureFlush = true
    nextTick(() => {
      failureFlush = false
    })
  }

  function observeInputs(): void {
    if (options.isUnavailable() || transitionFlush) return
    if (!Object.is(options.getResponsiveProp(), options.mode.value)) {
      if (!failureFlush) applyMode(options.getResponsiveProp())
      return
    }
    if (!options.mode.value) {
      try {
        options.setCommittedDormant(snapshotCurrentDormant())
        dormantErrorEpisode = null
      } catch (error) {
        reportDormantError(error)
      }
      return
    }

    const pending = options.getTransactionController().getPending()
    if (pending?.responsive) {
      try {
        const observedConfig = snapshotResponsiveConfig<B>(
          options.getBreakpoints(),
          options.getCols(),
        )
        if (responsiveConfigsEqual(observedConfig, pending.responsive.config)) {
          observeLayoutsProp()
          return
        }
      } catch (error) {
        options.emitRuntimeError(error, null)
        return
      }
    }

    if (options.state.width !== null) {
      if (options.getInteraction().hasActive()) {
        options.getInteraction().cancelForConfig('config-changed')
      }
      applyLayout()
    }
  }

  function observeLayoutsProp(): void {
    if (options.isUnavailable() || !options.mode.value) return
    const pending = options.getTransactionController().getPending()
    if (!pending?.responsive) return

    let observed: ResponsiveLayoutsInput<B>
    try {
      observed = snapshotResponsiveLayouts(
        toRaw(options.getResponsiveLayouts()),
        pending.responsive.config,
        pending.evaluation.nextConfig,
      )
    } catch (error) {
      options.emitRuntimeError(error, pending.revision)
      return
    }
    if (
      !responsiveLayoutsEqual(
        observed,
        pending.responsive.expectedLayouts,
        pending.responsive.config,
      )
    ) {
      options.emitRuntimeError(observed, pending.revision, {
        code: 'partial-responsive-update',
        source: 'layout',
        path: 'layout',
        cause: cloneResponsiveLayouts(observed),
      })
      return
    }
    pending.responsive.layoutsConfirmed = true
    if (pending.responsive.layoutConfirmed) {
      options.getTransactionController().tryConfirmResponsive(pending, pending.expectedLayout)
    }
  }

  function snapshotCommittedAuthorFor(
    config: ResponsiveConfigSnapshot<B>,
    nextConfig: InternalEffectiveConfig,
  ): ResponsiveLayoutsInput<B> {
    return snapshotCommittedResponsiveAuthor({
      observedInput: toRaw(options.getResponsiveLayouts()),
      committedInputIdentity: options.getCommittedIdentity(),
      committedAuthorLayouts: options.getCommittedAuthor(),
      committedConfig: options.getCommittedConfig(),
      committedCompleteLayouts: options.getCommittedComplete(),
      config,
      engineConfig: nextConfig,
    })
  }

  function prepareLayout(
    configOverride?: ResponsiveConfigSnapshot<B>,
    authorOverride?: ResponsiveLayoutsInput<B>,
  ): PreparedResponsiveLayout<B> {
    if (options.state.width === null) {
      throw new GridLayoutValidationError('Responsive width is unresolved', {
        code: 'invalid-config',
        path: 'config.width',
        cause: null,
      })
    }
    const previousCols = options.currentColNum.value
    try {
      const config =
        configOverride ?? snapshotResponsiveConfig<B>(options.getBreakpoints(), options.getCols())
      const breakpoint = getBreakpointFromWidth(config.breakpoints, options.state.width)
      options.currentColNum.value = config.cols[breakpoint]
      const candidateConfig = options.resolveEngineConfig(breakpoint, config, true)
      const author = authorOverride ?? snapshotCommittedAuthorFor(config, candidateConfig)
      const complete = createCompleteResponsiveLayouts(
        author,
        options.initialFallback,
        config,
        candidateConfig,
        'layout',
      )
      return { config, author, complete, breakpoint, engineConfig: candidateConfig }
    } finally {
      options.currentColNum.value = previousCols
    }
  }

  /**
   * 为当前宽度准备 breakpoint layout，并进行引擎与样式预检。
   * 只有无需受控回写或双模型已匹配时才立即提交，否则创建 pending transaction。
   */
  function applyLayout(
    revisionOverride: number | null = null,
    readyAfter = false,
    preparedOverride?: PreparedResponsiveLayout<B>,
  ): void {
    if (options.state.width === null) return
    const drop = options.getDrop()
    drop.invalidateProposal()
    readyAfter ||= options.shouldEmitReady()

    let prepared: PreparedResponsiveLayout<B>
    try {
      prepared = preparedOverride ?? prepareLayout()
    } catch (error) {
      const revision = revisionOverride
      const extension = error instanceof GridLayoutExtensionError ? error : null
      const runtime = options.emitRuntimeError(error, revision, {
        ...(extension
          ? { code: extension.code, source: extension.source, path: extension.path }
          : {}),
      })
      const committedLayout = options.getCommittedLayout()
      const rejected: LayoutOperationResult = {
        operation: 'set',
        id: null,
        previousLayout: cloneLayout(committedLayout),
        layout: cloneLayout(committedLayout),
        candidate: null,
        status: 'rejected',
        reason: extension?.code ?? 'invalid-input',
      }
      options.emitOperationRejected(rejected, rejected.reason, {
        revision,
        evaluationId: runtime.evaluationId,
        operation: 'config',
      })
      if (readyAfter) options.emitReadyOnce()
      return
    }
    const { config, author, complete, breakpoint, engineConfig } = prepared
    const evaluation = options.engine.evaluate({
      type: 'set',
      layout: complete[breakpoint],
      config: engineConfig,
    })
    const result = evaluation.result
    if (result.status === 'rejected') {
      const evaluationId = options.nextEvaluationId()
      options.emitEvaluationError(evaluation, revisionOverride, evaluationId)
      options.emitOperationRejected(result, result.reason, {
        revision: revisionOverride,
        evaluationId,
        operation: 'config',
      })
      if (readyAfter) options.emitReadyOnce()
      return
    }
    const styleEvaluation = options.evaluatePositionStyles(
      result.layout,
      options.getPositionStrategy(),
      options.state.width,
      evaluation.nextConfig,
    )
    if (!styleEvaluation.ok) {
      options.engine.rollback(evaluation)
      options.rejectPositionStyles(styleEvaluation, result, 'config', { initial: readyAfter })
      if (readyAfter) options.emitReadyOnce()
      return
    }

    const revision = revisionOverride ?? options.nextRevision()
    const responsive: PendingResponsiveTransaction<B> = {
      expectedLayouts: complete,
      authorLayouts: author,
      config,
      breakpoint,
      previousBreakpoint: options.state.lastBreakpoint,
      layoutConfirmed: false,
      layoutsConfirmed: false,
      readyAfter,
    }
    const committedLayout = options.getCommittedLayout()
    if (
      options.state.lastBreakpoint === breakpoint &&
      layoutsSemanticallyEqual(result.layout, committedLayout)
    ) {
      options.getTransactionController().supersedeNonInteraction()
      const confirmed = options.confirmEngineEvaluation(evaluation)
      if (confirmed.status === 'rejected') {
        if (readyAfter) options.emitReadyOnce()
        return
      }
      options.setCommittedConfig(config)
      options.setCommittedAuthor(author)
      options.setCommittedComplete(complete)
      options.setCommittedIdentity(toRaw(options.getResponsiveLayouts()))
      options.state.layouts = cloneResponsiveLayouts(complete)
      options.currentColNum.value = options.getEngineConfig().cols
      options.commitPositionStyles(styleEvaluation.styles, styleEvaluation.ready)
      options.syncItemEngineConfig()
      options.updateHeight()
      if (readyAfter) options.emitReadyOnce()
      return
    }
    if (
      responsiveModelsMatch({
        layoutInput: options.getLayout(),
        responsiveLayoutsInput: toRaw(options.getResponsiveLayouts()),
        complete,
        breakpoint,
        config,
        engineConfig: evaluation.nextConfig,
      }) &&
      (readyAfter || options.state.lastBreakpoint === breakpoint)
    ) {
      options.getTransactionController().supersedeNonInteraction()
      const confirmed = options.confirmEngineEvaluation(evaluation)
      if (confirmed.status === 'rejected') {
        if (readyAfter) options.emitReadyOnce()
        return
      }
      options.setCommittedConfig(config)
      options.setCommittedAuthor(author)
      options.setCommittedComplete(complete)
      options.setCommittedIdentity(toRaw(options.getResponsiveLayouts()))
      options.state.layouts = cloneResponsiveLayouts(complete)
      options.state.lastBreakpoint = breakpoint
      options.spacingBreakpoint.value = breakpoint
      options.currentColNum.value = options.getEngineConfig().cols
      options.commitPositionStyles(styleEvaluation.styles, styleEvaluation.ready)
      options.syncItemEngineConfig()
      options.updateHeight()
      if (responsive.previousBreakpoint !== breakpoint) {
        options.emitBreakpointChanged(
          breakpoint,
          options.getCommittedLayout(),
          revision,
          'responsive',
        )
      }
      options.emitLayoutUpdated(options.getCommittedLayout(), revision, 'responsive')
      if (readyAfter) options.emitReadyOnce()
      return
    }

    options
      .getTransactionController()
      .begin(
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

  function initFeatures(): void {
    const complete = options.getCommittedComplete()
    options.state.layouts = complete
      ? cloneResponsiveLayouts(complete)
      : (cloneResponsiveLayouts(options.getCommittedAuthor()) as Record<B, Layout>)
  }

  /** 在 responsive 与普通模式之间切换，同时维护 dormant 配置以支持失败回退和再次启用。 */
  function applyMode(
    value: boolean,
    revisionOverride: number | null = null,
    readyAfter = false,
  ): void {
    if (Object.is(value, options.mode.value)) return

    let dormant: DormantResponsiveSnapshot<B>
    try {
      dormant = snapshotCurrentDormant()
    } catch (error) {
      reportDormantError(error)
      deferModeRetry()
      return
    }

    if (value) {
      let config: ResponsiveConfigSnapshot<B>
      let author: ResponsiveLayoutsInput<B>
      let prepared: PreparedResponsiveLayout<B> | undefined
      const previousCols = options.currentColNum.value
      try {
        config = snapshotResponsiveConfig<B>(dormant.breakpoints, dormant.cols)
        const breakpoint =
          options.state.width === null
            ? config.sorted[0]
            : getBreakpointFromWidth(config.breakpoints, options.state.width)
        options.currentColNum.value = config.cols[breakpoint]
        const candidateConfig = options.resolveEngineConfig(breakpoint, config, true)
        author = snapshotResponsiveLayouts(dormant.layouts, config, candidateConfig)
        if (options.state.width !== null) {
          const complete = createCompleteResponsiveLayouts(
            author,
            options.initialFallback,
            config,
            candidateConfig,
            'layout',
          )
          prepared = { config, author, complete, breakpoint, engineConfig: candidateConfig }
        }
      } catch (error) {
        options.emitRuntimeError(error, null)
        deferModeRetry()
        return
      } finally {
        options.currentColNum.value = previousCols
      }

      if (options.getInteraction().hasActive()) {
        options.getInteraction().cancelForConfig('config-changed')
      }
      options.getTransactionController().supersedeNonInteraction()
      transitionFlush = true
      options.mode.value = true
      options.setCommittedDormant(dormant)
      dormantErrorEpisode = null
      options.setCommittedConfig(config)
      options.setCommittedAuthor(author)
      options.setCommittedComplete(null)
      options.setCommittedIdentity(toRaw(options.getResponsiveLayouts()))
      options.state.lastBreakpoint = null
      options.spacingBreakpoint.value = null
      options.state.layouts = cloneResponsiveLayouts(author) as Record<B, Layout>
      if (options.state.width !== null) applyLayout(revisionOverride, readyAfter, prepared)
      nextTick(() => {
        transitionFlush = false
        if (options.getTransactionController().getPending()?.responsive) {
          options.runAsyncBoundary(options.observeLayoutProp)
          options.runAsyncBoundary(observeInputs)
        }
      })
      return
    }

    const previousBreakpoint = options.state.lastBreakpoint
    const previousLayout = cloneLayout(options.getCommittedLayout())
    const previousCols = options.currentColNum.value
    let nextConfig: InternalEffectiveConfig
    let observed: Layout
    let styles: PositionStyleBatchResult
    try {
      options.currentColNum.value = options.getEffectiveColNum()
      nextConfig = options.resolveEngineConfig(null, null, false)
      observed = snapshotStrictLayout(options.getLayout(), nextConfig)
      styles = options.evaluatePositionStyles(
        observed,
        options.getPositionStrategy(),
        options.state.width,
        nextConfig,
      )
      if (!styles.ok) {
        options.rejectPositionStyles(
          styles,
          {
            operation: 'set',
            id: null,
            previousLayout: cloneLayout(options.getCommittedLayout()),
            layout: observed,
            candidate: null,
            status: 'rejected',
            reason: styles.reason,
          },
          'config',
        )
        deferModeRetry()
        return
      }
    } catch (error) {
      options.emitRuntimeError(error, null)
      deferModeRetry()
      return
    } finally {
      options.currentColNum.value = previousCols
    }

    if (options.getInteraction().hasActive()) {
      options.getInteraction().cancelForConfig('config-changed')
    }
    options.getTransactionController().supersedeNonInteraction()

    try {
      const evaluation = options.engine.evaluate({
        type: 'set',
        layout: observed,
        config: nextConfig,
      })
      if (evaluation.result.status === 'rejected') {
        options.emitOperationRejected(evaluation.result, evaluation.result.reason, {
          operation: 'config',
        })
        deferModeRetry()
        return
      }
      options.confirmEngineEvaluation(evaluation)
      options.mode.value = false
      options.setCommittedDormant(dormant)
      dormantErrorEpisode = null
      options.currentColNum.value = options.getEngineConfig().cols
      options.setCommittedConfig(null)
      options.setCommittedComplete(null)
      options.setCommittedAuthor(Object.freeze(Object.create(null)) as ResponsiveLayoutsInput<B>)
      options.setCommittedIdentity(null)
      options.state.lastBreakpoint = null
      options.spacingBreakpoint.value = null
      options.state.layouts = {} as Record<B, Layout>
      options.commitPositionStyles(styles.styles, styles.ready)
      options.syncItemEngineConfig()
      options.updateHeight()
      if (previousBreakpoint !== null) {
        const revision = options.nextRevision()
        options.emitBreakpointChanged(null, options.getCommittedLayout(), revision, 'config')
        if (!layoutsSemanticallyEqual(previousLayout, options.getCommittedLayout())) {
          options.emitLayoutUpdated(options.getCommittedLayout(), revision, 'config')
        }
      }
    } catch (error) {
      options.emitRuntimeError(error, null)
      deferModeRetry()
    }
  }

  return {
    observeInputs,
    observeLayoutsProp,
    applyLayout,
    applyMode,
    initFeatures,
    isTransitionFlush: () => transitionFlush,
    isFailureFlush: () => failureFlush,
  }
}
