import { GridLayoutValidationError } from '../core/errors'
import {
  defineDataProperty,
  getOwnDescriptor,
  getOwnKeys,
  getPrototype,
  propertyPath,
  readPlainDataObject,
  snapshotResizeHandles,
} from '../core/validation'

import type { InjectionKey } from 'vue'
import type { EventEmitter } from '@vexip-ui/utils'
import type { LayoutInstance } from './internal-types'
import type {
  CompactMinPositions,
  CompactType,
  Layout,
  LayoutItem,
  ReadonlyLayout,
  ReadonlyLayoutItem,
} from './types'

export const LAYOUT_KEY = Symbol('LAYOUT_KEY') as InjectionKey<LayoutInstance>
export const EMITTER_KEY = Symbol('EMITTER_KEY') as InjectionKey<EventEmitter>

const REQUIRED_LAYOUT_ITEM_KEYS = ['i', 'x', 'y', 'w', 'h'] as const
const KNOWN_LAYOUT_ITEM_KEYS = new Set([
  ...REQUIRED_LAYOUT_ITEM_KEYS,
  'minW',
  'minH',
  'maxW',
  'maxH',
  'moved',
  'static',
  'isDraggable',
  'isResizable',
  'resizeHandles',
  'autoHeight',
  'zIndex',
])

interface LayoutSnapshot {
  layout: Layout
  sources: ReadonlyLayoutItem[]
}

function failLayout(path: string, cause: unknown): never {
  throw new GridLayoutValidationError(`Invalid layout value at ${path}`, {
    code: 'invalid-layout',
    path,
    cause,
  })
}

function canonicalZero(value: number): number {
  return Object.is(value, -0) ? 0 : value
}

function assertSafeInteger(
  value: unknown,
  path: string,
  options: Readonly<{ positive?: boolean; allowNegative?: boolean }> = {},
): asserts value is number {
  const { positive = false, allowNegative = false } = options
  if (
    !Number.isSafeInteger(value) ||
    (positive ? (value as number) <= 0 : !allowNegative && (value as number) < 0)
  ) {
    failLayout(path, value)
  }
}

function assertOptionalBoolean(value: unknown, path: string): asserts value is boolean | undefined {
  if (value !== undefined && typeof value !== 'boolean') failLayout(path, value)
}

function assertOptionalPositiveLimit(
  value: unknown,
  path: string,
): asserts value is number | undefined {
  if (
    value !== undefined &&
    value !== Infinity &&
    (!Number.isSafeInteger(value) || (value as number) <= 0)
  ) {
    failLayout(path, value)
  }
}

function addGridValues(first: number, second: number, path: string): number {
  const result = first + second
  if (!Number.isSafeInteger(result) || result < 0) failLayout(path, result)
  return result
}

function subtractGridValues(first: number, second: number, path: string): number {
  const result = first - second
  if (!Number.isSafeInteger(result)) failLayout(path, result)
  return result
}

function addSignedGridValues(first: number, second: number, path: string): number {
  const result = first + second
  if (!Number.isSafeInteger(result)) failLayout(path, result)
  return result
}

function validateLayoutExtents(layout: ReadonlyLayout, root = 'layout'): void {
  layout.forEach((item, index) => {
    addGridValues(item.x, item.w, `${root}[${index}].w`)
    addGridValues(item.y, item.h, `${root}[${index}].h`)
  })
}

function validateItemExtents(item: ReadonlyLayoutItem, path: string): void {
  addGridValues(item.x, item.w, `${path}.w`)
  addGridValues(item.y, item.h, `${path}.h`)
}

function cloneMetadataValue(value: unknown, path: string, ancestors: Set<object>): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return value
  }

  if (typeof value !== 'object' || value === null) failLayout(path, value)
  if (ancestors.has(value)) failLayout(path, value)
  ancestors.add(value)

  try {
    // metadata 也按 descriptor 读取，避免克隆过程触发 getter，并拒绝无法稳定序列化的循环引用。
    if (Array.isArray(value)) {
      const keys = getOwnKeys(value, 'invalid-layout', path)
      const lengthDescriptor = getOwnDescriptor(value, 'length', 'invalid-layout', path)
      const length = lengthDescriptor.value
      if (!Number.isSafeInteger(length) || length < 0) failLayout(path, length)

      const allowedKeys = new Set(Array.from({ length }, (_, index) => String(index)))
      allowedKeys.add('length')
      for (const key of keys) {
        if (typeof key === 'symbol') failLayout(`${path}.<symbol>`, key)
        if (!allowedKeys.has(key)) failLayout(propertyPath(path, key), key)
      }

      const result: unknown[] = Array(length)
      for (let index = 0; index < length; index++) {
        const indexPath = `${path}[${index}]`
        const descriptor = getOwnDescriptor(value, String(index), 'invalid-layout', indexPath)
        if (!descriptor.enumerable || !('value' in descriptor)) failLayout(indexPath, descriptor)
        result[index] = cloneMetadataValue(descriptor.value, indexPath, ancestors)
      }
      return result
    }

    const properties = readPlainDataObject(value, {
      code: 'invalid-layout',
      path,
    })
    const prototype = getPrototype(value, 'invalid-layout', path)
    const result: Record<string, unknown> = prototype === null ? Object.create(null) : {}
    for (const key of Object.keys(properties)) {
      defineDataProperty(
        result,
        key,
        cloneMetadataValue(properties[key], propertyPath(path, key), ancestors),
      )
    }
    return result
  } finally {
    ancestors.delete(value)
  }
}

