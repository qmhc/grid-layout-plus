import { GridLayoutValidationError } from './errors'
import { cloneLayoutItem } from '../helpers/common'
import {
  assertBoolean,
  assertNonNegativeFinite,
  assertPositiveSafeInteger,
  getOwnDescriptor,
  getOwnKeys,
  readPlainDataObject,
} from './validation'

import type {
  CalcGridCellDimensionsInput,
  GridCellDimensions,
  GridGeometry,
  PixelRect,
  ReadonlyClientRect,
  ReadonlyLayoutItem,
} from '../helpers/types'

function invalid(path: string, cause: unknown): never {
  throw new GridLayoutValidationError(`Invalid geometry value at ${path}`, {
    code: 'invalid-config',
    path,
    cause,
  })
}

const derivedGeometryErrors = new WeakSet<GridLayoutValidationError>()

function invalidLayout(path: string, cause: unknown): never {
  throw new GridLayoutValidationError(`Invalid layout value at ${path}`, {
    code: 'invalid-layout',
    path,
    cause,
  })
}

function invalidDerived(path: string, cause: unknown): never {
  const error = new GridLayoutValidationError(`Derived geometry overflow at ${path}`, {
    code: 'invalid-config',
    path,
    cause,
  })
  derivedGeometryErrors.add(error)
  throw error
}

/** @internal 供组件 adapter 将派生溢出映射为稳定 runtime code。 */
export function isDerivedGeometryError(error: unknown): boolean {
  return error instanceof GridLayoutValidationError && derivedGeometryErrors.has(error)
}

function canonicalZero(value: number): number {
  return Object.is(value, -0) ? 0 : value
}

function readPair(value: unknown, path: string): readonly [number, number] {
  if (!Array.isArray(value)) invalid(path, value)

  const keys = getOwnKeys(value, 'invalid-config', path)
  if (keys.length !== 3 || !keys.includes('0') || !keys.includes('1') || !keys.includes('length')) {
    invalid(path, value)
  }

  const firstDescriptor = getOwnDescriptor(value, '0', 'invalid-config', `${path}[0]`)
  const secondDescriptor = getOwnDescriptor(value, '1', 'invalid-config', `${path}[1]`)
  if (
    !firstDescriptor.enumerable ||
    !('value' in firstDescriptor) ||
    !secondDescriptor.enumerable ||
    !('value' in secondDescriptor)
  ) {
    invalid(
      !firstDescriptor.enumerable || !('value' in firstDescriptor) ? `${path}[0]` : `${path}[1]`,
      !firstDescriptor.enumerable || !('value' in firstDescriptor)
        ? firstDescriptor
        : secondDescriptor,
    )
  }

  assertNonNegativeFinite(firstDescriptor.value, `${path}[0]`)
  assertNonNegativeFinite(secondDescriptor.value, `${path}[1]`)
  return [canonicalZero(firstDescriptor.value), canonicalZero(secondDescriptor.value)]
}

function finite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(path, value)
  return canonicalZero(value)
}

function positiveFinite(value: unknown, path: string): number {
  const result = finite(value, path)
  if (result <= 0) invalid(path, value)
  return result
}

function checkedFinite(value: number, path: string): number {
  if (!Number.isFinite(value)) invalidDerived(path, value)
  return canonicalZero(value)
}

interface GeometrySnapshot extends GridGeometry {
  readonly availableWidth: number
  readonly cellWidth: number
  readonly pitchX: number
  readonly pitchY: number
}

