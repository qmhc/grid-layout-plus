import { cloneLayout } from '../helpers/common'
import { noCompactor, verticalCompactor } from './compactors'
import { GridLayoutExtensionError, GridLayoutValidationError } from './errors'
import { normalizeLayout } from './normalize'
import { defineDataProperty, snapshotCompactor } from './validation'

import type {
  CollisionMode,
  Compactor,
  Layout,
  LayoutItem,
  LayoutOperationReason,
  LayoutOperationResult,
  ReadonlyLayout,
  ReadonlyLayoutItem,
  RejectedLayoutOperationResult,
} from '../helpers/types'

const KNOWN_ITEM_KEYS = new Set([
  'i',
  'x',
  'y',
  'w',
  'h',
  'minW',
  'minH',
  'maxW',
  'maxH',
  'static',
  'isDraggable',
  'isResizable',
  'autoHeight',
  'zIndex',
  'moved',
])

export interface InternalEffectiveConfig {
  readonly cols: number
  readonly rowHeight: number
  readonly gap: readonly [number, number]
  readonly containerPadding: readonly [number, number]
  readonly maxRows: number
  readonly compactor: Compactor
  readonly collisionMode: CollisionMode
  readonly isDraggable: boolean
  readonly isResizable: boolean
  readonly restoreOnDrag: boolean
  readonly bringToFrontOnInteract: boolean
}

export type InternalLayoutCommand =
  | Readonly<{
      type: 'set'
      layout: ReadonlyLayout
      config?: InternalEffectiveConfig
    }>
  | Readonly<{ type: 'move'; id: LayoutItem['i']; x: number; y: number }>
  | Readonly<{ type: 'resize'; id: LayoutItem['i']; w: number; h: number }>
  | Readonly<{
      type: 'auto-resize'
      changes: readonly Readonly<{ id: LayoutItem['i']; h: number }>[]
    }>
  | Readonly<{ type: 'add'; item: ReadonlyLayoutItem }>
  | Readonly<{ type: 'remove'; id: LayoutItem['i'] }>
  | Readonly<{ type: 'layer'; id: LayoutItem['i']; direction: 'front' | 'back' }>
  | Readonly<{ type: 'config'; config: InternalEffectiveConfig }>

export type InternalInteractionBeginCommand = Readonly<{
  type: 'drag' | 'resize'
  id: LayoutItem['i']
}>

export type InternalInteractionUpdateCommand =
  | Readonly<{ type: 'drag'; x: number; y: number; terminal?: true }>
  | Readonly<{ type: 'resize'; w: number; h: number; terminal?: true }>

export interface InternalInteractionSession {
  readonly sessionId: number
  readonly beginVersion: number
  readonly baseLayout: ReadonlyLayout
  readonly baseConfig: InternalEffectiveConfig
}

export interface InternalContainerMetrics {
  readonly rows: number
  readonly height: number
}

export interface InternalEngineFailure {
  readonly kind: 'extension' | 'geometry'
  readonly error: GridLayoutExtensionError | GridLayoutValidationError
}

export interface LayoutEngineEvaluation {
  readonly baseVersion: number
  readonly result: LayoutOperationResult
  readonly nextConfig: InternalEffectiveConfig
  readonly metrics: InternalContainerMetrics
  readonly failure: InternalEngineFailure | null
}

export interface LayoutEnginePort {
  evaluate(command: InternalLayoutCommand): LayoutEngineEvaluation
  beginInteraction(
    command: InternalInteractionBeginCommand,
  ):
    | Readonly<{ status: 'accepted'; session: InternalInteractionSession }>
    | Readonly<{ status: 'rejected'; result: RejectedLayoutOperationResult }>
  evaluateInteraction(
    session: InternalInteractionSession,
    command: InternalInteractionUpdateCommand,
  ): LayoutEngineEvaluation
  closeInteraction(session: InternalInteractionSession): void
  replaceExternal(
    layout: ReadonlyLayout,
    config: InternalEffectiveConfig,
    options?: LayoutReplacementOptions,
  ): LayoutOperationResult
  mergeExternalMetadata(layout: ReadonlyLayout): ReadonlyLayout
  confirm(evaluation: LayoutEngineEvaluation): LayoutOperationResult
  rollback(evaluation: LayoutEngineEvaluation): ReadonlyLayout
}

export interface NormalizedLayoutEngine {
  readonly engine: LayoutEnginePort
  readonly layout: ReadonlyLayout
  readonly metrics: InternalContainerMetrics
  readonly changed: boolean
}

interface LayoutReplacementOptions {
  readonly deferHorizontalBounds?: boolean
}

interface InternalLayoutEngineInitializationOptions extends LayoutReplacementOptions {
  readonly allowInitialCollisions?: boolean
}

interface EvaluationRecord {
  readonly evaluation: LayoutEngineEvaluation
  readonly nextLayout: Layout
  readonly nextConfig: InternalEffectiveConfig
  readonly changesConfig: boolean
  interactionRecord?: SessionRecord
  previousWorking?: Layout
  previousWorkingEvaluation?: LayoutEngineEvaluation | null
  previousLayerIntent?: boolean
  state: 'pending' | 'confirmed' | 'rolled-back'
  finalResult: LayoutOperationResult | null
}

interface SessionRecord {
  readonly session: InternalInteractionSession
  readonly type: 'drag' | 'resize'
  readonly id: LayoutItem['i']
  baseLayout: Layout
  latestWorking: Layout
  workingEvaluation: LayoutEngineEvaluation | null
  active: boolean
  layerIntent: boolean
}

interface OperationAttempt {
  readonly result: LayoutOperationResult
  readonly nextLayout: Layout
  readonly nextConfig: InternalEffectiveConfig
  readonly metrics: InternalContainerMetrics
  readonly failure: InternalEngineFailure | null
}

class OperationRejection {
  constructor(
    readonly reason: LayoutOperationReason,
    readonly candidate: ReadonlyLayoutItem | null = null,
    readonly failure: InternalEngineFailure | null = null,
  ) {}
}

function invalid(
  path: string,
  cause: unknown,
  code: 'invalid-layout' | 'invalid-config' = 'invalid-config',
): never {
  throw new GridLayoutValidationError(`Invalid value at ${path}`, {
    code,
    path,
    cause,
  })
}

function canonicalZero(value: number): number {
  return Object.is(value, -0) ? 0 : value
}

function validId(value: unknown): value is LayoutItem['i'] {
  return (
    (typeof value === 'string' && value.length > 0) ||
    (typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0))
  )
}

