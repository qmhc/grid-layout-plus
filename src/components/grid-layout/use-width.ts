/**
 * GridLayout 容器宽度的观察与应用 composable。
 *
 * 职责：合并 ResizeObserver 更新、区分显式/观察宽度、管理首次解析，并触发样式与 responsive 重算。
 * 边界：不处理 GridItem resize 手势，也不拥有 breakpoint layouts；相关逻辑分别交给 interaction/responsive composable。
 * 关键约束：交互期间只缓存最新宽度，内部回写 state.width 时必须用 guard 避免 watcher 形成反馈循环。
 */
import { nextTick } from 'vue'

import { cloneLayout } from '../../helpers/common'
import { getBreakpointFromWidth, snapshotResponsiveConfig } from '../../helpers/responsive'

import type { Ref, ShallowRef } from 'vue'
import type { InternalEffectiveConfig } from '../../core/layout-engine'
import type { ResponsiveConfigSnapshot } from '../../helpers/responsive'
import type {
  Breakpoints,
  LayoutOperationResult,
  PositionStrategy,
  ReadonlyLayout,
} from '../../helpers/types'
import type { OperationRejectedPayload } from '../../composables/useGridLayout'
import type { WidthChangedPayload } from '../types'
import type { UseGridInteractionReturn } from './use-interaction'
import type { PositionStyleBatchResult, PositionStyleMap } from './position-style-controller'
import type { UseGridResponsiveReturn } from './use-responsive'

interface WidthViewState<B extends string> {
  width: number | null
  lastBreakpoint: B | null
}

interface UseGridWidthOptions<B extends string> {
  state: WidthViewState<B>
  mode: ShallowRef<boolean>
  currentColNum: Ref<number>
  initialWidth: number | null
  getMounted(): boolean
  isUnavailable(): boolean
  runAsyncBoundary<T>(callback: () => T): T | undefined
  getResponsiveProp(): boolean
  getBreakpoints(): Breakpoints<B>
  getCols(): Readonly<Record<B, number>>
  isExplicitWidth(): boolean
  getCommittedLayout(): ReadonlyLayout
  getEngineConfig(): InternalEffectiveConfig
  getPositionStrategy(): PositionStrategy
  resolveEngineConfig(
    breakpoint?: B | null,
    config?: ResponsiveConfigSnapshot<B> | null,
    responsive?: boolean,
  ): InternalEffectiveConfig
  getInteraction(): UseGridInteractionReturn
  getResponsive(): UseGridResponsiveReturn<B>
  invalidateDropProposal(): void
  evaluatePositionStyles(
    layout: ReadonlyLayout,
    strategy: PositionStrategy,
    width: number | null,
    config: InternalEffectiveConfig,
  ): PositionStyleBatchResult
  primePositionStyles(styles: PositionStyleMap): void
  disablePositionInteractions(): void
  commitPositionStyles(styles: PositionStyleMap, ready: boolean): void
  rejectPositionStyles(
    failure: Extract<PositionStyleBatchResult, { ok: false }>,
    result: LayoutOperationResult,
    operation: OperationRejectedPayload['operation'],
    options?: { initial?: boolean; deferInteractionFinish?: boolean },
  ): LayoutOperationResult
  emitRuntimeError(error: unknown, revision: number | null): void
  emitWidthChanged(payload: WidthChangedPayload<B>, revision: number): void
  emitUpdateWidth(width: number | null): void
  nextRevision(): number
  updateHeight(): void
  emitReadyOnce(): void
}

export interface UseGridWidthReturn {
  discardPendingObserved(): void
  schedulePendingObserved(): void
  queueObserved(value: number | null): void
  process(value: number | null, initial?: boolean, force?: boolean): void
  observeStateWidth(value: number | null): void
  primeInitialPositionStyles(): void
  isAwaitingInitialResolution(): boolean
}