function snapshotGeometry(value: unknown, requirePositivePitch: boolean): GeometrySnapshot {
  const properties = readPlainDataObject(value, {
    code: 'invalid-config',
    path: 'geometry',
    allowedKeys: ['width', 'cols', 'rowHeight', 'gap', 'containerPadding', 'rtl', 'effectiveScale'],
    requiredKeys: [
      'width',
      'cols',
      'rowHeight',
      'gap',
      'containerPadding',
      'rtl',
      'effectiveScale',
    ],
  })

  const width = positiveFinite(properties.width, 'geometry.width')
  assertPositiveSafeInteger(properties.cols, 'geometry.cols')
  assertNonNegativeFinite(properties.rowHeight, 'geometry.rowHeight')
  const gap = readPair(properties.gap, 'geometry.gap')
  const containerPadding = readPair(properties.containerPadding, 'geometry.containerPadding')
  assertBoolean(properties.rtl, 'geometry.rtl')
  const effectiveScale = positiveFinite(properties.effectiveScale, 'geometry.effectiveScale')

  const cols = properties.cols
  const rowHeight = canonicalZero(properties.rowHeight)
  // 每一步都单独检查有限性，便于把派生溢出映射到稳定且具体的字段路径。
  const paddingSpan = checkedFinite(2 * containerPadding[0], 'geometry.containerPadding[0]')
  checkedFinite(2 * containerPadding[1], 'geometry.containerPadding[1]')
  const gapSpan = checkedFinite((cols - 1) * gap[0], 'geometry.gap[0]')
  const afterPadding = checkedFinite(width - paddingSpan, 'geometry.width')
  const availableWidth = checkedFinite(afterPadding - gapSpan, 'geometry.width')
  if (availableWidth < 0) invalid('geometry.width', availableWidth)
  const cellWidth = checkedFinite(availableWidth / cols, 'geometry.width')
  const pitchX = checkedFinite(cellWidth + gap[0], 'geometry.gap[0]')
  const pitchY = checkedFinite(rowHeight + gap[1], 'geometry.gap[1]')

  // 像素转网格需要除以 pitch；仅做网格转像素时允许零尺寸单元格。
  if (requirePositivePitch && pitchX <= 0) invalid('geometry.width', pitchX)
  if (requirePositivePitch && pitchY <= 0) invalid('geometry.rowHeight', pitchY)

  return {
    width,
    cols,
    rowHeight,
    gap,
    containerPadding,
    rtl: properties.rtl,
    effectiveScale,
    availableWidth,
    cellWidth,
    pitchX,
    pitchY,
  }
}

function snapshotGridItem(value: ReadonlyLayoutItem) {
  const item = cloneLayoutItem(value)
  const minW = item.minW ?? 1
  const minH = item.minH ?? 1
  const maxW = item.maxW ?? Infinity
  const maxH = item.maxH ?? Infinity
  if (item.w < minW || item.w > maxW) invalidLayout('layoutItem.w', item.w)
  if (item.h < minH || item.h > maxH) invalidLayout('layoutItem.h', item.h)

  const right = item.x + item.w
  if (!Number.isSafeInteger(right)) invalidLayout('layoutItem.w', right)
  const bottom = item.y + item.h
  if (!Number.isSafeInteger(bottom)) invalidLayout('layoutItem.h', bottom)
  return item
}

function snapshotClientRect(value: unknown): ReadonlyClientRect {
  const properties = readPlainDataObject(value, {
    code: 'invalid-config',
    path: 'containerRect',
    allowedKeys: ['left', 'right', 'top', 'bottom', 'width', 'height'],
    requiredKeys: ['left', 'right', 'top', 'bottom', 'width', 'height'],
  })
  const left = finite(properties.left, 'containerRect.left')
  const right = finite(properties.right, 'containerRect.right')
  const top = finite(properties.top, 'containerRect.top')
  const bottom = finite(properties.bottom, 'containerRect.bottom')
  const width = finite(properties.width, 'containerRect.width')
  const height = finite(properties.height, 'containerRect.height')
  if (right < left) invalid('containerRect.right', right)
  if (bottom < top) invalid('containerRect.bottom', bottom)
  if (width < 0) invalid('containerRect.width', width)
  if (height < 0) invalid('containerRect.height', height)
  if (Math.abs(right - left - width) > 1e-6) invalid('containerRect.width', width)
  if (Math.abs(bottom - top - height) > 1e-6) invalid('containerRect.height', height)
  return { left, right, top, bottom, width, height }
}

/**
 * Calculates exact grid-cell dimensions in pixels.
 *
 * The available horizontal space excludes both container paddings and every inter-column gap. A
 * negative calculated width is clamped to zero.
 *
 * @throws {@link GridLayoutValidationError} If the geometry input is invalid.
 */