function validSafeGridValue(value: unknown, positive = false): value is number {
  return Number.isSafeInteger(value) && (positive ? (value as number) > 0 : (value as number) >= 0)
}

function safeAdd(first: number, second: number, path: string): number {
  const result = first + second
  if (!Number.isSafeInteger(result) || result < 0) invalid(path, result, 'invalid-layout')
  return result
}

function readSpacing(value: unknown, path: string): readonly [number, number] {
  if (!Array.isArray(value)) invalid(path, value)
  let lengthDescriptor: PropertyDescriptor | undefined
  let firstDescriptor: PropertyDescriptor | undefined
  let secondDescriptor: PropertyDescriptor | undefined
  try {
    const keys = Reflect.ownKeys(value)
    if (
      keys.some(key => typeof key === 'symbol' || (key !== '0' && key !== '1' && key !== 'length'))
    ) {
      invalid(path, value)
    }
    lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length')
    firstDescriptor = Reflect.getOwnPropertyDescriptor(value, '0')
    secondDescriptor = Reflect.getOwnPropertyDescriptor(value, '1')
  } catch (cause) {
    invalid(path, cause)
  }
  if (
    !lengthDescriptor ||
    !('value' in lengthDescriptor) ||
    lengthDescriptor.value !== 2 ||
    !firstDescriptor ||
    !firstDescriptor.enumerable ||
    !('value' in firstDescriptor) ||
    !secondDescriptor ||
    !secondDescriptor.enumerable ||
    !('value' in secondDescriptor)
  ) {
    invalid(path, {
      length: lengthDescriptor,
      first: firstDescriptor,
      second: secondDescriptor,
    })
  }
  const first = firstDescriptor.value
  const second = secondDescriptor.value
  if (typeof first !== 'number' || !Number.isFinite(first) || first < 0) {
    invalid(`${path}[0]`, first)
  }
  if (typeof second !== 'number' || !Number.isFinite(second) || second < 0) {
    invalid(`${path}[1]`, second)
  }
  return [canonicalZero(first), canonicalZero(second)]
}

export function snapshotEffectiveConfig(value: InternalEffectiveConfig): InternalEffectiveConfig {
  if (!Number.isSafeInteger(value.cols) || value.cols <= 0) invalid('config.cols', value.cols)
  if (value.maxRows !== Infinity && (!Number.isSafeInteger(value.maxRows) || value.maxRows <= 0)) {
    invalid('config.maxRows', value.maxRows)
  }
  if (
    typeof value.rowHeight !== 'number' ||
    !Number.isFinite(value.rowHeight) ||
    value.rowHeight < 0
  ) {
    invalid('config.rowHeight', value.rowHeight)
  }
  if (
    value.collisionMode !== 'push' &&
    value.collisionMode !== 'prevent' &&
    value.collisionMode !== 'overlap'
  ) {
    invalid('config.collisionMode', value.collisionMode)
  }
  for (const key of [
    'isDraggable',
    'isResizable',
    'restoreOnDrag',
    'bringToFrontOnInteract',
  ] as const) {
    if (typeof value[key] !== 'boolean') invalid(`config.${key}`, value[key])
  }

  return {
    cols: value.cols,
    rowHeight: canonicalZero(value.rowHeight),
    gap: readSpacing(value.gap, 'config.gap'),
    containerPadding: readSpacing(value.containerPadding, 'config.containerPadding'),
    maxRows: value.maxRows,
    compactor: snapshotCompactor(value.compactor),
    collisionMode: value.collisionMode,
    isDraggable: value.isDraggable,
    isResizable: value.isResizable,
    restoreOnDrag: value.restoreOnDrag,
    bringToFrontOnInteract: value.bringToFrontOnInteract,
  }
}

function collides(first: ReadonlyLayoutItem, second: ReadonlyLayoutItem): boolean {
  if (Object.is(first.i, second.i)) return false
  return !(
    first.x + first.w <= second.x ||
    first.x >= second.x + second.w ||
    first.y + first.h <= second.y ||
    first.y >= second.y + second.h
  )
}

function metadataEqual(first: unknown, second: unknown): boolean {
  if (Object.is(first, second)) return true
  if (Array.isArray(first) || Array.isArray(second)) {
    return (
      Array.isArray(first) &&
      Array.isArray(second) &&
      first.length === second.length &&
      first.every((value, index) => metadataEqual(value, second[index]))
    )
  }
  if (
    typeof first !== 'object' ||
    first === null ||
    typeof second !== 'object' ||
    second === null ||
    Object.getPrototypeOf(first) !== Object.getPrototypeOf(second)
  ) {
    return false
  }
  const firstRecord = first as Record<string, unknown>
  const secondRecord = second as Record<string, unknown>
  const firstKeys = Object.keys(firstRecord).sort()
  const secondKeys = Object.keys(secondRecord).sort()
  return (
    firstKeys.length === secondKeys.length &&
    firstKeys.every(
      (key, index) =>
        key === secondKeys[index] && metadataEqual(firstRecord[key], secondRecord[key]),
    )
  )
}

function effectiveItemValue(item: ReadonlyLayoutItem, key: string): unknown {
  const record = item as Readonly<Record<string, unknown>>
  if (key === 'minW' || key === 'minH') return record[key] ?? 1
  if (key === 'maxW' || key === 'maxH') return record[key] ?? Infinity
  if (key === 'static') return record[key] ?? false
  if (key === 'autoHeight') return record[key] ?? false
  if (key === 'zIndex') return record[key] ?? 0
  return record[key]
}

function itemGeometryEqual(first: ReadonlyLayoutItem, second: ReadonlyLayoutItem): boolean {
  for (const key of [
    'i',
    'x',
    'y',
    'w',
    'h',
    'minW',
    'minH',
    'maxW',
    'maxH',
    'static',
    'isDraggable',
    'isResizable',
    'autoHeight',
    'zIndex',
  ]) {
    if (!Object.is(effectiveItemValue(first, key), effectiveItemValue(second, key))) return false
  }
  return true
}

function itemMetadataEqual(first: ReadonlyLayoutItem, second: ReadonlyLayoutItem): boolean {
  const firstRecord = first as Readonly<Record<string, unknown>>
  const secondRecord = second as Readonly<Record<string, unknown>>
  const keys = new Set([
    ...Object.keys(firstRecord).filter(key => !KNOWN_ITEM_KEYS.has(key)),
    ...Object.keys(secondRecord).filter(key => !KNOWN_ITEM_KEYS.has(key)),
  ])
  for (const key of keys) {
    if (!Object.hasOwn(firstRecord, key) || !Object.hasOwn(secondRecord, key)) return false
    if (!metadataEqual(firstRecord[key], secondRecord[key])) return false
  }
  return true
}