function cloneLayoutItemAt(
  value: unknown,
  path: string,
  options: Readonly<{ allowNegativeX?: boolean }> = {},
): LayoutItem {
  const properties = readPlainDataObject(value, {
    code: 'invalid-layout',
    path,
    requiredKeys: REQUIRED_LAYOUT_ITEM_KEYS,
  })

  const id = properties.i
  if (
    (typeof id !== 'string' || id.length === 0) &&
    (typeof id !== 'number' || !Number.isSafeInteger(id) || Object.is(id, -0))
  ) {
    failLayout(`${path}.i`, id)
  }

  assertSafeInteger(properties.x, `${path}.x`, {
    allowNegative: options.allowNegativeX,
  })
  assertSafeInteger(properties.y, `${path}.y`)
  assertSafeInteger(properties.w, `${path}.w`, { positive: true })
  assertSafeInteger(properties.h, `${path}.h`, { positive: true })
  assertOptionalPositiveLimit(properties.minW, `${path}.minW`)
  assertOptionalPositiveLimit(properties.minH, `${path}.minH`)
  assertOptionalPositiveLimit(properties.maxW, `${path}.maxW`)
  assertOptionalPositiveLimit(properties.maxH, `${path}.maxH`)
  assertOptionalBoolean(properties.moved, `${path}.moved`)
  assertOptionalBoolean(properties.static, `${path}.static`)
  assertOptionalBoolean(properties.isDraggable, `${path}.isDraggable`)
  assertOptionalBoolean(properties.isResizable, `${path}.isResizable`)
  assertOptionalBoolean(properties.autoHeight, `${path}.autoHeight`)
  const resizeHandles =
    properties.resizeHandles === undefined
      ? undefined
      : snapshotResizeHandles(properties.resizeHandles, `${path}.resizeHandles`, 'invalid-layout')

  if (properties.zIndex !== undefined) {
    assertSafeInteger(properties.zIndex, `${path}.zIndex`, { allowNegative: true })
  }

  const minW = (properties.minW as number | undefined) ?? 1
  const minH = (properties.minH as number | undefined) ?? 1
  const maxW = (properties.maxW as number | undefined) ?? Infinity
  const maxH = (properties.maxH as number | undefined) ?? Infinity
  if (minW > maxW) failLayout(`${path}.minW`, minW)
  if (minH > maxH) failLayout(`${path}.minH`, minH)

  const result: Record<string, unknown> = {}
  const ancestors = new Set<object>([value as object])
  for (const key of Object.keys(properties)) {
    if (key === 'moved') continue
    const itemPath = propertyPath(path, key)
    const itemValue = properties[key]
    const resultValue = KNOWN_LAYOUT_ITEM_KEYS.has(key)
      ? key === 'resizeHandles'
        ? resizeHandles
        : (key === 'x' || key === 'y' || key === 'zIndex') && typeof itemValue === 'number'
          ? canonicalZero(itemValue)
          : itemValue
      : cloneMetadataValue(itemValue, itemPath, ancestors)
    defineDataProperty(result, key, resultValue)
  }

  return result as unknown as LayoutItem
}