export function calcGridCellDimensions(
  input: Readonly<CalcGridCellDimensionsInput>,
): Readonly<GridCellDimensions> {
  const properties = readPlainDataObject(input, {
    code: 'invalid-config',
    path: 'geometry',
    allowedKeys: ['containerWidth', 'cols', 'gap', 'containerPadding', 'rowHeight'],
    requiredKeys: ['containerWidth', 'cols', 'gap', 'containerPadding', 'rowHeight'],
  })

  assertNonNegativeFinite(properties.containerWidth, 'geometry.width')
  assertPositiveSafeInteger(properties.cols, 'geometry.cols')
  const gap = readPair(properties.gap, 'geometry.gap')
  const containerPadding = readPair(properties.containerPadding, 'geometry.containerPadding')
  assertNonNegativeFinite(properties.rowHeight, 'geometry.rowHeight')

  const containerWidth = canonicalZero(properties.containerWidth)
  const cols = properties.cols
  const gapX = gap[0]
  const gapY = gap[1]
  const paddingX = containerPadding[0]
  const rowHeight = canonicalZero(properties.rowHeight)

  const paddingSpan = 2 * paddingX
  if (!Number.isFinite(paddingSpan)) invalid('geometry.containerPadding[0]', paddingSpan)
  const gapSpan = gapX * (cols - 1)
  if (!Number.isFinite(gapSpan)) invalid('geometry.gap[0]', gapSpan)
  const availableWidth = containerWidth - paddingSpan - gapSpan
  if (!Number.isFinite(availableWidth)) invalid('geometry.width', availableWidth)
  const calculatedWidth = availableWidth / cols
  if (!Number.isFinite(calculatedWidth)) invalid('geometry.width', calculatedWidth)
  const cellWidth = canonicalZero(Math.max(0, calculatedWidth))

  return {
    cellWidth,
    cellHeight: rowHeight,
    gapX,
    gapY,
  }
}

/**
 * Converts a layout item into a logical pixel rectangle.
 *
 * `inlineStart` is measured from the left in LTR and from the right in RTL.
 *
 * @throws {@link GridLayoutValidationError} If the item or geometry is invalid or overflows.
 */
export function gridToPixelRect(
  value: ReadonlyLayoutItem,
  geometryValue: Readonly<GridGeometry>,
): Readonly<PixelRect> {
  const geometry = snapshotGeometry(geometryValue, false)
  const item = snapshotGridItem(value)

  const xPitch = checkedFinite(item.x * geometry.pitchX, 'layoutItem.x')
  const yPitch = checkedFinite(item.y * geometry.pitchY, 'layoutItem.y')
  const itemCellWidth = checkedFinite(item.w * geometry.cellWidth, 'layoutItem.w')
  const itemRowHeight = checkedFinite(item.h * geometry.rowHeight, 'layoutItem.h')
  const inlineStart = checkedFinite(
    geometry.containerPadding[0] + xPitch,
    'geometry.containerPadding[0]',
  )
  const top = checkedFinite(geometry.containerPadding[1] + yPitch, 'geometry.containerPadding[1]')
  const widthGap = checkedFinite((item.w - 1) * geometry.gap[0], 'geometry.gap[0]')
  const width = checkedFinite(itemCellWidth + widthGap, 'geometry.gap[0]')
  const heightGap = checkedFinite((item.h - 1) * geometry.gap[1], 'geometry.gap[1]')
  const height = checkedFinite(itemRowHeight + heightGap, 'geometry.gap[1]')

  return Object.freeze({ top, inlineStart, width, height })
}

/**
 * Converts a viewport pointer and pixel anchor into unclamped, signed grid coordinates.
 *
 * @throws {@link GridLayoutValidationError} If any input geometry is invalid or overflows.
 */