export function layoutsGeometryEqual(first: ReadonlyLayout, second: ReadonlyLayout): boolean {
  return (
    first.length === second.length &&
    first.every((item, index) => itemGeometryEqual(item, second[index]))
  )
}

export function layoutsSemanticallyEqual(first: ReadonlyLayout, second: ReadonlyLayout): boolean {
  return (
    layoutsGeometryEqual(first, second) &&
    first.every((item, index) => itemMetadataEqual(item, second[index]))
  )
}

function configEqual(first: InternalEffectiveConfig, second: InternalEffectiveConfig): boolean {
  return (
    first.cols === second.cols &&
    first.rowHeight === second.rowHeight &&
    first.gap[0] === second.gap[0] &&
    first.gap[1] === second.gap[1] &&
    first.containerPadding[0] === second.containerPadding[0] &&
    first.containerPadding[1] === second.containerPadding[1] &&
    first.maxRows === second.maxRows &&
    first.compactor.type === second.compactor.type &&
    first.compactor.compact === second.compactor.compact &&
    first.compactor.allowOverlap === second.compactor.allowOverlap &&
    first.collisionMode === second.collisionMode &&
    first.isDraggable === second.isDraggable &&
    first.isResizable === second.isResizable &&
    first.restoreOnDrag === second.restoreOnDrag &&
    first.bringToFrontOnInteract === second.bringToFrontOnInteract
  )
}

export function calculateContainerMetrics(
  layout: ReadonlyLayout,
  config: InternalEffectiveConfig,
): InternalContainerMetrics {
  let rows = 0
  for (let index = 0; index < layout.length; index++) {
    const item = layout[index]
    const bottom = item.y + item.h
    if (!Number.isSafeInteger(bottom) || bottom < 0) {
      throw new GridLayoutValidationError('Invalid layout extent', {
        code: 'invalid-layout',
        path: `layout[${index}].y`,
        cause: { y: item.y, h: item.h },
      })
    }
    rows = Math.max(rows, bottom)
  }

  const paddingHeight = 2 * config.containerPadding[1]
  if (!Number.isFinite(paddingHeight)) invalid('config.containerPadding[1]', paddingHeight)
  if (rows === 0) return { rows, height: canonicalZero(paddingHeight) }

  const rowSpan = rows * config.rowHeight
  if (!Number.isFinite(rowSpan)) invalid('config.rowHeight', rowSpan)
  const rowsWithPadding = paddingHeight + rowSpan
  if (!Number.isFinite(rowsWithPadding)) invalid('config.rowHeight', rowsWithPadding)
  const gapSpan = (rows - 1) * config.gap[1]
  if (!Number.isFinite(gapSpan)) invalid('config.gap[1]', gapSpan)
  const height = rowsWithPadding + gapSpan
  if (!Number.isFinite(height) || height < 0) invalid('config.gap[1]', height)
  return { rows, height: canonicalZero(height) }
}

function snapshotLayout(
  input: ReadonlyLayout,
  configInput: InternalEffectiveConfig,
  deferHorizontalBounds: boolean,
  allowCollisions = false,
): Layout {
  const layout = cloneLayout(input)
  const config = snapshotEffectiveConfig(configInput)

  for (let index = 0; index < layout.length; index++) {
    const item = layout[index]
    const minW = item.minW ?? 1
    const minH = item.minH ?? 1
    const maxW = item.maxW ?? Infinity
    const maxH = item.maxH ?? Infinity
    const right = safeAdd(item.x, item.w, `layout[${index}].w`)
    const bottom = safeAdd(item.y, item.h, `layout[${index}].y`)
    if (
      (!deferHorizontalBounds && minW > config.cols) ||
      item.w < minW ||
      item.w > maxW ||
      (!deferHorizontalBounds && right > config.cols)
    ) {
      invalid(`layout[${index}].w`, item.w, 'invalid-layout')
    }
    if (
      (config.maxRows !== Infinity && minH > config.maxRows) ||
      item.h < minH ||
      item.h > maxH ||
      (config.maxRows !== Infinity && bottom > config.maxRows)
    ) {
      invalid(`layout[${index}].h`, item.h, 'invalid-layout')
    }
  }

  if (!allowCollisions && config.collisionMode !== 'overlap') {
    for (let index = 0; index < layout.length; index++) {
      for (let otherIndex = 0; otherIndex < index; otherIndex++) {
        if (collides(layout[index], layout[otherIndex])) {
          invalid(`layout[${index}]`, layout[index], 'invalid-layout')
        }
      }
    }
  }
  calculateContainerMetrics(layout, config)
  return layout
}

export function snapshotStrictLayout(
  input: ReadonlyLayout,
  configInput: InternalEffectiveConfig,
): Layout {
  return snapshotLayout(input, configInput, false)
}

export function snapshotUnresolvedLayout(
  input: ReadonlyLayout,
  configInput: InternalEffectiveConfig,
): Layout {
  return snapshotLayout(input, configInput, true)
}

function cloneItem(item: ReadonlyLayoutItem): LayoutItem {
  return cloneLayout([item])[0]
}

function materializeResult(
  status: 'accepted' | 'unchanged' | 'rejected',
  reason: 'applied' | 'same-value' | LayoutOperationReason,
  operation: LayoutOperationResult['operation'],
  id: LayoutItem['i'] | null,
  previousInput: ReadonlyLayout,
  layoutInput: ReadonlyLayout,
  candidateInput: ReadonlyLayoutItem | null,
): LayoutOperationResult {
  const previousLayout = cloneLayout(previousInput)
  const layout = cloneLayout(layoutInput)
  let candidate: ReadonlyLayoutItem | null = null

  if (candidateInput && id !== null) {
    if (operation === 'remove') {
      candidate = previousLayout.find(item => Object.is(item.i, id)) ?? cloneItem(candidateInput)
    } else {
      const layoutCandidate = layout.find(item => Object.is(item.i, id))
      candidate =
        layoutCandidate &&
        itemGeometryEqual(layoutCandidate, candidateInput) &&
        itemMetadataEqual(layoutCandidate, candidateInput)
          ? layoutCandidate
          : cloneItem(candidateInput)
    }
  }

  if (status === 'accepted') {
    return { operation, id, previousLayout, layout, candidate, status, reason: 'applied' }
  }
  if (status === 'unchanged') {
    return { operation, id, previousLayout, layout, candidate, status, reason: 'same-value' }
  }
  return {
    operation,
    id,
    previousLayout,
    layout,
    candidate,
    status,
    reason: reason as LayoutOperationReason,
  }
}