function snapshotLayout(
  value: unknown,
  contextName = 'layout',
  options: Readonly<{ allowNegativeX?: boolean }> = {},
): LayoutSnapshot {
  if (!Array.isArray(value)) failLayout(contextName, value)

  const lengthDescriptor = getOwnDescriptor(value, 'length', 'invalid-layout', contextName)
  const length = lengthDescriptor.value
  if (!Number.isSafeInteger(length) || length < 0) failLayout(contextName, length)

  const allowedKeys = new Set(Array.from({ length }, (_, index) => String(index)))
  allowedKeys.add('length')
  for (const key of getOwnKeys(value, 'invalid-layout', contextName)) {
    if (typeof key === 'symbol') failLayout(`${contextName}.<symbol>`, key)
    if (!allowedKeys.has(key)) failLayout(propertyPath(contextName, key), key)
  }

  // `layout` 用于内部计算，`sources` 用于碰撞查询返回原始对象身份。
  const layout: Layout = Array(length)
  const sources: ReadonlyLayoutItem[] = Array(length)
  const ids = new Set<string | number>()

  for (let index = 0; index < length; index++) {
    const itemPath = `${contextName}[${index}]`
    const descriptor = getOwnDescriptor(value, String(index), 'invalid-layout', itemPath)
    if (!descriptor.enumerable || !('value' in descriptor)) failLayout(itemPath, descriptor)
    const item = cloneLayoutItemAt(descriptor.value, itemPath, options)
    if (ids.has(item.i)) failLayout(`${itemPath}.i`, item.i)
    ids.add(item.i)
    layout[index] = item
    sources[index] = descriptor.value as ReadonlyLayoutItem
  }

  return { layout, sources }
}

function collidesUnchecked(first: ReadonlyLayoutItem, second: ReadonlyLayoutItem): boolean {
  if (Object.is(first.i, second.i)) return false
  return !(
    first.x + first.w <= second.x ||
    first.x >= second.x + second.w ||
    first.y + first.h <= second.y ||
    first.y >= second.y + second.h
  )
}

function firstCollisionUnchecked(
  layout: readonly ReadonlyLayoutItem[],
  item: ReadonlyLayoutItem,
): ReadonlyLayoutItem | undefined {
  for (let index = 0; index < layout.length; index++) {
    if (collidesUnchecked(layout[index], item)) return layout[index]
  }
}

function indexById(layout: ReadonlyLayout): Map<string | number, number> {
  return new Map(layout.map((item, index) => [item.i, index]))
}

function sortByRowColUnchecked<T extends ReadonlyLayoutItem>(
  layout: readonly T[],
  indexes: ReadonlyMap<string | number, number>,
): T[] {
  return Array.from(layout).sort(
    (first, second) =>
      first.y - second.y || first.x - second.x || indexes.get(first.i)! - indexes.get(second.i)!,
  )
}

function sortByColRowUnchecked<T extends ReadonlyLayoutItem>(
  layout: readonly T[],
  indexes: ReadonlyMap<string | number, number>,
): T[] {
  return Array.from(layout).sort(
    (first, second) =>
      first.x - second.x || first.y - second.y || indexes.get(first.i)! - indexes.get(second.i)!,
  )
}

/**
 * Returns the largest bottom edge in grid rows.
 *
 * @throws {@link GridLayoutValidationError} If `layout` violates the layout contract.
 */
export function bottom(layout: ReadonlyLayout): number {
  const snapshot = snapshotLayout(layout).layout
  let max = 0
  for (let index = 0; index < snapshot.length; index++) {
    const bottomY = addGridValues(snapshot[index].y, snapshot[index].h, `layout[${index}].h`)
    if (bottomY > max) max = bottomY
  }
  return max
}

/**
 * Returns a mutable layout recursively detached from the input, including custom metadata.
 *
 * @throws {@link GridLayoutValidationError} If `layout` contains invalid fields, accessors,
 * unsupported metadata, duplicate ids, or cycles.
 */
export function cloneLayout(layout: ReadonlyLayout): Layout {
  return snapshotLayout(layout).layout
}

export function cloneLayoutItem(layoutItem: ReadonlyLayoutItem): LayoutItem {
  return cloneLayoutItemAt(layoutItem, 'layoutItem')
}

/**
 * Tests two layout items for overlap using half-open rectangle edges.
 *
 * Items with the same id never collide. Touching edges do not count as a collision.
 *
 * @throws {@link GridLayoutValidationError} If either item violates the layout item contract.
 */
export function collides(first: ReadonlyLayoutItem, second: ReadonlyLayoutItem): boolean {
  const firstSnapshot = cloneLayoutItemAt(first, 'layoutItem.first')
  const secondSnapshot = cloneLayoutItemAt(second, 'layoutItem.second')
  addGridValues(firstSnapshot.x, firstSnapshot.w, 'layoutItem.first.w')
  addGridValues(firstSnapshot.y, firstSnapshot.h, 'layoutItem.first.h')
  addGridValues(secondSnapshot.x, secondSnapshot.w, 'layoutItem.second.w')
  addGridValues(secondSnapshot.y, secondSnapshot.h, 'layoutItem.second.h')
  return collidesUnchecked(firstSnapshot, secondSnapshot)
}

