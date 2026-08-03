/**
 * 同文档 GridLayout 之间的拖拽协调器。
 *
 * 目标网格只持有占位预览；松手后源删除与目标新增分别走受控事务，
 * 任一端拒绝时以会话开始快照补偿已经确认的变更。
 */
import { gridToPixelRect, pointerToGridPosition } from '../../core/utils'
import { cloneLayout } from '../../helpers/common'

import type {
  InternalEffectiveConfig,
  InternalLayoutCommand,
  LayoutEnginePort,
} from '../../core/layout-engine'
import type { TransferConfigSnapshot } from '../../core/validation'
import type {
  LayoutItem,
  LayoutOperationReason,
  PositionStrategy,
  ReadonlyLayout,
  ReadonlyLayoutItem,
} from '../../helpers/types'
import type { GridTransferResult, LayoutTransactionReceipt } from '../types'
import type { PositionStyleBatchResult, PositionStyleMap } from './position-style-controller'
import type { LayoutTransactionSettlement } from './transaction-controller'

interface TransferViewState<B extends string> {
  width: number | null
  lastBreakpoint: B | null
  transferPlaceholder: { x: number; y: number; w: number; h: number } | null
}

interface TransferSubmitOptions {
  source: 'transfer'
  operation: 'transfer'
  nativeEvent: Event
  settlement?: LayoutTransactionSettlement
}

interface IncomingTransferPreview<B extends string> {
  readonly item: ReadonlyLayoutItem
  readonly baseLayout: ReadonlyLayout
  readonly breakpoint: B | null
}

interface GridTransferEndpoint<B extends string> {
  readonly token: object
  getRoot(): HTMLElement | null
  getConfig(): TransferConfigSnapshot | null
  getBreakpoint(): B | null
  getCommittedLayout(): ReadonlyLayout
  preview(item: ReadonlyLayoutItem, event: Event): IncomingTransferPreview<B> | null
  clearPreview(): void
  suspendSource(): void
  finishSource(reason: 'transferred' | 'cancelled', event: Event | null): void
  submit(
    command: InternalLayoutCommand,
    options: TransferSubmitOptions,
  ): LayoutTransactionReceipt
  emitCommitted(result: GridTransferResult, event: Event): void
}

interface ActiveTransferSession {
  readonly source: GridTransferEndpoint<string>
  readonly sourceItem: ReadonlyLayoutItem
  readonly sourceLayout: ReadonlyLayout
  readonly sourceBreakpoint: string | null
  target: GridTransferEndpoint<string> | null
  preview: IncomingTransferPreview<string> | null
}

interface DocumentTransferRegistry {
  readonly document: Document
  readonly endpoints: Set<GridTransferEndpoint<string>>
  readonly commits: Set<InFlightTransfer>
  active: ActiveTransferSession | null
  listening: boolean
}

interface InFlightTransfer {
  readonly source: GridTransferEndpoint<string>
  readonly target: GridTransferEndpoint<string>
  abort(): void
}

const documentRegistries = new WeakMap<Document, DocumentTransferRegistry>()

function eventPointer(event: Event): { clientX: number; clientY: number } | null {
  const candidate = event as Event & { clientX?: unknown; clientY?: unknown }
  return typeof candidate.clientX === 'number' &&
    Number.isFinite(candidate.clientX) &&
    typeof candidate.clientY === 'number' &&
    Number.isFinite(candidate.clientY)
    ? { clientX: candidate.clientX, clientY: candidate.clientY }
    : null
}

function containsPointer(root: HTMLElement, event: Event): boolean {
  const pointer = eventPointer(event)
  if (!pointer) return false
  const rect = root.getBoundingClientRect()
  return (
    pointer.clientX >= rect.left &&
    pointer.clientX <= rect.right &&
    pointer.clientY >= rect.top &&
    pointer.clientY <= rect.bottom
  )
}

function detachRegistryListeners(registry: DocumentTransferRegistry): void {
  if (!registry.listening) return
  registry.listening = false
  registry.document.removeEventListener('keydown', handleRegistryKeydown, true)
  registry.document.removeEventListener('visibilitychange', handleRegistryVisibility)
  registry.document.defaultView?.removeEventListener('blur', handleRegistryBlur)
}