function rejectedResult(
  operation: LayoutOperationResult['operation'],
  id: LayoutItem['i'] | null,
  layout: ReadonlyLayout,
  reason: LayoutOperationReason,
  candidate: ReadonlyLayoutItem | null = null,
): RejectedLayoutOperationResult {
  return materializeResult(
    'rejected',
    reason,
    operation,
    id,
    layout,
    layout,
    candidate,
  ) as RejectedLayoutOperationResult
}

function normalizeCandidate(
  item: LayoutItem,
  index: number,
  config: InternalEffectiveConfig,
): LayoutItem {
  const minW = item.minW ?? 1
  const minH = item.minH ?? 1
  const maxW = item.maxW ?? Infinity
  const maxH = item.maxH ?? Infinity
  if (minW > config.cols) throw new OperationRejection('out-of-bounds', item)
  if (config.maxRows !== Infinity && minH > config.maxRows) {
    throw new OperationRejection('max-rows', item)
  }
  try {
    safeAdd(item.x, item.w, `layout[${index}].w`)
  } catch {
    throw new OperationRejection('invalid-input', item)
  }
  try {
    safeAdd(item.y, item.h, 'layoutItem.y')
  } catch (error) {
    if (error instanceof GridLayoutValidationError) {
      throw new OperationRejection('invalid-input', item, {
        kind: 'geometry',
        error,
      })
    }
    throw error
  }

  item.w = Math.min(Math.max(item.w, minW), maxW, config.cols)
  item.h = Math.min(Math.max(item.h, minH), maxH, config.maxRows)
  item.x = Math.min(Math.max(canonicalZero(item.x), 0), config.cols - item.w)
  item.y =
    config.maxRows === Infinity
      ? Math.max(canonicalZero(item.y), 0)
      : Math.min(Math.max(canonicalZero(item.y), 0), config.maxRows - item.h)
  safeAdd(item.x, item.w, `layout[${index}].w`)
  try {
    safeAdd(item.y, item.h, 'layoutItem.y')
  } catch (error) {
    if (error instanceof GridLayoutValidationError) {
      throw new OperationRejection('invalid-input', item, {
        kind: 'geometry',
        error,
      })
    }
    throw error
  }
  return item
}

function axisSort(
  layout: readonly LayoutItem[],
  config: InternalEffectiveConfig,
  indexes: ReadonlyMap<LayoutItem['i'], number>,
): LayoutItem[] {
  const direction = config.compactor.type ?? 'vertical'
  return Array.from(layout).sort((first, second) => {
    const order =
      direction === 'horizontal'
        ? first.x - second.x || first.y - second.y
        : first.y - second.y || first.x - second.x
    return order || indexes.get(first.i)! - indexes.get(second.i)!
  })
}

function assertPlacement(item: LayoutItem, config: InternalEffectiveConfig): void {
  const right = safeAdd(item.x, item.w, 'layoutItem.x')
  const bottom = safeAdd(item.y, item.h, 'layoutItem.y')
  if (right > config.cols) throw new OperationRejection('out-of-bounds', item)
  if (config.maxRows !== Infinity && bottom > config.maxRows) {
    throw new OperationRejection('max-rows', item)
  }
}

function propagateActive(
  layout: Layout,
  activeId: LayoutItem['i'],
  config: InternalEffectiveConfig,
): Layout {
  const indexes = new Map(layout.map((item, index) => [item.i, index]))
  const active = layout.find(item => Object.is(item.i, activeId))!
  const queue: LayoutItem[] = [active]
  const queued = new Set<LayoutItem['i']>([active.i])

  while (queue.length) {
    const moving = queue.shift()!
    queued.delete(moving.i)
    let collision = axisSort(
      layout.filter(item => !Object.is(item.i, moving.i) && collides(item, moving)),
      config,
      indexes,
    )[0]

    while (collision) {
      if (collision.static) {
        if ((config.compactor.type ?? 'vertical') === 'horizontal') {
          moving.x = safeAdd(collision.x, collision.w, 'layoutItem.x')
        } else {
          moving.y = safeAdd(collision.y, collision.h, 'layoutItem.y')
        }
        assertPlacement(moving, config)
      } else {
        if ((config.compactor.type ?? 'vertical') === 'horizontal') {
          collision.x = safeAdd(moving.x, moving.w, 'layoutItem.x')
        } else {
          collision.y = safeAdd(moving.y, moving.h, 'layoutItem.y')
        }
        assertPlacement(collision, config)
        if (!queued.has(collision.i)) {
          queue.push(collision)
          queued.add(collision.i)
        }
      }
      collision = axisSort(
        layout.filter(item => !Object.is(item.i, moving.i) && collides(item, moving)),
        config,
        indexes,
      )[0]
    }
  }
  return layout
}

function hasCollision(layout: ReadonlyLayout): boolean {
  return layout.some((item, index) => layout.slice(0, index).some(other => collides(item, other)))
}

function hasStaticCollision(layout: ReadonlyLayout): boolean {
  const statics = layout.filter(item => item.static)
  return statics.some((item, index) => statics.slice(0, index).some(other => collides(item, other)))
}

function normalizeFullLayout(layout: ReadonlyLayout, config: InternalEffectiveConfig): Layout {
  let validated: Layout
  try {
    validated = cloneLayout(layout)
    validated.forEach((item, index) => {
      safeAdd(item.x, item.w, `layout[${index}].w`)
      try {
        safeAdd(item.y, item.h, `layout[${index}].y`)
      } catch (error) {
        if (error instanceof GridLayoutValidationError) {
          throw new OperationRejection('invalid-input', item, {
            kind: 'geometry',
            error,
          })
        }
        throw error
      }
    })
  } catch (error) {
    if (error instanceof OperationRejection) throw error
    throw new OperationRejection('invalid-input')
  }

  if (config.collisionMode === 'prevent' && hasCollision(validated)) {
    throw new OperationRejection('collision')
  }
  if (config.collisionMode === 'push' && hasStaticCollision(validated)) {
    throw new OperationRejection('collision')
  }
  try {
    return normalizeLayout(validated, {
      cols: config.cols,
      maxRows: config.maxRows,
      collisionMode: config.collisionMode,
      compactor:
        config.compactor.compact === noCompactor.compact &&
        (config.compactor.type ?? 'vertical') === 'vertical'
          ? noCompactor
          : config.compactor,
    })
  } catch (error) {
    if (error instanceof GridLayoutExtensionError) {
      throw new OperationRejection(error.code, null, { kind: 'extension', error })
    }
    if (error instanceof GridLayoutValidationError) {
      const direction = config.compactor.type ?? 'vertical'
      const path = error.path ?? ''
      const reason: LayoutOperationReason =
        error.code === 'invalid-config'
          ? 'invalid-input'
          : path.endsWith('.minW')
            ? 'out-of-bounds'
            : path.endsWith('.minH')
              ? 'max-rows'
              : /\]\.(x|y|w|h)$/.test(path)
                ? 'invalid-input'
                : direction === 'horizontal'
                  ? 'out-of-bounds'
                  : 'max-rows'
      throw new OperationRejection(reason)
    }
    throw error
  }
}