function typedId(id: unknown): string {
  if (typeof id === 'number' && Number.isSafeInteger(id) && !Object.is(id, -0)) {
    return `number:${id}`
  }
  if (typeof id === 'string' && id.length > 0) {
    return `string:${JSON.stringify(id)}`
  }
  throw new GridLayoutValidationError('Invalid minPositions id', {
    code: 'invalid-config',
    path: 'minPositions',
    cause: id,
  })
}

function validateMinPositions(
  value: CompactMinPositions,
  layout: ReadonlyLayout,
): Map<string | number, number> {
  let iterator: MapIterator<[string | number, Readonly<{ y: number }>]>
  try {
    iterator = Map.prototype.entries.call(value)
  } catch (cause) {
    throw new GridLayoutValidationError('Invalid compact minPositions', {
      code: 'invalid-config',
      path: 'minPositions',
      cause,
    })
  }

  const ownKeys = getOwnKeys(value as object, 'invalid-config', 'minPositions')
  if (ownKeys.length) {
    const key = ownKeys[0]
    const path =
      typeof key === 'symbol' ? 'minPositions.<symbol>' : propertyPath('minPositions', key)
    throw new GridLayoutValidationError('Invalid compact minPositions', {
      code: 'invalid-config',
      path,
      cause: key,
    })
  }

  const items = new Map(layout.map(item => [item.i, item]))
  const result = new Map<string | number, number>()
  for (const [id, entry] of iterator) {
    const entryPath = `minPositions[${JSON.stringify(typedId(id))}]`
    const item = items.get(id)
    if (!item) {
      throw new GridLayoutValidationError('Unknown minPositions id', {
        code: 'invalid-config',
        path: entryPath,
        cause: id,
      })
    }
    const properties = readPlainDataObject(entry, {
      code: 'invalid-config',
      path: entryPath,
      allowedKeys: ['y'],
      requiredKeys: ['y'],
    })
    const y = properties.y
    if (!Number.isSafeInteger(y) || (y as number) < 0 || (y as number) > item.y) {
      throw new GridLayoutValidationError('Invalid minPositions y', {
        code: 'invalid-config',
        path: `${entryPath}.y`,
        cause: y,
      })
    }
    result.set(id, canonicalZero(y as number))
  }
  return result
}

/**
 * Returns a deterministically compacted, detached layout.
 *
 * When `verticalCompact` is `false`, items retain their row unless `minPositions` permits upward
 * movement. `minPositions` cannot be combined with vertical compaction.
 *
 * @throws {@link GridLayoutValidationError} If the layout or options violate their contracts.
 */
export function compact(
  layout: ReadonlyLayout,
  verticalCompact = true,
  minPositions?: CompactMinPositions,
): Layout {
  if (typeof verticalCompact !== 'boolean') {
    throw new GridLayoutValidationError('Invalid verticalCompact', {
      code: 'invalid-config',
      path: 'config.verticalCompact',
      cause: verticalCompact,
    })
  }
  if (verticalCompact && minPositions !== undefined) {
    throw new GridLayoutValidationError('minPositions cannot be used with vertical compaction', {
      code: 'invalid-config',
      path: 'minPositions',
      cause: minPositions,
    })
  }

  const cloned = snapshotLayout(layout).layout
  validateLayoutExtents(cloned)
  const positions =
    minPositions === undefined ? undefined : validateMinPositions(minPositions, cloned)
  const indexes = indexById(cloned)
  const compareWith = cloned.filter(item => item.static)
  const sorted = sortByRowColUnchecked(cloned, indexes)

  for (const item of sorted) {
    if (item.static) continue
    item.y = verticalCompact ? 0 : (positions?.get(item.i) ?? item.y)

    let collision: ReadonlyLayoutItem | undefined
    while ((collision = firstCollisionUnchecked(compareWith, item))) {
      item.y = addGridValues(collision.y, collision.h, `layout[${indexes.get(item.i)!}].y`)
    }
    compareWith.push(item)
  }

  return cloned
}

/**
 * Returns a detached layout whose horizontal extents fit within `bounds.cols`.
 *
 * Static-item collisions are pushed downward unless `allowOverlap` is `true`.
 *
 * @throws {@link GridLayoutValidationError} If the layout, column count, or option is invalid.
 */