export function pointerToGridPosition(
  value: Readonly<{
    clientX: number
    clientY: number
    containerRect: ReadonlyClientRect
    anchor: Readonly<{ inline: number; block: number }>
    geometry: Readonly<GridGeometry>
  }>,
): Readonly<{ x: number; y: number }> {
  const properties = readPlainDataObject(value, {
    code: 'invalid-config',
    path: 'pointer',
    allowedKeys: ['clientX', 'clientY', 'containerRect', 'anchor', 'geometry'],
    requiredKeys: ['clientX', 'clientY', 'containerRect', 'anchor', 'geometry'],
  })
  const geometry = snapshotGeometry(properties.geometry, true)
  const clientX = finite(properties.clientX, 'pointer.clientX')
  const clientY = finite(properties.clientY, 'pointer.clientY')
  const containerRect = snapshotClientRect(properties.containerRect)
  const anchorProperties = readPlainDataObject(properties.anchor, {
    code: 'invalid-config',
    path: 'anchor',
    allowedKeys: ['inline', 'block'],
    requiredKeys: ['inline', 'block'],
  })
  assertNonNegativeFinite(anchorProperties.inline, 'anchor.inline')
  assertNonNegativeFinite(anchorProperties.block, 'anchor.block')
  const anchorInline = canonicalZero(anchorProperties.inline)
  const anchorBlock = canonicalZero(anchorProperties.block)

  const inlineDelta = checkedFinite(
    geometry.rtl ? containerRect.right - clientX : clientX - containerRect.left,
    'pointer.clientX',
  )
  const blockDelta = checkedFinite(clientY - containerRect.top, 'pointer.clientY')
  const localInline = checkedFinite(
    inlineDelta / geometry.effectiveScale,
    'geometry.effectiveScale',
  )
  const localBlock = checkedFinite(blockDelta / geometry.effectiveScale, 'geometry.effectiveScale')
  const anchoredInline = checkedFinite(localInline - anchorInline, 'anchor.inline')
  const anchoredBlock = checkedFinite(localBlock - anchorBlock, 'anchor.block')
  const inlineNumerator = checkedFinite(
    anchoredInline - geometry.containerPadding[0],
    'geometry.containerPadding[0]',
  )
  const blockNumerator = checkedFinite(
    anchoredBlock - geometry.containerPadding[1],
    'geometry.containerPadding[1]',
  )
  const rawX = checkedFinite(inlineNumerator / geometry.pitchX, 'geometry.width')
  const roundedX = Math.round(rawX)
  if (!Number.isSafeInteger(roundedX)) invalidDerived('geometry.width', roundedX)
  const rawY = checkedFinite(blockNumerator / geometry.pitchY, 'geometry.rowHeight')
  const roundedY = Math.round(rawY)
  if (!Number.isSafeInteger(roundedY)) invalidDerived('geometry.rowHeight', roundedY)
  return Object.freeze({ x: canonicalZero(roundedX), y: canonicalZero(roundedY) })
}

/**
 * Converts a logical pixel size into an unclamped grid size.
 *
 * @throws {@link GridLayoutValidationError} If the size or geometry is invalid or overflows.
 */
export function pixelSizeToGridSize(
  value: Readonly<{
    width: number
    height: number
    geometry: Readonly<GridGeometry>
  }>,
): Readonly<{ w: number; h: number }> {
  const properties = readPlainDataObject(value, {
    code: 'invalid-config',
    path: 'size',
    allowedKeys: ['width', 'height', 'geometry'],
    requiredKeys: ['width', 'height', 'geometry'],
  })
  const geometry = snapshotGeometry(properties.geometry, true)
  assertNonNegativeFinite(properties.width, 'size.width')
  assertNonNegativeFinite(properties.height, 'size.height')
  const width = canonicalZero(properties.width)
  const height = canonicalZero(properties.height)

  const widthNumerator = checkedFinite(width + geometry.gap[0], 'size.width')
  const heightNumerator = checkedFinite(height + geometry.gap[1], 'size.height')
  const rawW = checkedFinite(widthNumerator / geometry.pitchX, 'geometry.width')
  const roundedW = Math.round(rawW)
  if (!Number.isSafeInteger(roundedW)) invalidDerived('geometry.width', roundedW)
  const rawH = checkedFinite(heightNumerator / geometry.pitchY, 'geometry.rowHeight')
  const roundedH = Math.round(rawH)
  if (!Number.isSafeInteger(roundedH)) invalidDerived('geometry.rowHeight', roundedH)
  return Object.freeze({ w: canonicalZero(roundedW), h: canonicalZero(roundedH) })
}
