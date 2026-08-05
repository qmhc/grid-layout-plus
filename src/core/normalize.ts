import { cloneLayout } from '../helpers/common'
import { noCompactor, verticalCompactor } from './compactors'
import { GridLayoutExtensionError, GridLayoutValidationError } from './errors'
import { assertPositiveSafeInteger, readPlainDataObject, snapshotCompactor } from './validation'

import type {
  Compactor,
  Layout,
  LayoutItem,
  NormalizeLayoutOptions,
  ReadonlyLayout,
  ReadonlyLayoutItem,
} from '../helpers/types'

function failLayout(path: string, cause: unknown): never {
  throw new GridLayoutValidationError(`Invalid layout value at ${path}`, {
    code: 'invalid-layout',
    path,
    cause,
  })
}

function extensionFailure(
  code: 'extension-error' | 'extension-invalid-result',
  cause: unknown,
): never {
  throw new GridLayoutExtensionError('Compactor evaluation failed', {
    code,
    source: 'compactor',
    path: null,
    cause,
  })
}

function safeAdd(first: number, second: number, path: string): number {
  const result = first + second
  if (!Number.isSafeInteger(result) || result < 0) failLayout(path, result)
  return result
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

function indexesFor(layout: ReadonlyLayout): Map<string | number, number> {
  return new Map(layout.map((item, index) => [item.i, index]))
}

function sortByAxis(
  layout: readonly LayoutItem[],
  direction: 'vertical' | 'horizontal',
  indexes: ReadonlyMap<string | number, number>,
): LayoutItem[] {
  return Array.from(layout).sort((first, second) => {
    const axisOrder =
      direction === 'horizontal'
        ? first.x - second.x || first.y - second.y
        : first.y - second.y || first.x - second.x
    return axisOrder || indexes.get(first.i)! - indexes.get(second.i)!
  })
}

function firstCollision(
  layout: readonly LayoutItem[],
  item: ReadonlyLayoutItem,
  direction: 'vertical' | 'horizontal',
  indexes: ReadonlyMap<string | number, number>,
): LayoutItem | undefined {
  return sortByAxis(layout, direction, indexes).find(other => collides(other, item))
}

function normalizeItemBounds(item: LayoutItem, index: number, cols: number, maxRows: number): void {
  const minW = item.minW ?? 1
  const minH = item.minH ?? 1
  const maxW = item.maxW ?? Infinity
  const maxH = item.maxH ?? Infinity

  if (minW > cols) failLayout(`layout[${index}].minW`, minW)
  if (maxRows !== Infinity && minH > maxRows) {
    failLayout(`layout[${index}].minH`, minH)
  }

  item.w = Math.min(Math.max(item.w, minW), maxW, cols)
  item.h = Math.min(Math.max(item.h, minH), maxH, maxRows)
  item.x = Math.min(item.x, cols - item.w)
  if (maxRows !== Infinity) item.y = Math.min(item.y, maxRows - item.h)

  safeAdd(item.x, item.w, `layout[${index}].w`)
  safeAdd(item.y, item.h, `layout[${index}].h`)
}

function normalizePushPlacement(
  layout: Layout,
  cols: number,
  maxRows: number,
  direction: 'vertical' | 'horizontal',
): Layout {
  const indexes = indexesFor(layout)
  const statics = layout.filter(item => item.static)

  for (let index = 0; index < statics.length; index++) {
    const collision = statics.slice(0, index).find(item => collides(item, statics[index]))
    if (collision) failLayout(`layout[${indexes.get(statics[index].i)!}]`, statics[index])
  }

  // 静态元素先成为障碍物；动态元素按压缩轴稳定排序，保证相同输入得到相同推挤结果。
  const placed = Array.from(statics)
  const movingItems = sortByAxis(
    layout.filter(item => !item.static),
    direction,
    indexes,
  )

  for (const item of movingItems) {
    const itemIndex = indexes.get(item.i)!
    let collision = firstCollision(placed, item, direction, indexes)
    while (collision) {
      if (direction === 'horizontal') {
        item.x = safeAdd(collision.x, collision.w, `layout[${itemIndex}].x`)
        if (safeAdd(item.x, item.w, `layout[${itemIndex}].w`) > cols) {
          failLayout(`layout[${itemIndex}]`, item)
        }
      } else {
        item.y = safeAdd(collision.y, collision.h, `layout[${itemIndex}].y`)
        if (maxRows !== Infinity && safeAdd(item.y, item.h, `layout[${itemIndex}].h`) > maxRows) {
          failLayout(`layout[${itemIndex}]`, item)
        }
      }
      collision = firstCollision(placed, item, direction, indexes)
    }
    placed.push(item)
  }

  return layout
}

function metadataEqual(first: unknown, second: unknown): boolean {
  if (Object.is(first, second)) return true
  if (Array.isArray(first) || Array.isArray(second)) {
    if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length) {
      return false
    }
    return first.every((value, index) => metadataEqual(value, second[index]))
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

function itemUnchangedExceptPosition(first: LayoutItem, second: LayoutItem): boolean {
  const firstCopy = { ...first } as Record<string, unknown>
  const secondCopy = { ...second } as Record<string, unknown>
  delete firstCopy.x
  delete firstCopy.y
  delete secondCopy.x
  delete secondCopy.y
  return metadataEqual(firstCopy, secondCopy)
}

function layoutsEqual(first: ReadonlyLayout, second: ReadonlyLayout): boolean {
  return (
    first.length === second.length &&
    first.every((item, index) => metadataEqual(item, second[index]))
  )
}

function validateCompactorResult(
  result: unknown,
  callInput: Layout,
  beforeCall: Layout,
  cols: number,
  maxRows: number,
): Layout {
  let afterCall: Layout
  let output: Layout
  try {
    afterCall = cloneLayout(callInput)
    output = cloneLayout(result as ReadonlyLayout)
  } catch {
    extensionFailure('extension-invalid-result', result)
  }

  // 扩展必须返回新布局，且不得改写传入副本；两项同时检查才能隔离不守约的 compactor。
  if (!layoutsEqual(afterCall, beforeCall) || result === callInput) {
    extensionFailure('extension-invalid-result', result)
  }
  if (output.length !== beforeCall.length) {
    extensionFailure('extension-invalid-result', result)
  }

  // compactor 只能调整非静态元素的位置，不能增删、重排或改写尺寸与 metadata。
  const indexes = indexesFor(beforeCall)
  for (let index = 0; index < output.length; index++) {
    const item = output[index]
    const before = beforeCall[index]
    const right = item.x + item.w
    const bottom = item.y + item.h
    if (
      !Object.is(item.i, before.i) ||
      indexes.get(item.i) !== index ||
      !itemUnchangedExceptPosition(item, before) ||
      (before.static && (item.x !== before.x || item.y !== before.y)) ||
      !Number.isSafeInteger(right) ||
      right > cols ||
      !Number.isSafeInteger(bottom) ||
      (maxRows !== Infinity && bottom > maxRows)
    ) {
      extensionFailure('extension-invalid-result', result)
    }
  }

  for (let index = 0; index < output.length; index++) {
    for (let otherIndex = 0; otherIndex < index; otherIndex++) {
      if (collides(output[index], output[otherIndex])) {
        extensionFailure('extension-invalid-result', result)
      }
    }
  }
  return output
}

function runCompactor(compactor: Compactor, layout: Layout, cols: number, maxRows: number): Layout {
  const callInput = cloneLayout(layout)
  const beforeCall = cloneLayout(callInput)
  let result: unknown
  try {
    result = compactor.compact(callInput, cols)
  } catch (cause) {
    extensionFailure('extension-error', cause)
  }
  return validateCompactorResult(result, callInput, beforeCall, cols, maxRows)
}

/**
 * Validates, bounds, resolves collisions in, and optionally compacts a layout.
 *
 * The returned layout is recursively detached from the input. `overlap` retains collisions,
 * `prevent` rejects them, and `push` displaces items along the compactor axis before compaction.
 *
 * @param layout - The readonly layout to normalize.
 * @param options - Column, row-limit, collision, and compaction settings.
 * @returns A mutable normalized layout detached from `layout`.
 * @throws {@link GridLayoutValidationError} If the layout or options are invalid.
 * @throws {@link GridLayoutExtensionError} If a custom compactor throws, mutates its input, or
 * returns a value that violates the compactor contract.
 */
export function normalizeLayout(
  layout: ReadonlyLayout,
  options: Readonly<NormalizeLayoutOptions>,
): Layout {
  const normalized = cloneLayout(layout)
  const properties = readPlainDataObject(options, {
    code: 'invalid-config',
    path: 'config',
    allowedKeys: ['cols', 'maxRows', 'collisionMode', 'compactor'],
    requiredKeys: ['cols'],
  })

  assertPositiveSafeInteger(properties.cols, 'config.cols')
  const cols = properties.cols
  const maxRows = properties.maxRows === undefined ? Infinity : properties.maxRows
  if (maxRows !== Infinity && (!Number.isSafeInteger(maxRows) || (maxRows as number) <= 0)) {
    throw new GridLayoutValidationError('Invalid maxRows', {
      code: 'invalid-config',
      path: 'config.maxRows',
      cause: maxRows,
    })
  }

  const collisionMode = properties.collisionMode === undefined ? 'push' : properties.collisionMode
  if (collisionMode !== 'push' && collisionMode !== 'prevent' && collisionMode !== 'overlap') {
    throw new GridLayoutValidationError('Invalid collisionMode', {
      code: 'invalid-config',
      path: 'config.collisionMode',
      cause: collisionMode,
    })
  }

  const compactorValue =
    properties.compactor === undefined ? verticalCompactor : properties.compactor
  const compactor = snapshotCompactor(compactorValue)
  normalized.forEach((item, index) => {
    normalizeItemBounds(item, index, cols, maxRows as number)
  })

  if (collisionMode === 'overlap') return normalized

  // `prevent` 在压缩前直接拒绝碰撞；`push` 则先建立无碰撞放置，再交给扩展压缩。
  for (let index = 0; index < normalized.length; index++) {
    for (let otherIndex = 0; otherIndex < index; otherIndex++) {
      if (collides(normalized[index], normalized[otherIndex])) {
        if (collisionMode === 'prevent') {
          failLayout(`layout[${index}]`, normalized[index])
        }
      }
    }
  }
  if (collisionMode === 'prevent') return normalized

  const direction = compactor.type ?? 'vertical'
  const placed = normalizePushPlacement(normalized, cols, maxRows as number, direction)
  if (compactorValue === noCompactor) return placed
  return runCompactor(compactor, placed, cols, maxRows as number)
}
