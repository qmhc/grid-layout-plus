import { GridLayoutExtensionError, GridLayoutValidationError } from './errors'

import type {
  Compactor,
  GridLayoutValidationCode,
  Layout,
  PositionStrategy,
  ReadonlyLayout,
} from '../helpers/types'

type DataProperties = Readonly<Record<string, unknown>>

export interface DropConfigSnapshot {
  readonly isDroppable?: boolean
  readonly dropItem?: Readonly<{ w: number; h: number }>
  readonly onDragOver?: (...args: unknown[]) => unknown
}

export function defineDataProperty(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })
}

function invalid(
  code: GridLayoutValidationCode,
  path: string,
  cause: unknown,
): GridLayoutValidationError {
  return new GridLayoutValidationError(`Invalid value at ${path}`, {
    code,
    path,
    cause,
  })
}

export function propertyPath(parent: string, key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`
}

export function getPrototype(
  value: object,
  code: GridLayoutValidationCode,
  path: string,
): object | null {
  try {
    return Object.getPrototypeOf(value)
  } catch (cause) {
    throw invalid(code, path, cause)
  }
}

export function getOwnKeys(
  value: object,
  code: GridLayoutValidationCode,
  path: string,
): Array<string | symbol> {
  try {
    return Reflect.ownKeys(value)
  } catch (cause) {
    throw invalid(code, path, cause)
  }
}

export function getOwnDescriptor(
  value: object,
  key: string | symbol,
  code: GridLayoutValidationCode,
  path: string,
): PropertyDescriptor {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor) throw invalid(code, path, key)
    return descriptor
  } catch (cause) {
    if (cause instanceof GridLayoutValidationError) throw cause
    throw invalid(code, path, cause)
  }
}

export function readPlainDataObject(
  value: unknown,
  options: Readonly<{
    code: GridLayoutValidationCode
    path: string
    allowedKeys?: readonly string[]
    requiredKeys?: readonly string[]
  }>,
): DataProperties {
  const { code, path, allowedKeys, requiredKeys = [] } = options
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalid(code, path, value)
  }

  const prototype = getPrototype(value, code, path)
  if (prototype !== Object.prototype && prototype !== null) {
    throw invalid(code, path, prototype)
  }

  const allowed = allowedKeys ? new Set(allowedKeys) : null
  const properties = Object.create(null) as Record<string, unknown>

  for (const key of getOwnKeys(value, code, path)) {
    if (typeof key === 'symbol') {
      throw invalid(code, `${path}.<symbol>`, key)
    }

    const keyPath = propertyPath(path, key)
    if (allowed && !allowed.has(key)) throw invalid(code, keyPath, key)

    const descriptor = getOwnDescriptor(value, key, code, keyPath)
    if (!descriptor.enumerable || !('value' in descriptor)) {
      throw invalid(code, keyPath, descriptor)
    }
    defineDataProperty(properties, key, descriptor.value)
  }

  for (const key of requiredKeys) {
    if (!Object.hasOwn(properties, key)) {
      throw invalid(code, propertyPath(path, key), undefined)
    }
  }

  return properties
}

export function assertBoolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== 'boolean') throw invalid('invalid-config', path, value)
}

export function assertPositiveSafeInteger(
  value: unknown,
  path: string,
  code: GridLayoutValidationCode = 'invalid-config',
): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw invalid(code, path, value)
  }
}

export function assertNonNegativeSafeInteger(
  value: unknown,
  path: string,
  code: GridLayoutValidationCode = 'invalid-config',
): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw invalid(code, path, value)
  }
}

export function assertNonNegativeFinite(value: unknown, path: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalid('invalid-config', path, value)
  }
}

export function snapshotCompactor(value: unknown, path = 'config.compactor'): Compactor {
  const properties = readPlainDataObject(value, {
    code: 'invalid-config',
    path,
    allowedKeys: ['type', 'compact', 'allowOverlap'],
    requiredKeys: ['compact'],
  })

  const type = properties.type
  if (type !== undefined && type !== 'vertical' && type !== 'horizontal') {
    throw invalid('invalid-config', `${path}.type`, type)
  }
  if (typeof properties.compact !== 'function') {
    throw invalid('invalid-config', `${path}.compact`, properties.compact)
  }
  if (properties.allowOverlap !== undefined && typeof properties.allowOverlap !== 'boolean') {
    throw invalid('invalid-config', `${path}.allowOverlap`, properties.allowOverlap)
  }

  const compact = properties.compact as (layout: ReadonlyLayout, cols: number) => Layout
  return {
    ...(type === undefined ? {} : { type }),
    compact,
    ...(properties.allowOverlap === undefined
      ? {}
      : { allowOverlap: properties.allowOverlap as boolean }),
  }
}

export function snapshotPositionStrategy(
  value: unknown,
  path = 'config.positionStrategy',
): PositionStrategy {
  const properties = readPlainDataObject(value, {
    code: 'invalid-config',
    path,
    allowedKeys: ['usesCssTransforms', 'transformScale', 'getStyle', 'getRtlStyle'],
    requiredKeys: ['usesCssTransforms', 'getStyle', 'getRtlStyle'],
  })

  assertBoolean(properties.usesCssTransforms, `${path}.usesCssTransforms`)
  if (
    properties.transformScale !== undefined &&
    (typeof properties.transformScale !== 'number' ||
      !Number.isFinite(properties.transformScale) ||
      properties.transformScale <= 0)
  ) {
    throw invalid('invalid-config', `${path}.transformScale`, properties.transformScale)
  }
  if (typeof properties.getStyle !== 'function') {
    throw invalid('invalid-config', `${path}.getStyle`, properties.getStyle)
  }
  if (typeof properties.getRtlStyle !== 'function') {
    throw invalid('invalid-config', `${path}.getRtlStyle`, properties.getRtlStyle)
  }

  return Object.freeze({
    usesCssTransforms: properties.usesCssTransforms,
    ...(properties.transformScale === undefined
      ? {}
      : { transformScale: properties.transformScale as number }),
    getStyle: properties.getStyle as PositionStrategy['getStyle'],
    getRtlStyle: properties.getRtlStyle as PositionStrategy['getRtlStyle'],
  })
}

function snapshotDropItemShape(
  value: unknown,
  path: string,
  unwrap: (value: unknown) => unknown,
): Readonly<{ w: number; h: number }> {
  const properties = readPlainDataObject(unwrap(value), {
    code: 'invalid-config',
    path,
    allowedKeys: ['w', 'h'],
    requiredKeys: ['w', 'h'],
  })
  assertPositiveSafeInteger(properties.w, `${path}.w`)
  assertPositiveSafeInteger(properties.h, `${path}.h`)
  return Object.freeze({ w: properties.w, h: properties.h })
}

/** 对 grouped DropConfig 做 descriptor-safe shape snapshot。 */
export function snapshotDropConfig(
  value: unknown,
  unwrap: (value: unknown) => unknown = input => input,
  path = 'config.dropConfig',
): DropConfigSnapshot {
  if (value === undefined) return Object.freeze({})
  const properties = readPlainDataObject(unwrap(value), {
    code: 'invalid-config',
    path,
    allowedKeys: ['isDroppable', 'dropItem', 'onDragOver'],
  })
  if (properties.isDroppable !== undefined && typeof properties.isDroppable !== 'boolean') {
    throw invalid('invalid-config', `${path}.isDroppable`, properties.isDroppable)
  }
  if (properties.onDragOver !== undefined && typeof properties.onDragOver !== 'function') {
    throw invalid('invalid-config', `${path}.onDragOver`, properties.onDragOver)
  }
  const dropItem =
    properties.dropItem === undefined
      ? undefined
      : snapshotDropItemShape(properties.dropItem, `${path}.dropItem`, unwrap)
  return Object.freeze({
    ...(properties.isDroppable === undefined ? {} : { isDroppable: properties.isDroppable }),
    ...(dropItem === undefined ? {} : { dropItem }),
    ...(properties.onDragOver === undefined
      ? {}
      : { onDragOver: properties.onDragOver as (...args: unknown[]) => unknown }),
  })
}

/** 对 onDragOver 返回值做 descriptor-safe extension snapshot。 */
export function snapshotDropResult(
  value: unknown,
  unwrap: (value: unknown) => unknown = input => input,
): Readonly<{ w?: number; h?: number }> {
  let properties: DataProperties
  try {
    properties = readPlainDataObject(unwrap(value), {
      code: 'invalid-config',
      path: 'dropResult',
      allowedKeys: ['w', 'h'],
    })
  } catch (error) {
    const validation = error instanceof GridLayoutValidationError ? error : null
    throw new GridLayoutExtensionError('Invalid drop callback result', {
      code: 'extension-invalid-result',
      source: 'drop-config',
      path: validation?.path ?? 'dropResult',
      cause: validation?.cause ?? error,
    })
  }

  for (const key of ['w', 'h'] as const) {
    const candidate = properties[key]
    if (
      candidate !== undefined &&
      (typeof candidate !== 'number' || !Number.isSafeInteger(candidate) || candidate <= 0)
    ) {
      throw new GridLayoutExtensionError('Invalid drop callback size', {
        code: 'extension-invalid-result',
        source: 'drop-config',
        path: `dropResult.${key}`,
        cause: candidate,
      })
    }
  }
  return Object.freeze({
    ...(properties.w === undefined ? {} : { w: properties.w as number }),
    ...(properties.h === undefined ? {} : { h: properties.h as number }),
  })
}