function attachRegistryListeners(registry: DocumentTransferRegistry): void {
  if (registry.listening) return
  registry.listening = true
  registry.document.addEventListener('keydown', handleRegistryKeydown, true)
  registry.document.addEventListener('visibilitychange', handleRegistryVisibility)
  registry.document.defaultView?.addEventListener('blur', handleRegistryBlur)
}

function registryFromEvent(event: Event): DocumentTransferRegistry | null {
  const document =
    event.currentTarget && (event.currentTarget as Node).nodeType === 9
      ? (event.currentTarget as Document)
      : null
  return document ? (documentRegistries.get(document) ?? null) : null
}

function handleRegistryKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  const registry = registryFromEvent(event)
  if (registry) cancelRegistrySession(registry, event)
}

function handleRegistryVisibility(event: Event): void {
  const registry = registryFromEvent(event)
  if (registry?.document.visibilityState === 'hidden') cancelRegistrySession(registry, event)
}

function handleRegistryBlur(event: Event): void {
  const view = event.currentTarget as (Window & typeof globalThis) | null
  if (!view?.document) return
  const registry = documentRegistries.get(view.document)
  if (registry) cancelRegistrySession(registry, event)
}

function clearTarget(session: ActiveTransferSession): void {
  session.target?.clearPreview()
  session.target = null
  session.preview = null
}

function cancelRegistrySession(registry: DocumentTransferRegistry, event: Event | null): void {
  const session = registry.active
  if (!session) return
  clearTarget(session)
  registry.active = null
  detachRegistryListeners(registry)
  session.source.finishSource('cancelled', event)
  if (event) {
    session.source.submit(
      { type: 'set', layout: session.sourceLayout },
      { source: 'transfer', operation: 'transfer', nativeEvent: event },
    )
  }
}

function cleanupRegistry(registry: DocumentTransferRegistry): void {
  if (registry.active || registry.endpoints.size > 0 || registry.commits.size > 0) return
  detachRegistryListeners(registry)
  documentRegistries.delete(registry.document)
}

function endpointIsBusy(
  registry: DocumentTransferRegistry,
  endpoint: GridTransferEndpoint<string>,
): boolean {
  for (const commit of registry.commits) {
    if (commit.source === endpoint || commit.target === endpoint) return true
  }
  return false
}

function createRegistry(document: Document): DocumentTransferRegistry {
  const registry: DocumentTransferRegistry = {
    document,
    endpoints: new Set(),
    commits: new Set(),
    active: null,
    listening: false,
  }
  documentRegistries.set(document, registry)
  return registry
}

function findTarget(
  registry: DocumentTransferRegistry,
  session: ActiveTransferSession,
  event: Event,
): GridTransferEndpoint<string> | null {
  const group = session.source.getConfig()?.group
  if (!group) return null
  const endpoints = Array.from(registry.endpoints)
  for (let index = endpoints.length - 1; index >= 0; index -= 1) {
    const endpoint = endpoints[index]
    if (
      endpoint === session.source ||
      endpoint.getConfig()?.group !== group ||
      endpointIsBusy(registry, endpoint)
    ) {
      continue
    }
    const root = endpoint.getRoot()
    if (root?.isConnected && containsPointer(root, event)) return endpoint
  }
  return null
}

function updateRegistrySession(registry: DocumentTransferRegistry, event: Event): boolean {
  const session = registry.active
  if (!session) return false
  const target = findTarget(registry, session, event)
  if (target !== session.target) clearTarget(session)
  if (!target) return false
  const preview = target.preview(session.sourceItem, event)
  if (!preview) {
    target.clearPreview()
    return false
  }
  session.target = target
  session.preview = preview
  session.source.suspendSource()
  return true
}