function isVisuallyFront(layout: ReadonlyLayout, id: LayoutItem['i']): boolean {
  const sorted = layout
    .map((item, index) => ({ item, index }))
    .sort(
      (first, second) =>
        (first.item.zIndex ?? 0) - (second.item.zIndex ?? 0) || first.index - second.index,
    )
  return Object.is(sorted.at(-1)?.item.i, id)
}

function applyLayer(
  layout: Layout,
  id: LayoutItem['i'],
  direction: 'front' | 'back',
  skipWhenAlreadyFront = false,
): LayoutItem {
  const target = layout.find(item => Object.is(item.i, id))!
  if (skipWhenAlreadyFront && direction === 'front' && isVisuallyFront(layout, id)) return target
  let max = Math.max(...layout.map(item => item.zIndex ?? 0))
  let min = Math.min(...layout.map(item => item.zIndex ?? 0))

  if (
    (direction === 'front' && max === Number.MAX_SAFE_INTEGER) ||
    (direction === 'back' && min === Number.MIN_SAFE_INTEGER)
  ) {
    const ordered = layout
      .map((item, index) => ({ item, index }))
      .sort(
        (first, second) =>
          (first.item.zIndex ?? 0) - (second.item.zIndex ?? 0) || first.index - second.index,
      )
    ordered.forEach((entry, index) => {
      entry.item.zIndex = index
    })
    max = layout.length - 1
    min = 0
  }
  target.zIndex = direction === 'front' ? max + 1 : min - 1
  return target
}

/** 终态重算仍以原始几何为准，但必须保留交互中已消费的完整层级结果。 */
function mergeInteractionLayerState(
  baseInput: ReadonlyLayout,
  workingInput: ReadonlyLayout,
): Layout {
  const base = cloneLayout(baseInput)
  const workingById = new Map(workingInput.map(item => [item.i, item]))

  for (const item of base) {
    const working = workingById.get(item.i)
    if (!working) continue
    if (Object.hasOwn(working, 'zIndex')) item.zIndex = working.zIndex
    else delete item.zIndex
  }
  return base
}

function operationFor(command: InternalLayoutCommand): LayoutOperationResult['operation'] {
  if (command.type === 'config') return 'set'
  if (command.type === 'auto-resize') return 'resize'
  return command.type
}

function idFor(command: InternalLayoutCommand): LayoutItem['i'] | null {
  if (
    command.type === 'set' ||
    command.type === 'config' ||
    command.type === 'add' ||
    command.type === 'auto-resize'
  ) {
    return null
  }
  return validId(command.id) ? command.id : null
}

function itemIdFromInput(item: ReadonlyLayoutItem): LayoutItem['i'] | null {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(item, 'i')
    return descriptor && 'value' in descriptor && validId(descriptor.value)
      ? descriptor.value
      : null
  } catch {
    return null
  }
}

