/**
 * GridLayout 的内容高度观察与受控事务适配器。
 *
 * 职责：共享一个 ResizeObserver，将内容像素高度批量换算为网格行并提交原子事务。
 * 边界：不直接修改 layout，也不拥有 GridItem 的 DOM 选择逻辑。
 * 关键约束：交互或受控事务进行中不得提交新的高度 proposal。
 */
import { nextTick } from 'vue'

import { GridLayoutValidationError } from '../../core/errors'

import type { GridLayoutRuntimeError } from '../../composables/useGridLayout'
import type {
  InternalEffectiveConfig,
  LayoutEngineEvaluation,
  LayoutEnginePort,
} from '../../core/layout-engine'
import type { GridItemRegistration } from '../../helpers/internal-types'
import type {
  LayoutItem,
  LayoutOperationReason,
  LayoutOperationResult,
  PositionStrategy,
  ReadonlyLayout,
} from '../../helpers/types'
import type { LayoutUpdateMeta } from '../types'
import type { PositionStyleBatchResult } from './position-style-controller'
import type { LayoutTransactionController } from './transaction-controller'

type AutoHeightIssue = 'missing-content-root' | 'multiple-content-roots' | 'preserve-aspect-ratio'

interface AutoHeightRecord {
  item: GridItemRegistration
  id: LayoutItem['i']
  target: HTMLElement
}

interface UseGridAutoHeightOptions<B extends string> {
  engine: LayoutEnginePort
  isUnavailable(): boolean
  isMounted(): boolean
  isResponsiveReady(): boolean
  hasActiveInteraction(): boolean
  getWidth(): number | null
  getLayout(): ReadonlyLayout
  getConfig(): InternalEffectiveConfig
  getPositionStrategy(): PositionStrategy
  getTransactionController(): LayoutTransactionController<B>
  runAsyncBoundary<T>(callback: () => T): T | undefined
  evaluatePositionStyles(
    layout: ReadonlyLayout,
    strategy: PositionStrategy,
    width: number | null,
    config: InternalEffectiveConfig,
  ): PositionStyleBatchResult
  rejectPositionStyles(
    failure: Extract<PositionStyleBatchResult, { ok: false }>,
    result: LayoutOperationResult,
    operation: 'resize',
  ): LayoutOperationResult
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
    reason?: LayoutOperationReason,
    options?: { evaluationId?: number; operation?: 'resize' },
  ): unknown
  nextEvaluationId(): number
}

export interface UseGridAutoHeightReturn {
  sync(
    item: GridItemRegistration,
    target: HTMLElement | null,
    enabled: boolean,
    issue?: AutoHeightIssue,
  ): void
  remove(item: GridItemRegistration): void
  refresh(): void
  destroy(): void
}