function commitRegistrySession(
  registry: DocumentTransferRegistry,
  session: ActiveTransferSession,
  event: Event,
): void {
  const target = session.target!
  const preview = session.preview!
  target.clearPreview()
  session.source.finishSource('transferred', event)

  let sourceState: 'pending' | 'committed' | 'rejected' = 'pending'
  let targetState: 'pending' | 'committed' | 'rejected' = 'pending'
  let sourceRevision = 0
  let targetRevision = 0
  let sourceLayout: ReadonlyLayout = session.sourceLayout
  let targetLayout: ReadonlyLayout = preview.baseLayout
  let sourceCompensation: 'idle' | 'pending' | 'committed' | 'rejected' = 'idle'
  let targetCompensation: 'idle' | 'pending' | 'committed' | 'rejected' = 'idle'
  let phase: 'committing' | 'compensating' = 'committing'
  let finished = false
  const commit: InFlightTransfer = {
    source: session.source,
    target,
    abort() {
      if (finished) return
      phase = 'compensating'
      settle()
    },
  }

  const finishCommit = (): void => {
    if (finished) return
    finished = true
    registry.commits.delete(commit)
    cleanupRegistry(registry)
  }

  const requestCompensation = (
    side: 'source' | 'target',
    endpoint: GridTransferEndpoint<string>,
    layout: ReadonlyLayout,
  ): void => {
    const state = side === 'source' ? sourceCompensation : targetCompensation
    if (state !== 'idle') return
    if (side === 'source') sourceCompensation = 'pending'
    else targetCompensation = 'pending'

    const receipt = endpoint.submit(
      { type: 'set', layout },
      {
        source: 'transfer',
        operation: 'transfer',
        nativeEvent: event,
        settlement: {
          committed() {
            if (side === 'source') sourceCompensation = 'committed'
            else targetCompensation = 'committed'
            settle()
          },
          rejected() {
            if (side === 'source') sourceCompensation = 'rejected'
            else targetCompensation = 'rejected'
            settle()
          },
        },
      },
    )
    if (receipt.status !== 'pending') {
      const settled = receipt.status === 'rejected' ? 'rejected' : 'committed'
      if (side === 'source') sourceCompensation = settled
      else targetCompensation = settled
    }
  }

  function settle(): void {
    if (finished) return
    if (phase === 'committing') {
      if (sourceState === 'pending' || targetState === 'pending') return
      if (sourceState === 'committed' && targetState === 'committed') {
        const committedItem = targetLayout.find(item => Object.is(item.i, preview.item.i))
        if (!committedItem) {
          phase = 'compensating'
        } else {
          const result: GridTransferResult = {
            status: 'committed',
            item: cloneLayout([committedItem])[0],
            sourceLayout: cloneLayout(sourceLayout),
            targetLayout: cloneLayout(targetLayout),
            sourceRevision,
            targetRevision,
            sourceBreakpoint: session.sourceBreakpoint,
            targetBreakpoint: preview.breakpoint,
          }
          session.source.emitCommitted(result, event)
          target.emitCommitted(result, event)
          finishCommit()
          return
        }
      } else {
        phase = 'compensating'
      }
    }

    if (sourceState === 'committed') {
      requestCompensation('source', session.source, session.sourceLayout)
    }
    if (targetState === 'committed') {
      requestCompensation('target', target, preview.baseLayout)
    }
    if (sourceState === 'pending' || targetState === 'pending') return
    if (sourceCompensation === 'pending' || targetCompensation === 'pending') return
    finishCommit()
  }
  registry.commits.add(commit)

  const sourceReceipt = session.source.submit(
    { type: 'remove', id: session.sourceItem.i },
    {
      source: 'transfer',
      operation: 'transfer',
      nativeEvent: event,
      settlement: {
        committed(layout, revision) {
          if (sourceState !== 'pending') return
          sourceState = 'committed'
          sourceLayout = cloneLayout(layout)
          sourceRevision = revision
          settle()
        },
        rejected(_reason: LayoutOperationReason) {
          if (sourceState !== 'pending') return
          sourceState = 'rejected'
          settle()
        },
      },
    },
  )
  if (sourceState === 'pending' && sourceReceipt.status !== 'pending') {
    sourceState = 'rejected'
  }

  const targetReceipt = target.submit(
    { type: 'add', item: preview.item },
    {
      source: 'transfer',
      operation: 'transfer',
      nativeEvent: event,
      settlement: {
        committed(layout, revision) {
          if (targetState !== 'pending') return
          targetState = 'committed'
          targetLayout = cloneLayout(layout)
          targetRevision = revision
          settle()
        },
        rejected(_reason: LayoutOperationReason) {
          if (targetState !== 'pending') return
          targetState = 'rejected'
          settle()
        },
      },
    },
  )
  if (targetState === 'pending' && targetReceipt.status !== 'pending') {
    targetState = 'rejected'
  }
  settle()
}