export function correctBounds(
  layout: ReadonlyLayout,
  bounds: Readonly<{ cols: number }>,
  allowOverlap = false,
): Layout {
  const properties = readPlainDataObject(bounds, {
    code: 'invalid-config',
    path: 'config.bounds',
    allowedKeys: ['cols'],
    requiredKeys: ['cols'],
  })
  if (!Number.isSafeInteger(properties.cols) || (properties.cols as number) <= 0) {
    throw new GridLayoutValidationError('Invalid bounds cols', {
      code: 'invalid-config',
      path: 'config.bounds.cols',
      cause: properties.cols,
    })
  }
  if (typeof allowOverlap !== 'boolean') {
    throw new GridLayoutValidationError('Invalid allowOverlap', {
      code: 'invalid-config',
      path: 'config.allowOverlap',
      cause: allowOverlap,
    })
  }

  const cols = properties.cols as number
  const cloned = snapshotLayout(layout, 'layout', { allowNegativeX: true }).layout
  const obstacles = cloned.filter(item => item.static)

  for (let index = 0; index < cloned.length; index++) {
    const item = cloned[index]
    const right = addSignedGridValues(item.x, item.w, `layout[${index}].w`)
    addGridValues(item.y, item.h, `layout[${index}].h`)
    if (right > cols) {
      item.x = subtractGridValues(cols, item.w, `layout[${index}].x`)
    }
    if (item.x < 0) {
      item.x = 0
      item.w = cols
    }

    if (!item.static) {
      obstacles.push(item)
      continue
    }
    if (allowOverlap) continue

    let collision: ReadonlyLayoutItem | undefined
    while ((collision = firstCollisionUnchecked(obstacles, item))) {
      item.y = addGridValues(collision.y, collision.h, `layout[${index}].y`)
    }
  }
  return cloned
}

/**
 * Get a layout item by ID. Used so we can override later on if necessary.
 *
 * @param    layout Layout array.
 * @param   id     ID
 * @return     Item at ID.
 */
export function getLayoutItem(layout: Layout, id: number | string): LayoutItem | undefined
export function getLayoutItem(
  layout: ReadonlyLayout,
  id: number | string,
): ReadonlyLayoutItem | undefined
export function getLayoutItem(
  layout: ReadonlyLayout,
  id: number | string,
): ReadonlyLayoutItem | undefined {
  for (let i = 0, len = layout.length; i < len; i++) {
    if (Object.is(layout[i].i, id)) return layout[i]
  }
}

/**
 * Returns the first input item that collides with `layoutItem`, preserving input identity.
 *
 * @throws {@link GridLayoutValidationError} If the layout or candidate is invalid.
 */
export function getFirstCollision(
  layout: ReadonlyLayout,
  layoutItem: ReadonlyLayoutItem,
): ReadonlyLayoutItem | undefined {
  const snapshot = snapshotLayout(layout)
  const item = cloneLayoutItemAt(layoutItem, 'layoutItem')
  validateLayoutExtents(snapshot.layout)
  validateItemExtents(item, 'layoutItem')
  for (let index = 0; index < snapshot.layout.length; index++) {
    if (collidesUnchecked(snapshot.layout[index], item)) return snapshot.sources[index]
  }
}

/**
 * Returns every input item that collides with `layoutItem`, preserving layout order and identity.
 *
 * @throws {@link GridLayoutValidationError} If the layout or candidate is invalid.
 */
export function getAllCollisions(
  layout: ReadonlyLayout,
  layoutItem: ReadonlyLayoutItem,
): readonly ReadonlyLayoutItem[] {
  const snapshot = snapshotLayout(layout)
  const item = cloneLayoutItemAt(layoutItem, 'layoutItem')
  validateLayoutExtents(snapshot.layout)
  validateItemExtents(item, 'layoutItem')
  const collisions: ReadonlyLayoutItem[] = []
  for (let index = 0; index < snapshot.layout.length; index++) {
    if (collidesUnchecked(snapshot.layout[index], item)) {
      collisions.push(snapshot.sources[index])
    }
  }
  return collisions
}

/** @internal */
export function getStatics(layout: ReadonlyLayout): Array<ReadonlyLayoutItem> {
  return layout.filter(l => l.static)
}

/**
 * Returns a detached layout after applying a legacy item-movement operation.
 *
 * @deprecated Use {@link useGridLayout} or {@link normalizeLayout} instead.
 */
