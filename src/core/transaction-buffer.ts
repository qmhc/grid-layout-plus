import type { LayoutItem, ReadonlyLayout } from '../helpers/types'

export const MAX_SUPERSEDED_SIGNATURES = 1024
const SIGNATURE_CODE_UNITS = 32
export const MAX_SUPERSEDED_CODE_UNITS = MAX_SUPERSEDED_SIGNATURES * SIGNATURE_CODE_UNITS
const NUMBER_VIEW = new DataView(new ArrayBuffer(8))

function fingerprint128(layout: ReadonlyLayout): string {
  let first = 1779033703
  let second = 3144134277
  let third = 1013904242
  let fourth = 2773480762

  const mix = (value: number) => {
    first = Math.imul(first ^ value, 2246822507)
    second = Math.imul(second ^ value, 3266489909)
    third = Math.imul(third ^ value, 668265263)
    fourth = Math.imul(fourth ^ value, 374761393)
  }
  const mixNumber = (value: number) => {
    NUMBER_VIEW.setFloat64(0, value, true)
    mix(NUMBER_VIEW.getUint32(0, true))
    mix(NUMBER_VIEW.getUint32(4, true))
  }
  const mixOptionalBoolean = (value: boolean | undefined) => {
    mix(value === undefined ? 0 : value ? 2 : 1)
  }

  mix(0x676c7031)
  mix(layout.length)
  for (const item of layout) {
    if (typeof item.i === 'number') {
      mix(1)
      mixNumber(item.i)
    } else {
      mix(2)
      mix(item.i.length)
      for (let index = 0; index < item.i.length; index++) {
        mix(item.i.charCodeAt(index))
      }
    }
    mixNumber(item.x)
    mixNumber(item.y)
    mixNumber(item.w)
    mixNumber(item.h)
    mixNumber(item.minW ?? 1)
    mixNumber(item.minH ?? 1)
    mixNumber(item.maxW ?? Infinity)
    mixNumber(item.maxH ?? Infinity)
    mix(item.static ? 1 : 0)
    mixOptionalBoolean(item.isDraggable)
    mixOptionalBoolean(item.isResizable)
    mixNumber(item.zIndex ?? 0)
  }

  const avalanche = (value: number) => {
    value ^= value >>> 16
    value = Math.imul(value, 2246822507)
    value ^= value >>> 13
    value = Math.imul(value, 3266489909)
    return value ^ (value >>> 16)
  }
  first = avalanche(first ^ fourth)
  second = avalanche(second ^ first)
  third = avalanche(third ^ second)
  fourth = avalanche(fourth ^ third)
  return [first, second, third, fourth]
    .map(value => (value >>> 0).toString(16).padStart(8, '0'))
    .join('')
}

type LayoutGeometrySignature = string & {
  readonly __brand: 'LayoutGeometrySignature'
}

/** 只编码参与受控确认的规范字段，忽略 metadata 和临时 moved 字段。 */
export function layoutGeometrySignature(layout: ReadonlyLayout): LayoutGeometrySignature {
  return fingerprint128(layout) as LayoutGeometrySignature
}

/** 固定容量的 superseded signature 环形缓存。 */
export class SupersededLayoutCache {
  readonly #entries: Array<LayoutGeometrySignature | undefined>
  readonly #counts = new Map<LayoutGeometrySignature, number>()
  #head = 0
  #size = 0
  #retainedCodeUnits = 0

  constructor(
    readonly limit = MAX_SUPERSEDED_SIGNATURES,
    readonly codeUnitLimit = MAX_SUPERSEDED_CODE_UNITS,
  ) {
    if (!Number.isSafeInteger(limit) || limit <= 0) {
      throw new TypeError('SupersededLayoutCache limit must be a positive safe integer')
    }
    if (!Number.isSafeInteger(codeUnitLimit) || codeUnitLimit < SIGNATURE_CODE_UNITS) {
      throw new TypeError(
        `SupersededLayoutCache codeUnitLimit must be at least ${SIGNATURE_CODE_UNITS}`,
      )
    }
    this.#entries = Array(limit)
  }

  get size(): number {
    return this.#size
  }

  get retainedCodeUnits(): number {
    return this.#retainedCodeUnits
  }

  #evictOldest(): void {
    const evicted = this.#entries[this.#head]!
    this.#entries[this.#head] = undefined
    this.#head = (this.#head + 1) % this.limit
    this.#size -= 1
    this.#retainedCodeUnits -= evicted.length
    const count = this.#counts.get(evicted)!
    if (count === 1) this.#counts.delete(evicted)
    else this.#counts.set(evicted, count - 1)
  }

  remember(layout: ReadonlyLayout): void {
    const signature = layoutGeometrySignature(layout)
    while (
      this.#size > 0 &&
      (this.#size >= this.limit || this.#retainedCodeUnits + signature.length > this.codeUnitLimit)
    ) {
      this.#evictOldest()
    }

    const nextIndex = (this.#head + this.#size) % this.limit
    this.#entries[nextIndex] = signature
    this.#counts.set(signature, (this.#counts.get(signature) ?? 0) + 1)
    this.#size += 1
    this.#retainedCodeUnits += signature.length
  }

  has(layout: ReadonlyLayout): boolean {
    return this.#counts.has(layoutGeometrySignature(layout))
  }

  clear(): void {
    this.#entries.fill(undefined)
    this.#counts.clear()
    this.#head = 0
    this.#size = 0
    this.#retainedCodeUnits = 0
  }
}

export interface InteractionProposal {
  type: 'drag' | 'resize'
  id: LayoutItem['i']
  value: { x: number; y: number } | { w: number; h: number }
  nativeEvent: Event | null
}

/** 同一 animation frame 只保留最新的交互 candidate。 */
export class LatestInteractionProposal {
  #value: InteractionProposal | null = null

  get pending(): boolean {
    return this.#value !== null
  }

  replace(value: InteractionProposal): void {
    this.#value = value
  }

  take(): InteractionProposal | null {
    const value = this.#value
    this.#value = null
    return value
  }

  clear(): void {
    this.#value = null
  }
}

export interface InteractionTransactionBufferSnapshot {
  readonly pendingProposal: boolean
  readonly supersededCount: number
  readonly retainedCodeUnits: number
}

/** GridLayout adapter 与 benchmark 共用的交互事务资源生命周期。 */
export class InteractionTransactionBuffer {
  readonly #proposals = new LatestInteractionProposal()
  readonly #superseded = new SupersededLayoutCache()

  replaceProposal(value: InteractionProposal): void {
    this.#proposals.replace(value)
  }

  takeProposal(): InteractionProposal | null {
    return this.#proposals.take()
  }

  clearProposal(): void {
    this.#proposals.clear()
  }

  rememberSuperseded(layout: ReadonlyLayout): void {
    this.#superseded.remember(layout)
  }

  hasSuperseded(layout: ReadonlyLayout): boolean {
    return this.#superseded.has(layout)
  }

  clearSuperseded(): void {
    this.#superseded.clear()
  }

  finishTerminal(): void {
    this.#proposals.clear()
    this.#superseded.clear()
  }

  snapshot(): Readonly<InteractionTransactionBufferSnapshot> {
    return Object.freeze({
      pendingProposal: this.#proposals.pending,
      supersededCount: this.#superseded.size,
      retainedCodeUnits: this.#superseded.retainedCodeUnits,
    })
  }
}