function evaluateCommandLayout(
  algorithmBase: ReadonlyLayout,
  publicPrevious: ReadonlyLayout,
  currentConfig: InternalEffectiveConfig,
  command: InternalLayoutCommand,
  compareLayout: ReadonlyLayout = publicPrevious,
  interactionLayerIntent = false,
  interactionUpdate = false,
): OperationAttempt {
  const operation = operationFor(command)
  let id = idFor(command)
  let candidate: LayoutItem | null = null
  let preservesBaseGeometry = false
  let nextConfig = currentConfig

  try {
    let nextLayout: Layout
    if (command.type === 'config') {
      nextConfig = snapshotEffectiveConfig(command.config)
      const onlyModeToOverlap =
        currentConfig.collisionMode !== 'overlap' && nextConfig.collisionMode === 'overlap'
      const modeToPrevent =
        currentConfig.collisionMode === 'overlap' && nextConfig.collisionMode === 'prevent'
      const boundsChanged =
        currentConfig.cols !== nextConfig.cols || currentConfig.maxRows !== nextConfig.maxRows
      const compactorChanged =
        currentConfig.compactor.type !== nextConfig.compactor.type ||
        currentConfig.compactor.compact !== nextConfig.compactor.compact
      const layoutAffecting =
        boundsChanged ||
        (nextConfig.collisionMode === 'push' && compactorChanged) ||
        (currentConfig.collisionMode === 'overlap' && nextConfig.collisionMode === 'push')

      if (onlyModeToOverlap && !layoutAffecting) {
        nextLayout = cloneLayout(algorithmBase)
      } else if (modeToPrevent && !layoutAffecting) {
        if (hasCollision(algorithmBase)) throw new OperationRejection('collision')
        nextLayout = cloneLayout(algorithmBase)
      } else if (layoutAffecting) {
        nextLayout = normalizeFullLayout(algorithmBase, nextConfig)
      } else {
        nextLayout = cloneLayout(algorithmBase)
      }
    } else if (command.type === 'set') {
      nextConfig = command.config ? snapshotEffectiveConfig(command.config) : currentConfig
      nextLayout = normalizeFullLayout(command.layout, nextConfig)
    } else if (command.type === 'auto-resize') {
      const base = cloneLayout(algorithmBase)
      const changedIds = new Set<LayoutItem['i']>()

      for (const change of command.changes) {
        if (
          !validId(change.id) ||
          !validSafeGridValue(change.h, true) ||
          changedIds.has(change.id)
        ) {
          throw new OperationRejection('invalid-input')
        }
        changedIds.add(change.id)
        const index = base.findIndex(item => Object.is(item.i, change.id))
        if (index < 0) throw new OperationRejection('item-not-found')
        const target = base[index]
        target.h =
          currentConfig.maxRows === Infinity
            ? change.h
            : Math.min(change.h, currentConfig.maxRows - target.y)
        normalizeCandidate(target, index, currentConfig)
      }

      nextLayout =
        currentConfig.collisionMode === 'overlap'
          ? base
          : normalizeFullLayout(base, currentConfig)
    } else if (command.type === 'remove') {
      if (!validId(command.id)) throw new OperationRejection('invalid-input')
      id = command.id
      const base = cloneLayout(algorithmBase)
      const index = base.findIndex(item => Object.is(item.i, id))
      if (index < 0) throw new OperationRejection('item-not-found')
      candidate = cloneItem(base[index])
      base.splice(index, 1)
      nextLayout =
        currentConfig.collisionMode === 'push' ? normalizeFullLayout(base, currentConfig) : base
    } else if (command.type === 'layer') {
      if (!validId(command.id)) throw new OperationRejection('invalid-input')
      id = command.id
      const base = cloneLayout(algorithmBase)
      const target = base.find(item => Object.is(item.i, id))
      if (!target) throw new OperationRejection('item-not-found')
      if (currentConfig.collisionMode !== 'overlap') {
        throw new OperationRejection('disabled', target)
      }
      candidate = applyLayer(base, id, command.direction)
      nextLayout = base
    } else {
      const base = cloneLayout(algorithmBase)
      if (command.type === 'add') {
        id = itemIdFromInput(command.item)
        const inputItem = cloneItem(command.item)
        if (base.some(item => Object.is(item.i, inputItem.i))) {
          throw new OperationRejection('invalid-input')
        }
        id = inputItem.i
        base.push(inputItem)
        candidate = normalizeCandidate(inputItem, base.length - 1, currentConfig)
      } else {
        if (!validId(command.id)) throw new OperationRejection('invalid-input')
        id = command.id
        const index = base.findIndex(item => Object.is(item.i, id))
        if (index < 0) throw new OperationRejection('item-not-found')
        const target = base[index]
        if (target.static) throw new OperationRejection('static-item', target)

        if (command.type === 'move') {
          if (!validSafeGridValue(command.x) || !validSafeGridValue(command.y)) {
            throw new OperationRejection('invalid-input')
          }
          target.x = canonicalZero(command.x)
          target.y = canonicalZero(command.y)
        } else {
          if (!validSafeGridValue(command.w, true) || !validSafeGridValue(command.h, true)) {
            throw new OperationRejection('invalid-input')
          }
          target.w = command.w
          target.h = command.h
        }
        candidate = normalizeCandidate(target, index, currentConfig)
        preservesBaseGeometry = itemGeometryEqual(algorithmBase[index], candidate)
      }

      if (
        interactionLayerIntent &&
        currentConfig.collisionMode === 'overlap' &&
        currentConfig.bringToFrontOnInteract
      ) {
        applyLayer(base, id!, 'front', true)
        candidate = base.find(item => Object.is(item.i, id))!
      }

      if (preservesBaseGeometry) {
        nextLayout = base
      } else if (currentConfig.collisionMode === 'prevent') {
        if (base.some(item => !Object.is(item.i, id) && collides(item, candidate!))) {
          throw new OperationRejection('collision', candidate)
        }
        nextLayout = base
      } else if (currentConfig.collisionMode === 'overlap') {
        nextLayout = base
      } else {
        try {
          nextLayout = propagateActive(base, id!, currentConfig)
        } catch (error) {
          if (error instanceof GridLayoutValidationError) {
            throw new OperationRejection('invalid-input', candidate, {
              kind: 'geometry',
              error,
            })
          }
          throw error
        }
        candidate = nextLayout.find(item => Object.is(item.i, id))!
        if (interactionUpdate && command.type === 'move' && currentConfig.restoreOnDrag) {
          const target = nextLayout.find(item => Object.is(item.i, id))!
          const hadStatic = Object.hasOwn(target, 'static')
          const originalStatic = target.static
          target.static = true
          nextLayout = normalizeFullLayout(nextLayout, currentConfig)
          const normalizedTarget = nextLayout.find(item => Object.is(item.i, id))!
          if (hadStatic) normalizedTarget.static = originalStatic
          else delete normalizedTarget.static
        } else {
          nextLayout = normalizeFullLayout(nextLayout, currentConfig)
        }
        candidate = nextLayout.find(item => Object.is(item.i, id))!
      }
    }

    let metrics: InternalContainerMetrics
    try {
      metrics = calculateContainerMetrics(nextLayout, nextConfig)
    } catch (error) {
      if (error instanceof GridLayoutValidationError) {
        throw new OperationRejection('invalid-input', candidate, {
          kind: 'geometry',
          error,
        })
      }
      throw error
    }

    const status = layoutsSemanticallyEqual(nextLayout, compareLayout) ? 'unchanged' : 'accepted'
    return {
      result: materializeResult(
        status,
        status === 'accepted' ? 'applied' : 'same-value',
        operation,
        id,
        publicPrevious,
        nextLayout,
        command.type === 'set' || command.type === 'config' || command.type === 'auto-resize'
          ? null
          : candidate,
      ),
      nextLayout: cloneLayout(nextLayout),
      nextConfig,
      metrics,
      failure: null,
    }
  } catch (error) {
    const rejection =
      error instanceof OperationRejection
        ? error
        : error instanceof GridLayoutExtensionError
          ? new OperationRejection(error.code, candidate, { kind: 'extension', error })
          : new OperationRejection('invalid-input', candidate)
    const rejectedCandidate =
      command.type === 'set' || command.type === 'config' || command.type === 'auto-resize'
        ? null
        : (candidate ?? rejection.candidate)
    const metrics = calculateContainerMetrics(publicPrevious, currentConfig)
    return {
      result: rejectedResult(operation, id, publicPrevious, rejection.reason, rejectedCandidate),
      nextLayout: cloneLayout(publicPrevious),
      nextConfig: currentConfig,
      metrics,
      failure: rejection.failure,
    }
  }
}

export function mergeLayoutMetadata(
  baseInput: ReadonlyLayout,
  metadataInput: ReadonlyLayout,
): Layout {
  const base = cloneLayout(baseInput)
  const metadata = cloneLayout(metadataInput)
  const metadataById = new Map(metadata.map(item => [item.i, item]))

  for (const item of base) {
    const source = metadataById.get(item.i)
    if (!source) continue
    const targetRecord = item as unknown as Record<string, unknown>
    const sourceRecord = source as unknown as Record<string, unknown>
    for (const key of Object.keys(targetRecord)) {
      if (!KNOWN_ITEM_KEYS.has(key)) delete targetRecord[key]
    }
    for (const key of Object.keys(sourceRecord)) {
      if (!KNOWN_ITEM_KEYS.has(key)) {
        defineDataProperty(targetRecord, key, sourceRecord[key])
      }
    }
  }
  return base
}

