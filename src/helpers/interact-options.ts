import { GridLayoutValidationError } from '../core/errors'

export type InteractOptionName = 'dragOption' | 'resizeOption'

const COMMON_KEYS = new Set(['mouseButtons', 'hold', 'autoScroll'])
const DRAG_KEYS = new Set(['lockAxis', 'startAxis', ...COMMON_KEYS])

function invalidOption(path: string, cause: unknown): never {
  throw new GridLayoutValidationError(`Invalid GridItem interaction option at ${path}`, {
    code: 'invalid-config',
    path,
    cause,
  })
}

function optionPath(name: InteractOptionName, key?: PropertyKey): string {
  if (key === undefined) return `gridItem.${name}`
  return typeof key === 'symbol'
    ? `gridItem.${name}.<symbol>`
    : `gridItem.${name}[${JSON.stringify(key)}]`
}

function isAllowedValue(name: InteractOptionName, key: string, value: unknown): boolean {
  if (key === 'lockAxis') {
    return name === 'dragOption' && ['x', 'y', 'xy', 'start'].includes(value as string)
  }
  if (key === 'startAxis') {
    return name === 'dragOption' && ['x', 'y', 'xy'].includes(value as string)
  }
  if (key === 'mouseButtons') return Number.isSafeInteger(value) && (value as number) >= 0
  if (key === 'hold') return typeof value === 'number' && Number.isFinite(value) && value >= 0
  if (key === 'autoScroll') return typeof value === 'boolean'
  return false
}

/** 对传给 interactjs 的有限配置做 descriptor-safe 原子快照。 */
export function snapshotInteractOption(
  input: unknown,
  name: InteractOptionName,
): Readonly<Record<string, unknown>> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return invalidOption(optionPath(name), { reason: 'not-plain-object', value: input })
  }

  let prototype: object | null
  let keys: PropertyKey[]
  try {
    prototype = Object.getPrototypeOf(input)
    keys = Reflect.ownKeys(input)
  } catch (cause) {
    return invalidOption(optionPath(name), cause)
  }
  if (prototype !== Object.prototype && prototype !== null) {
    return invalidOption(optionPath(name), { reason: 'custom-prototype', prototype })
  }

  const allowed = name === 'dragOption' ? DRAG_KEYS : COMMON_KEYS
  const snapshot = Object.create(null) as Record<string, unknown>
  for (const key of keys) {
    const path = optionPath(name, key)
    if (typeof key !== 'string' || !allowed.has(key)) {
      return invalidOption(path, { key })
    }

    let descriptor: PropertyDescriptor | undefined
    try {
      descriptor = Object.getOwnPropertyDescriptor(input, key)
    } catch (cause) {
      return invalidOption(path, cause)
    }
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
      return invalidOption(path, { reason: 'invalid-descriptor', descriptor })
    }
    if (!isAllowedValue(name, key, descriptor.value)) {
      return invalidOption(path, { reason: 'invalid-value', value: descriptor.value })
    }
    snapshot[key] = descriptor.value
  }
  return Object.freeze(snapshot)
}

/** 校验并快照 GridItem 的 CSS selector 配置。 */
export function snapshotInteractSelector(input: unknown, prop: string): string | undefined {
  const path = `gridItem.${prop}`
  if (input === undefined || input === '') return undefined
  if (typeof input !== 'string') {
    throw new GridLayoutValidationError(`Invalid GridItem selector at ${path}`, {
      code: 'invalid-config',
      path,
      cause: { reason: 'invalid-selector-type', value: input },
    })
  }
  if (typeof document !== 'undefined') {
    try {
      document.documentElement.matches(input)
    } catch (cause) {
      throw new GridLayoutValidationError(`Invalid GridItem selector at ${path}`, {
        code: 'invalid-config',
        path,
        cause,
      })
    }
  }
  return input
}
