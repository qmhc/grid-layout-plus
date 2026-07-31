import { GridLayoutValidationError } from './errors'

import type { PositionStyle } from '../helpers/types'

export interface PositionGeometry {
  readonly top: number
  readonly inlineStart: number
  readonly width: number
  readonly height: number
}

export type PositionDirection = 'ltr' | 'rtl'

export type PositionStyleValidationResult =
  | {
      ok: true
      style: Record<string, string>
    }
  | {
      ok: false
      path: string
      cause: unknown
    }

const styleKeys = new Set(['position', 'top', 'left', 'right', 'width', 'height', 'transform'])

/** 把有限数格式化为不会使用指数记法的 canonical 十进制。 */
export function formatPositionNumber(value: number): string {
  const normalized = Object.is(value, -0) ? 0 : value
  const sign = normalized < 0 ? '-' : ''
  const text = String(Math.abs(normalized))
  if (!/[eE]/.test(text)) return `${sign}${text}`

  const [coefficient, exponentText] = text.toLowerCase().split('e')
  const exponent = Number(exponentText)
  const [integer, fraction = ''] = coefficient.split('.')
  const digits = `${integer}${fraction}`
  const decimalIndex = integer.length + exponent
  let magnitude: string
  if (decimalIndex <= 0) magnitude = `0.${'0'.repeat(-decimalIndex)}${digits}`
  else if (decimalIndex >= digits.length) {
    magnitude = `${digits}${'0'.repeat(decimalIndex - digits.length)}`
  } else {
    magnitude = `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`
  }
  return `${sign}${magnitude}`
}

function validateGeometry(
  top: number,
  inlineStart: number,
  width: number,
  height: number,
  direction: PositionDirection,
  allowSignedPosition: boolean,
): PositionGeometry {
  const values = [
    ['top', top],
    [direction === 'ltr' ? 'left' : 'right', inlineStart],
    ['width', width],
    ['height', height],
  ] as const
  const normalized: number[] = []
  for (const [index, [field, value]] of values.entries()) {
    const allowsNegative = allowSignedPosition && index < 2
    if (typeof value !== 'number' || !Number.isFinite(value) || (!allowsNegative && value < 0)) {
      throw new GridLayoutValidationError(`Invalid position geometry ${field}`, {
        code: 'invalid-config',
        path: `geometry.${field}`,
        cause: value,
      })
    }
    normalized.push(Object.is(value, -0) ? 0 : value)
  }
  return {
    top: normalized[0],
    inlineStart: normalized[1],
    width: normalized[2],
    height: normalized[3],
  }
}

export function validatePositionGeometry(
  top: number,
  inlineStart: number,
  width: number,
  height: number,
  direction: PositionDirection,
): PositionGeometry {
  return validateGeometry(top, inlineStart, width, height, direction, false)
}

/** 校验交互预览几何；位置允许为负，尺寸仍须为有限非负数。 */
export function validateTransientPositionGeometry(
  top: number,
  inlineStart: number,
  width: number,
  height: number,
  direction: PositionDirection,
): PositionGeometry {
  return validateGeometry(top, inlineStart, width, height, direction, true)
}

export function createTransformStyle(
  geometry: PositionGeometry,
  direction: PositionDirection,
): PositionStyle {
  const top = formatPositionNumber(geometry.top)
  const x = formatPositionNumber(direction === 'rtl' ? -geometry.inlineStart : geometry.inlineStart)
  return {
    transform: `translate3d(${x}px, ${top}px, 0)`,
    width: `${formatPositionNumber(geometry.width)}px`,
    height: `${formatPositionNumber(geometry.height)}px`,
    position: 'absolute',
  }
}

export function createAbsoluteStyle(
  geometry: PositionGeometry,
  direction: PositionDirection,
): PositionStyle {
  return {
    top: `${formatPositionNumber(geometry.top)}px`,
    [direction === 'ltr' ? 'left' : 'right']: `${formatPositionNumber(geometry.inlineStart)}px`,
    width: `${formatPositionNumber(geometry.width)}px`,
    height: `${formatPositionNumber(geometry.height)}px`,
    position: 'absolute',
  }
}

function propertyPath(basePath: string, key: string): string {
  return `${basePath}[${JSON.stringify(key)}]`
}

/**
 * 对扩展策略返回值执行 descriptor-safe、shape 与数值一致性检查。
 */
export function validatePositionStyleResult(
  value: unknown,
  usesCssTransforms: boolean,
  direction: PositionDirection,
  geometry: PositionGeometry,
  basePath: string,
): PositionStyleValidationResult {
  if (!value || typeof value !== 'object') {
    return { ok: false, path: basePath, cause: value }
  }

  let prototype: object | null
  let keys: (string | symbol)[]
  try {
    prototype = Object.getPrototypeOf(value)
    keys = Reflect.ownKeys(value)
  } catch (error) {
    return { ok: false, path: basePath, cause: error }
  }
  if (prototype !== Object.prototype && prototype !== null) {
    return { ok: false, path: basePath, cause: value }
  }

  const allowed = usesCssTransforms
    ? new Set(['position', 'transform', 'width', 'height'])
    : direction === 'ltr'
      ? new Set(['position', 'top', 'left', 'width', 'height'])
      : new Set(['position', 'top', 'right', 'width', 'height'])
  const style = Object.create(null) as Record<string, string>
  for (const key of keys) {
    if (typeof key !== 'string') {
      return { ok: false, path: `${basePath}.<symbol>`, cause: key }
    }
    if (!styleKeys.has(key) || !allowed.has(key)) {
      return { ok: false, path: propertyPath(basePath, key), cause: value }
    }
    let descriptor: PropertyDescriptor | undefined
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key)
    } catch (error) {
      return { ok: false, path: propertyPath(basePath, key), cause: error }
    }
    if (
      !descriptor ||
      descriptor.enumerable !== true ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
      typeof descriptor.value !== 'string'
    ) {
      return { ok: false, path: propertyPath(basePath, key), cause: descriptor }
    }
    style[key] = descriptor.value
  }

  const required = usesCssTransforms
    ? ['transform', 'width', 'height']
    : direction === 'ltr'
      ? ['top', 'left', 'width', 'height']
      : ['top', 'right', 'width', 'height']
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(style, key)) {
      return { ok: false, path: propertyPath(basePath, key), cause: value }
    }
  }

  const expected = usesCssTransforms
    ? createTransformStyle(geometry, direction)
    : createAbsoluteStyle(geometry, direction)
  for (const [key, actual] of Object.entries(style)) {
    const expectedValue = expected[key as keyof PositionStyle]
    if (expectedValue !== actual) {
      return { ok: false, path: propertyPath(basePath, key), cause: actual }
    }
  }
  return { ok: true, style }
}