interface UseGridTransferOptions<B extends string> {
  state: TransferViewState<B>
  engine: LayoutEnginePort
  isUnavailable(): boolean
  hasActiveInteraction(): boolean
  getRoot(): HTMLElement | null
  getConfig(): TransferConfigSnapshot | null
  getEngineConfig(): InternalEffectiveConfig
  getPositionStrategy(): PositionStrategy
  getCommittedLayout(): ReadonlyLayout
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
  clearExternalDrop(): void
  updateHeight(): void
  suspendSource(): void
  finishSource(reason: 'transferred' | 'cancelled', event: Event | null): void
  submit(
    command: InternalLayoutCommand,
    options: TransferSubmitOptions,
  ): LayoutTransactionReceipt
  emitCommitted(result: GridTransferResult, event: Event): void
}

export interface UseGridTransferReturn {
  register(): void
  unregister(): void
  isBusy(): boolean
  start(id: LayoutItem['i'], event: Event): void
  move(event: Event): boolean
  end(event: Event): boolean
  cancel(event?: Event | null): void
  clearPreview(): void
}

/** 创建单个网格的跨网格端点，并接入 document 级会话。 */
export function useGridTransfer<B extends string>(
  options: UseGridTransferOptions<B>,
): UseGridTransferReturn {
  let registry: DocumentTransferRegistry | null = null
  let preview: IncomingTransferPreview<B> | null = null

  function clearPreview(): void {
    const hadPreview = preview !== null || options.state.transferPlaceholder !== null
    preview = null
    options.state.transferPlaceholder = null
    if (hadPreview) options.restorePreview()
  }

  function previewIncoming(item: ReadonlyLayoutItem, event: Event): IncomingTransferPreview<B> | null {
    clearPreview()
    if (
      options.isUnavailable() ||
      options.hasActiveInteraction() ||
      options.state.width === null ||
      options.state.width <= 0
    ) {
      return null
    }
    const root = options.getRoot()
    const pointer = eventPointer(event)
    if (!root || !pointer) return null
    const config = options.getEngineConfig()
    if (item.w > config.cols || (config.maxRows !== Infinity && item.h > config.maxRows)) return null

    let candidate: ReadonlyLayoutItem
    try {
      const geometry = {
        width: options.state.width,
        cols: config.cols,
        rowHeight: config.rowHeight,
        gap: config.gap,
        containerPadding: config.containerPadding,
        rtl: options.getDirection() === 'rtl',
        effectiveScale: options.getPositionStrategy().transformScale ?? 1,
      }
      const pixel = gridToPixelRect({ ...item, x: 0, y: 0 }, geometry)
      const rect = root.getBoundingClientRect()
      const position = pointerToGridPosition({
        clientX: pointer.clientX,
        clientY: pointer.clientY,
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
      candidate = {
        ...cloneLayout([item])[0],
        x: Math.max(0, Math.min(position.x, config.cols - item.w)),
        y:
          config.maxRows === Infinity
            ? Math.max(0, position.y)
            : Math.max(0, Math.min(position.y, config.maxRows - item.h)),
      }
    } catch {
      return null
    }

    options.clearExternalDrop()
    const baseLayout = cloneLayout(options.getCommittedLayout())
    const evaluation = options.engine.evaluate({ type: 'add', item: candidate })
    if (evaluation.result.status === 'rejected') {
      options.engine.rollback(evaluation)
      return null
    }
    const accepted = evaluation.result.layout.find(entry => Object.is(entry.i, item.i))
    if (!accepted) {
      options.engine.rollback(evaluation)
      return null
    }
    const acceptedItem = cloneLayout([accepted])[0]
    delete acceptedItem.moved
    const previewLayout = cloneLayout(
      evaluation.result.layout.filter(entry => !Object.is(entry.i, item.i)),
    )
    options.engine.rollback(evaluation)
    const styles = options.evaluatePositionStyles(
      previewLayout,
      options.getPositionStrategy(),
      options.state.width,
      config,
    )
    if (!styles.ok) return null

    preview = {
      item: acceptedItem,
      baseLayout,
      breakpoint: options.state.lastBreakpoint,
    }
    options.state.transferPlaceholder = {
      x: acceptedItem.x,
      y: acceptedItem.y,
      w: acceptedItem.w,
      h: acceptedItem.h,
    }
    options.syncPreviewLayout(previewLayout)
    options.commitPreviewStyles(styles.styles, styles.ready)
    options.updateHeight()
    return preview
  }

  const endpoint: GridTransferEndpoint<B> = {
    token: {},
    getRoot: options.getRoot,
    getConfig: options.getConfig,
    getBreakpoint: () => options.state.lastBreakpoint,
    getCommittedLayout: options.getCommittedLayout,
    preview: previewIncoming,
    clearPreview,
    suspendSource: options.suspendSource,
    finishSource: options.finishSource,
    submit: options.submit,
    emitCommitted: options.emitCommitted,
  }

  function register(): void {
    const root = options.getRoot()
    const document = root?.ownerDocument
    if (!document) return
    registry = documentRegistries.get(document) ?? createRegistry(document)
    registry.endpoints.add(endpoint as GridTransferEndpoint<string>)
  }

  function unregister(): void {
    if (!registry) return
    const active = registry.active
    if (active?.source === endpoint) cancelRegistrySession(registry, null)
    else if (active?.target === endpoint) clearTarget(active)
    for (const commit of Array.from(registry.commits)) {
      if (commit.source === endpoint || commit.target === endpoint) commit.abort()
    }
    registry.endpoints.delete(endpoint as GridTransferEndpoint<string>)
    cleanupRegistry(registry)
    registry = null
    clearPreview()
  }

  function start(id: LayoutItem['i'], event: Event): void {
    if (
      !registry ||
      !options.getConfig() ||
      options.isUnavailable() ||
      endpointIsBusy(registry, endpoint as GridTransferEndpoint<string>)
    ) {
      return
    }
    const item = options.getCommittedLayout().find(entry => Object.is(entry.i, id))
    if (!item) return
    if (registry.active) cancelRegistrySession(registry, event)
    registry.active = {
      source: endpoint as GridTransferEndpoint<string>,
      sourceItem: cloneLayout([item])[0],
      sourceLayout: cloneLayout(options.getCommittedLayout()),
      sourceBreakpoint: options.state.lastBreakpoint,
      target: null,
      preview: null,
    }
    attachRegistryListeners(registry)
  }

  function move(event: Event): boolean {
    return registry?.active?.source === endpoint ? updateRegistrySession(registry, event) : false
  }

  function end(event: Event): boolean {
    if (!registry || registry.active?.source !== endpoint) return false
    const accepted = updateRegistrySession(registry, event)
    const session = registry.active
    registry.active = null
    detachRegistryListeners(registry)
    if (!accepted || !session?.target || !session.preview) {
      clearTarget(session!)
      return false
    }
    commitRegistrySession(registry, session, event)
    return true
  }

  function cancel(event: Event | null = new Event('transfercancel')): void {
    if (registry?.active?.source === endpoint) cancelRegistrySession(registry, event)
  }

  return {
    register,
    unregister,
    isBusy: () =>
      registry
        ? endpointIsBusy(registry, endpoint as GridTransferEndpoint<string>)
        : false,
    start,
    move,
    end,
    cancel,
    clearPreview,
  }
}