export function moveElement(
  layout: ReadonlyLayout,
  layoutItem: ReadonlyLayoutItem,
  x?: number,
  y?: number,
  isUserAction = false,
  preventCollision = false,
  compactType: CompactType = 'vertical',
): Layout {
  const snapshot = snapshotLayout(layout).layout
  const requested = cloneLayoutItemAt(layoutItem, 'layoutItem')
  validateLayoutExtents(snapshot)
  validateItemExtents(requested, 'layoutItem')

  if (x !== undefined) assertSafeInteger(x, 'layoutItem.x')
  if (y !== undefined) assertSafeInteger(y, 'layoutItem.y')
  if (typeof isUserAction !== 'boolean') {
    throw new GridLayoutValidationError('Invalid isUserAction', {
      code: 'invalid-config',
      path: 'config.isUserAction',
      cause: isUserAction,
    })
  }
  if (typeof preventCollision !== 'boolean') {
    throw new GridLayoutValidationError('Invalid preventCollision', {
      code: 'invalid-config',
      path: 'config.preventCollision',
      cause: preventCollision,
    })
  }
  if (compactType !== 'vertical' && compactType !== 'horizontal') {
    throw new GridLayoutValidationError('Invalid compactType', {
      code: 'invalid-config',
      path: 'config.compactType',
      cause: compactType,
    })
  }

  const indexes = indexById(snapshot)
  const targetIndex = indexes.get(requested.i)
  if (targetIndex === undefined) failLayout('layoutItem.i', requested.i)
  const target = snapshot[targetIndex]
  const nextX = canonicalZero(x ?? target.x)
  const nextY = canonicalZero(y ?? target.y)

  if (target.static || (target.x === nextX && target.y === nextY)) return snapshot

  target.x = nextX
  target.y = nextY

  if (preventCollision && snapshot.some(item => collidesUnchecked(item, target))) {
    return snapshotLayout(layout).layout
  }

  const sorted =
    compactType === 'horizontal'
      ? sortByColRowUnchecked(snapshot, indexes)
      : sortByRowColUnchecked(snapshot, indexes)
  const queue: LayoutItem[] = [target]

  // 每次移动都可能推动另一个动态元素，队列把位移传播到整条碰撞链。
  while (queue.length) {
    const moving = queue.shift()!
    let collision = sorted.find(item => collidesUnchecked(item, moving))

    while (collision) {
      if (collision.static) {
        if (compactType === 'horizontal') {
          moving.x = addGridValues(collision.x, collision.w, `layout[${indexes.get(moving.i)!}].x`)
        } else {
          moving.y = addGridValues(collision.y, collision.h, `layout[${indexes.get(moving.i)!}].y`)
        }
      } else {
        if (compactType === 'horizontal') {
          collision.x = addGridValues(moving.x, moving.w, `layout[${indexes.get(collision.i)!}].x`)
        } else {
          collision.y = addGridValues(moving.y, moving.h, `layout[${indexes.get(collision.i)!}].y`)
        }
        queue.push(collision)
      }
      collision = sorted.find(item => collidesUnchecked(item, moving))
    }
  }

  snapshot.forEach((item, index) => {
    addGridValues(item.x, item.w, `layout[${index}].w`)
    addGridValues(item.y, item.h, `layout[${index}].h`)
  })
  return snapshot
}

/** @internal 兼容旧内部调用；稳定 core 不导出。 */
export function moveElementAwayFromCollision(
  layout: ReadonlyLayout,
  collidesWith: ReadonlyLayoutItem,
  itemToMove: ReadonlyLayoutItem,
  _isUserAction?: boolean,
  compactType: CompactType = 'vertical',
): Layout {
  return moveElement(
    layout,
    itemToMove,
    compactType === 'horizontal'
      ? addGridValues(collidesWith.x, collidesWith.w, 'layoutItem.x')
      : undefined,
    compactType === 'vertical'
      ? addGridValues(collidesWith.y, collidesWith.h, 'layoutItem.y')
      : undefined,
    false,
    false,
    compactType,
  )
}

function collidesMutable(first: LayoutItem, second: LayoutItem): boolean {
  if (first === second) return false
  return !(
    first.x + first.w <= second.x ||
    first.x >= second.x + second.w ||
    first.y + first.h <= second.y ||
    first.y >= second.y + second.h
  )
}

function firstCollisionMutable(layout: Layout, item: LayoutItem): LayoutItem | undefined {
  return layout.find(candidate => collidesMutable(candidate, item))
}

function sortLayoutMutable(layout: Layout, compactType: CompactType): Layout {
  const indexes = new Map(layout.map((item, index) => [item, index]))
  return Array.from(layout).sort((first, second) => {
    const order =
      compactType === 'horizontal'
        ? first.x - second.x || first.y - second.y
        : first.y - second.y || first.x - second.x
    return order || indexes.get(first)! - indexes.get(second)!
  })
}

/**
 * @internal
 * Phase 2 状态机接管前供旧组件适配层使用；不得从稳定 core 导出。
 */
