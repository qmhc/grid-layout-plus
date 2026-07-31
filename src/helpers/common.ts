import { GridLayoutValidationError } from '../core/errors'
import {
  defineDataProperty,
  getOwnDescriptor,
  getOwnKeys,
  getPrototype,
  propertyPath,
  readPlainDataObject,
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
      ? (key === 'x' || key === 'y' || key === 'zIndex') && typeof itemValue === 'number'
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

/** 返回 Layout 的最大底边坐标。 */
export function bottom(layout: ReadonlyLayout): number {
  const snapshot = snapshotLayout(layout).layout
  let max = 0
  for (let index = 0; index < snapshot.length; index++) {
    const bottomY = addGridValues(snapshot[index].y, snapshot[index].h, `layout[${index}].h`)
    if (bottomY > max) max = bottomY
  }
  return max
}

/** 返回与输入递归隔离的可变 Layout。 */
export function cloneLayout(layout: ReadonlyLayout): Layout {
  return snapshotLayout(layout).layout
}

export function cloneLayoutItem(layoutItem: ReadonlyLayoutItem): LayoutItem {
  return cloneLayoutItemAt(layoutItem, 'layoutItem')
}

/** 使用半开矩形判定两个 LayoutItem 是否碰撞。 */
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

/** 使用障碍底边候选执行确定性垂直压缩。 */
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

/** @deprecated 请迁移到 useGridLayout 或 normalizeLayout。 */
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

/**
 * Helper to convert a number to a percentage string.
 *
 * @param   num Any number
 * @return      That number as a percentage.
 */
export function perc(num: number): string {
  return num * 100 + '%'
}

export function setTransform(top: number, left: number, width: number, height: number) {
  // Replace unitless items with px
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
/**
 * Just like the setTransform method, but instead it will return a negative value of right.
 *
 * @param top
 * @param right
 * @param width
 * @param height
 * @returns {{transform: string, WebkitTransform: string, MozTransform: string, msTransform: string, OTransform: string, width: string, height: string, position: string}}
 */
export function setTransformRtl(top: number, right: number, width: number, height: number) {
  // Replace unitless items with px
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
/**
 * Just like the setTopLeft method, but instead, it will return a right property instead of left.
 *
 * @param top
 * @param right
 * @param width
 * @param height
 * @returns position style
 */
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
 * Get layout items sorted from top left to right and down.
 *
 * @return Layout, sorted static items first.
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

/** 按列、行顺序排序，用于水平压缩和水平碰撞避让。 */
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
 * Validate a layout. Throws errors.
 *
 * @param layout Array of layout items.
 * @param contextName Context name for errors.
 * @throw Validation error.
 */
export function validateLayout(layout: ReadonlyLayout, contextName?: string): void {
  const root = contextName ? contextName.charAt(0).toLowerCase() + contextName.slice(1) : 'layout'
  snapshotLayout(layout, root)
}

// Flow can't really figure this out, so we just use Object
export function autoBindHandlers(
  el: Record<string, (...args: any[]) => any>,
  fns: Array<string>,
): void {
  fns.forEach(key => (el[key] = el[key].bind(el)))
}

/**
 * Convert a JS object to CSS string. Similar to React's output of CSS.
 * @param obj
 * @returns
 */
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

/* The following list is defined in React's core */
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

  // SVG-related properties
  fillOpacity: true,
  stopOpacity: true,
  strokeDashoffset: true,
  strokeOpacity: true,
  strokeWidth: true,
}

/**
 * Will add px to the end of style values which are Numbers.
 * @param name
 * @param value
 * @returns {*}
 */
export function addPx(name: string, value: number | string) {
  if (typeof value === 'number' && !IS_UNITLESS[name]) {
    return value + 'px'
  } else {
    return value
  }
}

export const hyphenateRE = /([a-z\d])([A-Z])/g

/**
 * Hyphenate a camelCase string.
 *
 * @param  str
 * @return
 */
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
      // Remove from array
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