function nextVersion(value: number): number {
  const next = value + 1
  if (!Number.isSafeInteger(next) || next >= Number.MAX_SAFE_INTEGER) {
    invalid('config.counter["engineVersion"]', {
      reason: 'counter-exhausted',
      counter: 'engineVersion',
      limit: Number.MAX_SAFE_INTEGER - 1,
    })
  }
  return next
}

function createLayoutEngineInternal(
  initialLayout: ReadonlyLayout,
  initialConfig: InternalEffectiveConfig,
  options: InternalLayoutEngineInitializationOptions = {},
): LayoutEnginePort {
  let committedConfig = snapshotEffectiveConfig(initialConfig)
  let committedLayout = snapshotLayout(
    initialLayout,
    committedConfig,
    options.deferHorizontalBounds ?? false,
    options.allowInitialCollisions ?? false,
  )
  let version = 1
  let sessionSequence = 0
  let activeSession: SessionRecord | null = null
  const evaluations = new WeakMap<LayoutEngineEvaluation, EvaluationRecord>()
  const sessions = new WeakMap<InternalInteractionSession, SessionRecord>()

  function makeEvaluation(
    attempt: OperationAttempt,
    baseVersion = version,
  ): LayoutEngineEvaluation {
    const evaluation: LayoutEngineEvaluation = {
      baseVersion,
      result: attempt.result,
      nextConfig: attempt.nextConfig,
      metrics: attempt.metrics,
      failure: attempt.failure,
    }
    evaluations.set(evaluation, {
      evaluation,
      nextLayout: attempt.nextLayout,
      nextConfig: attempt.nextConfig,
      changesConfig: !configEqual(committedConfig, attempt.nextConfig),
      state: 'pending',
      finalResult: null,
    })
    return evaluation
  }

  function closeRecord(record: SessionRecord): void {
    if (!record.active) return
    record.active = false
    record.workingEvaluation = null
    if (activeSession === record) activeSession = null
  }

  function restoreInteractionWorking(record: EvaluationRecord): void {
    const interaction = record.interactionRecord
    if (
      !interaction?.active ||
      interaction.workingEvaluation !== record.evaluation ||
      !record.previousWorking
    ) {
      return
    }
    let previousWorking = record.previousWorking
    let previousLayerIntent = record.previousLayerIntent
    let previousEvaluation = record.previousWorkingEvaluation
    let previousRecord = previousEvaluation ? evaluations.get(previousEvaluation) : undefined
    while (previousRecord?.state === 'rolled-back' && previousRecord.previousWorking) {
      previousWorking = previousRecord.previousWorking
      previousLayerIntent = previousRecord.previousLayerIntent
      previousEvaluation = previousRecord.previousWorkingEvaluation
      previousRecord = previousEvaluation ? evaluations.get(previousEvaluation) : undefined
    }
    interaction.latestWorking = cloneLayout(previousWorking)
    interaction.layerIntent = previousLayerIntent ?? interaction.layerIntent
    interaction.workingEvaluation =
      previousEvaluation && previousRecord?.state === 'pending' ? previousEvaluation : null
  }

  return {
    evaluate(command) {
      const baseVersion = version
      if (activeSession && command.type !== 'config') {
        const operation = operationFor(command)
        const id = idFor(command)
        const result = rejectedResult(operation, id, committedLayout, 'interaction-active')
        return makeEvaluation(
          {
            result,
            nextLayout: cloneLayout(committedLayout),
            nextConfig: committedConfig,
            metrics: calculateContainerMetrics(committedLayout, committedConfig),
            failure: null,
          },
          baseVersion,
        )
      }
      return makeEvaluation(
        evaluateCommandLayout(committedLayout, committedLayout, committedConfig, command),
        baseVersion,
      )
    },

    beginInteraction(command) {
      if (activeSession) {
        const operation = command.type === 'drag' ? 'move' : 'resize'
        return {
          status: 'rejected',
          result: rejectedResult(
            operation,
            validId(command.id) ? command.id : null,
            committedLayout,
            'interaction-active',
          ),
        }
      }
      const operation = command.type === 'drag' ? 'move' : 'resize'
      if (!validId(command.id)) {
        return {
          status: 'rejected',
          result: rejectedResult(operation, null, committedLayout, 'invalid-input'),
        }
      }
      const item = committedLayout.find(entry => Object.is(entry.i, command.id))
      if (!item) {
        return {
          status: 'rejected',
          result: rejectedResult(operation, command.id, committedLayout, 'item-not-found'),
        }
      }
      if (item.static) {
        return {
          status: 'rejected',
          result: rejectedResult(operation, command.id, committedLayout, 'static-item', item),
        }
      }
      const enabled =
        command.type === 'drag'
          ? (item.isDraggable ?? committedConfig.isDraggable)
          : (item.isResizable ?? committedConfig.isResizable)
      if (!enabled) {
        return {
          status: 'rejected',
          result: rejectedResult(operation, command.id, committedLayout, 'disabled', item),
        }
      }

      sessionSequence = nextVersion(sessionSequence)
      const session: InternalInteractionSession = {
        sessionId: sessionSequence,
        beginVersion: version,
        baseLayout: cloneLayout(committedLayout),
        baseConfig: committedConfig,
      }
      const record: SessionRecord = {
        session,
        type: command.type,
        id: command.id,
        baseLayout: cloneLayout(committedLayout),
        latestWorking: cloneLayout(committedLayout),
        workingEvaluation: null,
        active: true,
        layerIntent:
          committedConfig.collisionMode === 'overlap' && committedConfig.bringToFrontOnInteract,
      }
      sessions.set(session, record)
      activeSession = record
      return { status: 'accepted', session }
    },

    evaluateInteraction(session, command) {
      const baseVersion = version
      const currentConfig = committedConfig
      const record = sessions.get(session)
      const operation = command.type === 'drag' ? 'move' : 'resize'
      if (!record || !record.active || activeSession !== record) {
        return makeEvaluation(
          {
            result: rejectedResult(operation, null, committedLayout, 'cancelled'),
            nextLayout: cloneLayout(committedLayout),
            nextConfig: committedConfig,
            metrics: calculateContainerMetrics(committedLayout, committedConfig),
            failure: null,
          },
          baseVersion,
        )
      }
      if (record.type !== command.type) {
        return makeEvaluation(
          {
            result: rejectedResult(operation, record.id, committedLayout, 'invalid-input'),
            nextLayout: cloneLayout(committedLayout),
            nextConfig: committedConfig,
            metrics: calculateContainerMetrics(committedLayout, committedConfig),
            failure: null,
          },
          baseVersion,
        )
      }
      const interactionCommand: InternalLayoutCommand =
        command.type === 'drag'
          ? { type: 'move', id: record.id, x: command.x, y: command.y }
          : { type: 'resize', id: record.id, w: command.w, h: command.h }
      const previousWorking = cloneLayout(record.latestWorking)
      const previousWorkingEvaluation = record.workingEvaluation
      const previousLayerIntent = record.layerIntent
      const algorithmBase =
        record.session.baseConfig.collisionMode === 'overlap' && !record.layerIntent
          ? mergeInteractionLayerState(record.baseLayout, record.latestWorking)
          : record.baseLayout
      const evaluatedAttempt = evaluateCommandLayout(
        algorithmBase,
        committedLayout,
        record.session.baseConfig,
        interactionCommand,
        record.latestWorking,
        record.layerIntent,
        command.terminal !== true,
      )
      const attempt: OperationAttempt = {
        ...evaluatedAttempt,
        nextConfig: currentConfig,
        metrics: calculateContainerMetrics(evaluatedAttempt.nextLayout, currentConfig),
      }
      const evaluation = makeEvaluation(attempt, baseVersion)
      if (attempt.result.status === 'accepted') {
        record.latestWorking = cloneLayout(attempt.nextLayout)
        record.workingEvaluation = evaluation
        record.layerIntent = false
        const evaluationRecord = evaluations.get(evaluation)!
        evaluationRecord.interactionRecord = record
        evaluationRecord.previousWorking = previousWorking
        evaluationRecord.previousWorkingEvaluation = previousWorkingEvaluation
        evaluationRecord.previousLayerIntent = previousLayerIntent
      }
      return evaluation
    },

    closeInteraction(session) {
      const record = sessions.get(session)
      if (record) closeRecord(record)
    },

    replaceExternal(layout, config, replaceOptions = {}) {
      let nextConfig: InternalEffectiveConfig
      let nextLayout: Layout
      try {
        nextConfig = snapshotEffectiveConfig(config)
        nextLayout = snapshotLayout(
          layout,
          nextConfig,
          replaceOptions.deferHorizontalBounds ?? false,
        )
      } catch {
        return rejectedResult('set', null, committedLayout, 'invalid-input')
      }
      if (activeSession) closeRecord(activeSession)
      const changed =
        !layoutsSemanticallyEqual(nextLayout, committedLayout) ||
        !configEqual(nextConfig, committedConfig)
      const result = materializeResult(
        changed ? 'accepted' : 'unchanged',
        changed ? 'applied' : 'same-value',
        'set',
        null,
        committedLayout,
        nextLayout,
        null,
      )
      if (changed) {
        committedLayout = cloneLayout(nextLayout)
        committedConfig = nextConfig
        version = nextVersion(version)
      }
      return result
    },

    mergeExternalMetadata(layout) {
      const next = mergeLayoutMetadata(committedLayout, layout)
      committedLayout = next
      if (activeSession) {
        activeSession.baseLayout = mergeLayoutMetadata(activeSession.baseLayout, next)
        activeSession.latestWorking = mergeLayoutMetadata(activeSession.latestWorking, next)
      }
      version = nextVersion(version)
      return cloneLayout(committedLayout)
    },

    confirm(evaluation) {
      const record = evaluations.get(evaluation)
      if (!record) {
        return rejectedResult('set', null, committedLayout, 'superseded')
      }
      if (record.state !== 'pending') return record.finalResult!
      if (evaluation.baseVersion !== version) {
        restoreInteractionWorking(record)
        record.state = 'rolled-back'
        record.finalResult = rejectedResult(
          evaluation.result.operation,
          evaluation.result.id,
          committedLayout,
          'superseded',
        )
        return record.finalResult
      }
      if (evaluation.result.status === 'rejected') {
        restoreInteractionWorking(record)
        record.state = 'rolled-back'
        record.finalResult = evaluation.result
        return record.finalResult
      }
      if (evaluation.result.status === 'accepted' || record.changesConfig) {
        committedLayout = cloneLayout(record.nextLayout)
        committedConfig = record.nextConfig
        version = nextVersion(version)
      }
      if (record.interactionRecord?.workingEvaluation === evaluation) {
        record.interactionRecord.workingEvaluation = null
      }
      record.state = 'confirmed'
      record.finalResult = evaluation.result
      return record.finalResult
    },

    rollback(evaluation) {
      const record = evaluations.get(evaluation)
      if (record?.state === 'pending') {
        restoreInteractionWorking(record)
        record.state = 'rolled-back'
        record.finalResult = rejectedResult(
          evaluation.result.operation,
          evaluation.result.id,
          committedLayout,
          'cancelled',
        )
      }
      return cloneLayout(committedLayout)
    },
  }
}