export function moveElementMutable(
  layout: Layout,
  layoutItem: LayoutItem,
  x?: number,
  y?: number,
  isUserAction = false,
  preventCollision = false,
  compactType: CompactType = 'vertical',
): Layout {
  if (layoutItem.static) return layout

  const oldX = layoutItem.x
  const oldY = layoutItem.y
  const movingUp =
    compactType === 'horizontal'
      ? typeof x === 'number' && oldX > x
      : typeof y === 'number' && oldY > y

  if (typeof x === 'number') layoutItem.x = x
  if (typeof y === 'number') layoutItem.y = y
  layoutItem.moved = true

  let sorted = sortLayoutMutable(layout, compactType)
  if (movingUp) sorted = sorted.reverse()
  const collisions = sorted.filter(item => collidesMutable(item, layoutItem))

  if (preventCollision && collisions.length) {
    layoutItem.x = oldX
    layoutItem.y = oldY
    layoutItem.moved = false
    return layout
  }

  for (const collision of collisions) {
    if (collision.moved) continue
    if (
      compactType === 'vertical' &&
      layoutItem.y > collision.y &&
      layoutItem.y - collision.y > collision.h / 4
    ) {
      continue
    }
    if (
      compactType === 'horizontal' &&
      layoutItem.x > collision.x &&
      layoutItem.x - collision.x > collision.w / 4
    ) {
      continue
    }

    if (collision.static) {
      moveElementAwayFromCollisionMutable(layout, collision, layoutItem, isUserAction, compactType)
    } else {
      moveElementAwayFromCollisionMutable(layout, layoutItem, collision, isUserAction, compactType)
    }
  }
  return layout
}

/** @internal */
export function moveElementAwayFromCollisionMutable(
  layout: Layout,
  collidesWith: LayoutItem,
  itemToMove: LayoutItem,
  isUserAction = false,
  compactType: CompactType = 'vertical',
): Layout {
  if (isUserAction) {
    const fakeItem: LayoutItem = {
      x: compactType === 'horizontal' ? Math.max(collidesWith.x - itemToMove.w, 0) : itemToMove.x,
      y: compactType === 'vertical' ? Math.max(collidesWith.y - itemToMove.h, 0) : itemToMove.y,
      w: itemToMove.w,
      h: itemToMove.h,
      i: '-1',
    }
    if (!firstCollisionMutable(layout, fakeItem)) {
      return moveElementMutable(
        layout,
        itemToMove,
        compactType === 'horizontal' ? fakeItem.x : undefined,
        compactType === 'vertical' ? fakeItem.y : undefined,
        false,
        false,
        compactType,
      )
    }
  }

  return moveElementMutable(
    layout,
    itemToMove,
    compactType === 'horizontal' ? itemToMove.x + 1 : undefined,
    compactType === 'vertical' ? itemToMove.y + 1 : undefined,
    false,
    false,
    compactType,
  )
}

/** @internal 把比例值转换成百分数字符串。 */
export function perc(num: number): string {
  return num * 100 + '%'
}

export function setTransform(top: number, left: number, width: number, height: number) {
  // 旧组件适配层需要同时输出各浏览器前缀，稳定定位策略只使用标准属性。
  const translate = 'translate3d(' + left + 'px,' + top + 'px, 0)'
  return {
    transform: translate,
    WebkitTransform: translate,
    MozTransform: translate,
    msTransform: translate,
    OTransform: translate,
    width: width + 'px',
    height: height + 'px',
    position: 'absolute',
  }
}
/** @internal RTL 版本的旧 transform 样式生成器，逻辑 right 需转换为负向位移。 */
export function setTransformRtl(top: number, right: number, width: number, height: number) {
  const translate = 'translate3d(' + right * -1 + 'px,' + top + 'px, 0)'
  return {
    transform: translate,
    WebkitTransform: translate,
    MozTransform: translate,
    msTransform: translate,
    OTransform: translate,
    width: width + 'px',
    height: height + 'px',
    position: 'absolute',
  }
}

export function setTopLeft(top: number, left: number, width: number, height: number) {
  return {
    top: top + 'px',
    left: left + 'px',
    width: width + 'px',
    height: height + 'px',
    position: 'absolute',
  }
}
/** @internal RTL 版本的旧绝对定位样式生成器。 */
export function setTopRight(top: number, right: number, width: number, height: number) {
  return {
    top: top + 'px',
    right: right + 'px',
    width: width + 'px',
    height: height + 'px',
    position: 'absolute',
  }
}

/**
 * Returns the original layout items ordered by row, column, and stable input order.
 *
 * The returned array is detached, while its entries preserve their original identities.
 */
export function sortLayoutItemsByRowCol(layout: ReadonlyLayout): readonly ReadonlyLayoutItem[] {
  const snapshot = snapshotLayout(layout)
  const indexes = indexById(snapshot.layout)
  return snapshot.sources
    .map((source, index) => ({
      source,
      snapshot: snapshot.layout[index],
    }))
    .sort(
      (first, second) =>
        first.snapshot.y - second.snapshot.y ||
        first.snapshot.x - second.snapshot.x ||
        indexes.get(first.snapshot.i)! - indexes.get(second.snapshot.i)!,
    )
    .map(entry => entry.source)
}