function finiteCssPixels(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function elementBorderBoxHeight(entry: ResizeObserverEntry): number {
  const borderBox = entry.borderBoxSize
  const size = Array.isArray(borderBox) ? borderBox[0] : borderBox
  if (size && Number.isFinite(size.blockSize)) return size.blockSize

  const target = entry.target as HTMLElement
  const contentHeight = entry.contentRect.height
  const view = target.ownerDocument.defaultView
  if (!view) return contentHeight
  const style = view.getComputedStyle(target)
  return (
    contentHeight +
    finiteCssPixels(style.paddingTop) +
    finiteCssPixels(style.paddingBottom) +
    finiteCssPixels(style.borderTopWidth) +
    finiteCssPixels(style.borderBottomWidth)
  )
}

function wrapperChromeHeight(wrapper: HTMLElement): number {
  const view = wrapper.ownerDocument.defaultView
  if (!view) return 0
  const style = view.getComputedStyle(wrapper)
  return (
    finiteCssPixels(style.paddingTop) +
    finiteCssPixels(style.paddingBottom) +
    finiteCssPixels(style.borderTopWidth) +
    finiteCssPixels(style.borderBottomWidth)
  )
}

/** 将多个内容测量合并为单个受控 layout proposal。 */
export function useGridAutoHeight<B extends string>(
  options: UseGridAutoHeightOptions<B>,
): UseGridAutoHeightReturn {
  const records = new Map<GridItemRegistration, AutoHeightRecord>()
  const targetRecords = new Map<Element, AutoHeightRecord>()
  const queuedRows = new Map<LayoutItem['i'], number>()
  const reportedIssues = new WeakMap<GridItemRegistration, string | null>()
  let observer: ResizeObserver | null = null
  let frame = 0
  let microtaskScheduled = false
  let destroyed = false

  function reportIssue(item: GridItemRegistration, issue: string, cause: unknown = issue): void {
    if (reportedIssues.get(item) === issue || options.isUnavailable()) return
    reportedIssues.set(item, issue)
    options.emitRuntimeError(
      new GridLayoutValidationError('Invalid auto-height content configuration', {
        code: 'invalid-config',
        path: `gridItem[${JSON.stringify(String(item.i))}].autoHeight`,
        cause,
      }),
      null,
      { source: 'auto-height' },
    )
  }

  function ensureObserver(item: GridItemRegistration): ResizeObserver | null {
    if (observer) return observer
    if (typeof ResizeObserver !== 'function') {
      reportIssue(item, 'resize-observer-unavailable')
      return null
    }
    observer = new ResizeObserver(entries => {
      options.runAsyncBoundary(() => {
        for (const entry of entries) {
          const record = targetRecords.get(entry.target)
          if (!record) continue
          measure(record, elementBorderBoxHeight(entry))
        }
      })
    })
    return observer
  }

  function schedule(): void {
    if (destroyed || frame || microtaskScheduled || !queuedRows.size) return
    if (typeof requestAnimationFrame === 'function') {
      frame = requestAnimationFrame(() => {
        frame = 0
        options.runAsyncBoundary(flush)
      })
      return
    }
    microtaskScheduled = true
    queueMicrotask(() => {
      microtaskScheduled = false
      options.runAsyncBoundary(flush)
    })
  }

  function measure(record: AutoHeightRecord, contentHeight: number): void {
    if (
      destroyed ||
      !Number.isFinite(contentHeight) ||
      contentHeight <= 0 ||
      !record.item.state.registered ||
      !record.item.wrapper
    ) {
      return
    }
    const config = options.getConfig()
    const pitch = config.rowHeight + config.gap[1]
    if (!Number.isFinite(pitch) || pitch <= 0) {
      reportIssue(record.item, 'zero-row-pitch', {
        reason: 'zero-row-pitch',
        rowHeight: config.rowHeight,
        gapY: config.gap[1],
      })
      return
    }
    const measuredHeight = contentHeight + wrapperChromeHeight(record.item.wrapper)
    // 一个 n 行元素的像素高度为 n * rowHeight + (n - 1) * gap，移项后向上取整。
    const rows = Math.ceil((measuredHeight + config.gap[1]) / pitch)
    if (!Number.isSafeInteger(rows) || rows <= 0) {
      reportIssue(record.item, 'height-overflow', {
        reason: 'height-overflow',
        measuredHeight,
        rows,
      })
      return
    }
    const current = options.getLayout().find(item => Object.is(item.i, record.id))
    if (!current || current.h === rows) return
    queuedRows.set(record.id, rows)
    schedule()
  }

  function retryAfterPendingTransaction(): void {
    nextTick(() => {
      if (!destroyed && queuedRows.size) schedule()
    })
  }

  function flush(): void {
    if (destroyed || options.isUnavailable() || !options.isMounted()) return
    if (!options.isResponsiveReady() || options.getWidth() === null || options.getWidth()! <= 0) {
      return
    }
    if (options.hasActiveInteraction()) return

    const transactionController = options.getTransactionController()
    if (transactionController.getPending()) {
      // 保留最新测量，等当前受控事务结束后再合并提交，避免高度更新候选抢占确认窗口。
      retryAfterPendingTransaction()
      return
    }

    const activeIds = new Set(Array.from(records.values(), record => record.id))
    const changes = Array.from(queuedRows, ([id, h]) => ({ id, h })).filter(change =>
      activeIds.has(change.id),
    )
    if (!changes.length) {
      queuedRows.clear()
      return
    }

    const evaluationId = options.nextEvaluationId()
    const evaluation = options.engine.evaluate({ type: 'auto-resize', changes })
    const result = evaluation.result
    for (const change of changes) queuedRows.delete(change.id)

    if (result.status === 'rejected') {
      options.emitEvaluationError(evaluation, null, evaluationId)
      options.emitOperationRejected(result, result.reason, { evaluationId, operation: 'resize' })
      return
    }
    if (result.status === 'unchanged') return

    const styleEvaluation = options.evaluatePositionStyles(
      result.layout,
      options.getPositionStrategy(),
      options.getWidth(),
      evaluation.nextConfig,
    )
    if (!styleEvaluation.ok) {
      options.engine.rollback(evaluation)
      options.rejectPositionStyles(styleEvaluation, result, 'resize')
      return
    }
    transactionController.begin(
      evaluation,
      'resize',
      'auto-height' satisfies LayoutUpdateMeta['source'],
      false,
      null,
      styleEvaluation.styles,
    )
  }

  function detach(item: GridItemRegistration): void {
    const previous = records.get(item)
    if (previous) {
      observer?.unobserve(previous.target)
      targetRecords.delete(previous.target)
      queuedRows.delete(previous.id)
      records.delete(item)
    }
  }

  function remove(item: GridItemRegistration): void {
    detach(item)
    reportedIssues.delete(item)
  }

  function sync(
    item: GridItemRegistration,
    target: HTMLElement | null,
    enabled: boolean,
    issue?: AutoHeightIssue,
  ): void {
    const previous = records.get(item)
    if (
      enabled &&
      !issue &&
      target &&
      previous &&
      previous.target === target &&
      Object.is(previous.id, item.i)
    ) {
      measure(previous, previous.target.getBoundingClientRect().height)
      return
    }
    detach(item)
    if (!enabled || destroyed || options.isUnavailable()) {
      reportedIssues.delete(item)
      return
    }
    if (issue || !target) {
      reportIssue(item, issue ?? 'missing-content-root')
      return
    }
    const activeObserver = ensureObserver(item)
    if (!activeObserver) return
    const record = { item, id: item.i, target }
    records.set(item, record)
    targetRecords.set(target, record)
    reportedIssues.set(item, null)
    activeObserver.observe(target, { box: 'border-box' })
  }

  function refresh(): void {
    for (const record of records.values()) {
      measure(record, record.target.getBoundingClientRect().height)
    }
  }

  function destroy(): void {
    destroyed = true
    if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame)
    frame = 0
    observer?.disconnect()
    observer = null
    records.clear()
    targetRecords.clear()
    queuedRows.clear()
  }

  return { sync, remove, refresh, destroy }
}