/** 管理容器宽度的合并调度、初次解析及 responsive 联动。 */
export function useGridWidth<B extends string>(
  options: UseGridWidthOptions<B>,
): UseGridWidthReturn {
  let frame = 0
  let pendingObservedWidth: number | null = null
  let hasPendingObservedWidth = false
  let observedFlushQueued = false
  let awaitingInitialResolution = true
  let applyingWidth = false
  const unguardedWidth = Symbol('unguarded-width')
  let guardedWidth: number | null | symbol = unguardedWidth
  let initialStyleEvaluation: PositionStyleBatchResult | null = null

  function widthPayloadState(
    breakpoint: B | null,
    cols: number,
    config: InternalEffectiveConfig = options.getEngineConfig(),
  ): WidthChangedPayload<B>['candidate'] {
    return {
      breakpoint,
      cols,
      gap: [config.gap[0], config.gap[1]],
      containerPadding: [config.containerPadding[0], config.containerPadding[1]],
    }
  }

  function discardPendingObserved(): void {
    if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame)
    frame = 0
    pendingObservedWidth = null
    hasPendingObservedWidth = false
    observedFlushQueued = false
  }

  function schedulePendingObserved(): void {
    if (
      options.isUnavailable() ||
      options.getInteraction().hasActive() ||
      !hasPendingObservedWidth ||
      observedFlushQueued
    ) {
      return
    }

    observedFlushQueued = true
    const flush = () => {
      frame = 0
      observedFlushQueued = false
      if (
        options.isUnavailable() ||
        options.getInteraction().hasActive() ||
        !hasPendingObservedWidth
      ) {
        return
      }
      const observed = pendingObservedWidth
      pendingObservedWidth = null
      hasPendingObservedWidth = false
      options.runAsyncBoundary(() => process(observed))
    }

    if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(flush)
    else nextTick(flush)
  }

  function queueObserved(value: number | null): void {
    // 交互期间仍记录 ResizeObserver 的最新值，终态清理后只应用最后一次测量。
    pendingObservedWidth = value
    hasPendingObservedWidth = true
    schedulePendingObserved()
  }

  function writeWidth(value: number | null): void {
    // watcher 会观察同一 state；guard 用来区分内部提交与调用方主动改写。
    applyingWidth = true
    guardedWidth = value
    options.state.width = value
    applyingWidth = false
  }

  /**
   * 应用一次稳定宽度。首次解析会复用预计算样式，并把同一 revision 传给 responsive 切换，
   * 确保 width-changed、breakpoint-changed 与 layout-updated 的因果关系可追踪。
   */
  function process(value: number | null, initial = false, force = false): void {
    if (!initial && !force && Object.is(value, options.state.width)) return
    options.invalidateDropProposal()
    if (value === null) {
      if (options.getInteraction().hasActive()) {
        options.getInteraction().cancelForConfig('config-changed')
      }
      writeWidth(null)
      options.commitPositionStyles(new Map(), false)
      options.emitUpdateWidth(null)
      options.updateHeight()
      return
    }

    let candidateBreakpoint: B | null = null
    let candidateCols = options.getEngineConfig().cols
    let candidateEngineConfig = options.getEngineConfig()
    try {
      if (options.mode.value) {
        const responsiveConfig = snapshotResponsiveConfig<B>(
          options.getBreakpoints(),
          options.getCols(),
        )
        candidateBreakpoint = getBreakpointFromWidth(responsiveConfig.breakpoints, value)
        candidateCols = responsiveConfig.cols[candidateBreakpoint]
        const previousCols = options.currentColNum.value
        try {
          options.currentColNum.value = candidateCols
          candidateEngineConfig = options.resolveEngineConfig(
            candidateBreakpoint,
            responsiveConfig,
            true,
          )
        } finally {
          options.currentColNum.value = previousCols
        }
      }
    } catch (error) {
      options.emitRuntimeError(error, null)
      return
    }

    const initialResolution = awaitingInitialResolution
    awaitingInitialResolution = false
    const revision = options.nextRevision()
    const source = options.isExplicitWidth() ? 'explicit' : 'observer'
    options.emitWidthChanged(
      {
        width: value,
        state: value === 0 ? 'resolved-zero' : 'resolved',
        source,
        responsive: options.mode.value,
        candidate: widthPayloadState(candidateBreakpoint, candidateCols, candidateEngineConfig),
        committed: widthPayloadState(options.state.lastBreakpoint, options.getEngineConfig().cols),
      },
      revision,
    )

    const styleEvaluation =
      initialResolution && initialStyleEvaluation && Object.is(value, options.initialWidth)
        ? initialStyleEvaluation
        : options.evaluatePositionStyles(
            options.getCommittedLayout(),
            options.getPositionStrategy(),
            value,
            options.getEngineConfig(),
          )
    initialStyleEvaluation = null
    if (!styleEvaluation.ok) {
      if (initialResolution) options.commitPositionStyles(new Map(), false)
      options.rejectPositionStyles(
        styleEvaluation,
        {
          operation: 'set',
          id: null,
          previousLayout: cloneLayout(options.getCommittedLayout()),
          layout: cloneLayout(options.getCommittedLayout()),
          candidate: null,
          status: 'rejected',
          reason: styleEvaluation.reason,
        },
        'config',
        { initial: initialResolution },
      )
      if (!initialResolution) return
    } else {
      if (options.getInteraction().hasActive()) {
        options.getInteraction().cancelForConfig('config-changed')
      }
      options.commitPositionStyles(styleEvaluation.styles, styleEvaluation.ready)
      writeWidth(value)
    }
    options.emitUpdateWidth(value)
    options.updateHeight()

    const responsive = options.getResponsive()
    const previousResponsiveMode = options.mode.value
    if (
      !responsive.isFailureFlush() &&
      !Object.is(options.getResponsiveProp(), options.mode.value)
    ) {
      responsive.applyMode(options.getResponsiveProp(), revision, initialResolution)
    }
    const responsiveModeChanged = !Object.is(previousResponsiveMode, options.mode.value)
    if (options.mode.value && !responsiveModeChanged) {
      responsive.applyLayout(revision, initialResolution)
    }
    if (initialResolution && !options.mode.value) {
      nextTick(() => {
        nextTick(() => options.runAsyncBoundary(options.emitReadyOnce))
      })
    }
  }

  function observeStateWidth(value: number | null): void {
    if (Object.is(value, guardedWidth)) {
      guardedWidth = unguardedWidth
      return
    }
    if (options.getMounted() && !applyingWidth) {
      options.runAsyncBoundary(() => process(value, false, true))
    }
  }

  function primeInitialPositionStyles(): void {
    if (options.initialWidth === null) return
    initialStyleEvaluation = options.evaluatePositionStyles(
      options.getCommittedLayout(),
      options.getPositionStrategy(),
      options.initialWidth,
      options.getEngineConfig(),
    )
    if (initialStyleEvaluation.ok) options.primePositionStyles(initialStyleEvaluation.styles)
    else options.disablePositionInteractions()
  }

  return {
    discardPendingObserved,
    schedulePendingObserved,
    queueObserved,
    process,
    observeStateWidth,
    primeInitialPositionStyles,
    isAwaitingInitialResolution: () => awaitingInitialResolution,
  }
}