/** @internal 按列、行顺序排序，用于水平压缩和水平碰撞避让。 */
export function sortLayoutItemsByColRow(layout: ReadonlyLayout): readonly ReadonlyLayoutItem[] {
  const snapshot = snapshotLayout(layout)
  const indexes = indexById(snapshot.layout)
  return snapshot.sources
    .map((source, index) => ({
      source,
      snapshot: snapshot.layout[index],
    }))
    .sort(
      (first, second) =>
        first.snapshot.x - second.snapshot.x ||
        first.snapshot.y - second.snapshot.y ||
        indexes.get(first.snapshot.i)! - indexes.get(second.snapshot.i)!,
    )
    .map(entry => entry.source)
}

/**
 * Validates a layout without retaining or mutating it.
 *
 * @param contextName - Optional root label used in validation error paths.
 * @throws {@link GridLayoutValidationError} If the layout violates the public contract.
 */
export function validateLayout(layout: ReadonlyLayout, contextName?: string): void {
  const root = contextName ? contextName.charAt(0).toLowerCase() + contextName.slice(1) : 'layout'
  snapshotLayout(layout, root)
}

// 旧辅助函数只负责绑定已存在的方法，不参与稳定 core 的输入契约。
export function autoBindHandlers(
  el: Record<string, (...args: any[]) => any>,
  fns: Array<string>,
): void {
  fns.forEach(key => (el[key] = el[key].bind(el)))
}

/** @internal 将旧样式对象串行化为内联 CSS 文本。 */
export function createMarkup(obj: Record<string, any>) {
  const keys = Object.keys(obj)
  if (!keys.length) return ''
  let i
  const len = keys.length
  let result = ''

  for (i = 0; i < len; i++) {
    const key = keys[i]
    const val = obj[key]
    result += hyphenate(key) + ':' + addPx(key, val) + ';'
  }

  return result
}

/* 沿用 React 的无单位 CSS 属性清单，供旧样式串行化逻辑使用。 */
export const IS_UNITLESS: Record<string, boolean> = {
  animationIterationCount: true,
  boxFlex: true,
  boxFlexGroup: true,
  boxOrdinalGroup: true,
  columnCount: true,
  flex: true,
  flexGrow: true,
  flexPositive: true,
  flexShrink: true,
  flexNegative: true,
  flexOrder: true,
  gridRow: true,
  gridColumn: true,
  fontWeight: true,
  lineClamp: true,
  lineHeight: true,
  opacity: true,
  order: true,
  orphans: true,
  tabSize: true,
  widows: true,
  zIndex: true,
  zoom: true,

  // SVG 属性
  fillOpacity: true,
  stopOpacity: true,
  strokeDashoffset: true,
  strokeOpacity: true,
  strokeWidth: true,
}

/** @internal 为需要长度单位的数值样式追加 `px`。 */
export function addPx(name: string, value: number | string) {
  if (typeof value === 'number' && !IS_UNITLESS[name]) {
    return value + 'px'
  } else {
    return value
  }
}

export const hyphenateRE = /([a-z\d])([A-Z])/g

/** @internal 将 camelCase CSS 属性名转换为连字符形式。 */
export function hyphenate(str: string) {
  return str.replace(hyphenateRE, '$1-$2').toLowerCase()
}

export function findItemInArray(array: any[], property: string, value: any) {
  for (let i = 0; i < array.length; i++) {
    if (array[i][property] === value) {
      return true
    }
  }

  return false
}

export function findAndRemove(array: any[], property: string, value: any) {
  array.forEach(function (result, index) {
    if (result[property] === value) {
      // 命中后原地删除，保留旧调用方依赖的可变行为。
      array.splice(index, 1)
    }
  })
}

export function useNameHelper(block: string, namespace = 'vgl') {
  /**
   * @returns `${namespace}-${block}`
   */
  const b = () => `${namespace}-${block}`
  /**
   * @returns `${namespace}-${block}__${element}`
   */
  const be = (element: string) => `${b()}__${element}`
  /**
   * @returns `${namespace}-${block}--${modifier}`
   */
  const bm = (modifier: string | number) => `${b()}--${modifier}`
  /**
   * @returns `${namespace}-${block}__${element}--${modifier}`
   */
  const bem = (element: string, modifier: string | number) => `${b()}__${element}--${modifier}`

  return {
    b,
    be,
    bm,
    bem,
  }
}