export function createLayoutEngine(
  initialLayout: ReadonlyLayout,
  initialConfig: InternalEffectiveConfig,
  options: LayoutReplacementOptions = {},
): LayoutEnginePort {
  return createLayoutEngineInternal(initialLayout, initialConfig, {
    deferHorizontalBounds: options.deferHorizontalBounds,
  })
}

export function createNormalizedLayoutEngine(
  initialLayout: ReadonlyLayout,
  initialConfig: InternalEffectiveConfig,
): NormalizedLayoutEngine {
  const engine = createLayoutEngineInternal(initialLayout, initialConfig, {
    allowInitialCollisions: true,
  })
  const evaluation = engine.evaluate({ type: 'set', layout: initialLayout })

  if (evaluation.result.status === 'rejected') {
    engine.rollback(evaluation)
    if (evaluation.failure) throw evaluation.failure.error
    throw new GridLayoutValidationError('Initial layout normalization failed', {
      code: 'invalid-layout',
      path: 'layout',
      cause: evaluation.result,
    })
  }

  const result = engine.confirm(evaluation)
  if (result.status === 'rejected') {
    throw new GridLayoutValidationError('Initial layout normalization was superseded', {
      code: 'invalid-layout',
      path: 'layout',
      cause: result,
    })
  }

  return {
    engine,
    layout: cloneLayout(result.layout),
    metrics: evaluation.metrics,
    changed: result.status === 'accepted',
  }
}

export const defaultInternalConfig: InternalEffectiveConfig = {
  cols: 12,
  rowHeight: 150,
  gap: [10, 10],
  containerPadding: [0, 0],
  maxRows: Infinity,
  compactor: verticalCompactor,
  collisionMode: 'push',
  isDraggable: true,
  isResizable: true,
  restoreOnDrag: false,
  bringToFrontOnInteract: true,
}

export { noCompactor }
