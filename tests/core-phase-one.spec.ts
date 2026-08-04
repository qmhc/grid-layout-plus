/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'

import * as core from '../src/core'
import * as root from '../src/index'
import { noCompactor, withOverlap } from '../src/core/compactors'
import { GridLayoutExtensionError, GridLayoutValidationError } from '../src/core/errors'
import { normalizeLayout } from '../src/core/normalize'
import {
  bottom,
  cloneLayout,
  collides,
  compact,
  correctBounds,
  getAllCollisions,
  getFirstCollision,
  moveElement,
  sortLayoutItemsByRowCol,
  validateLayout,
} from '../src/helpers/common'

import type {
  Compactor,
  GridLayoutValidationCode,
  Layout,
  LayoutItem,
  ReadonlyLayout,
} from '../src/helpers/types'

function expectValidation(
  run: () => unknown,
  code: GridLayoutValidationCode,
  path: string,
): GridLayoutValidationError {
  let thrown: unknown
  try {
    run()
  } catch (error) {
    thrown = error
  }
  expect(thrown).toBeInstanceOf(GridLayoutValidationError)
  expect(thrown).toMatchObject({ code, path })
  return thrown as GridLayoutValidationError
}

function expectExtension(
  run: () => unknown,
  code: 'extension-error' | 'extension-invalid-result',
): GridLayoutExtensionError {
  let thrown: unknown
  try {
    run()
  } catch (error) {
    thrown = error
  }
  expect(thrown).toBeInstanceOf(GridLayoutExtensionError)
  expect(thrown).toMatchObject({
    code,
    source: 'compactor',
    path: null,
  })
  return thrown as GridLayoutExtensionError
}

function item(overrides: Partial<LayoutItem> = {}): LayoutItem {
  return {
    i: 'item',
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    ...overrides,
  }
}

describe('Phase 1 layout validation and snapshots', () => {
  it.each([
    ['x', Number.NaN],
    ['x', Infinity],
    ['x', -1],
    ['x', 0.5],
    ['x', Number.MAX_SAFE_INTEGER + 1],
    ['y', Number.NaN],
    ['y', -1],
    ['w', 0],
    ['w', -1],
    ['w', 1.5],
    ['h', 0],
    ['minW', 0],
    ['minW', 1.5],
    ['minH', Number.NaN],
    ['maxW', 0],
    ['maxH', -1],
  ] as const)('rejects invalid %s=%s with a stable path', (field, value) => {
    expectValidation(
      () => validateLayout([item({ [field]: value })]),
      'invalid-layout',
      `layout[0].${field}`,
    )
  })

  it.each([
    ['', 'empty string'],
    [Number.NaN, 'NaN'],
    [Infinity, 'Infinity'],
    [-0, 'negative zero'],
    [1.5, 'fraction'],
    [Number.MAX_SAFE_INTEGER + 1, 'unsafe integer'],
  ])('rejects invalid id %s (%s)', (invalidId, _label) => {
    expectValidation(
      () => validateLayout([item({ i: invalidId })]),
      'invalid-layout',
      'layout[0].i',
    )
  })

  it('accepts Infinity max sentinels and distinguishes numeric/string ids', () => {
    expect(() =>
      validateLayout([item({ i: 1, maxW: Infinity, maxH: Infinity }), item({ i: '1', x: 1 })]),
    ).not.toThrow()
  })

  it('rejects duplicate ids and invalid min/max relations', () => {
    expectValidation(
      () => validateLayout([item({ i: 'same' }), item({ i: 'same', x: 1 })]),
      'invalid-layout',
      'layout[1].i',
    )
    expectValidation(
      () => validateLayout([item({ minW: 3, maxW: 2 })]),
      'invalid-layout',
      'layout[0].minW',
    )
    expectValidation(
      () => validateLayout([item({ minH: 3, maxH: 2 })]),
      'invalid-layout',
      'layout[0].minH',
    )
  })

  it('deep-clones legal metadata, strips moved, and accepts frozen input', () => {
    const nested = Object.freeze({ tags: Object.freeze(['alpha', { score: 1 }]) })
    const source = Object.freeze([
      Object.freeze({
        ...item(),
        moved: true,
        metadata: nested,
      }),
    ]) as unknown as ReadonlyLayout

    const cloned = cloneLayout(source) as Array<LayoutItem & { metadata: typeof nested }>

    expect(cloned).not.toBe(source)
    expect(cloned[0]).not.toBe(source[0])
    expect(cloned[0]).not.toHaveProperty('moved')
    expect(cloned[0].metadata).not.toBe(nested)
    expect(cloned[0].metadata.tags).not.toBe(nested.tags)
    ;(cloned[0].metadata.tags[1] as { score: number }).score = 2
    expect((nested.tags[1] as { score: number }).score).toBe(1)
  })

  it('preserves own __proto__ metadata without changing output prototypes', () => {
    const nested = {}
    const nestedValue = { owner: 'nested' }
    Object.defineProperty(nested, '__proto__', {
      configurable: true,
      enumerable: true,
      value: nestedValue,
      writable: true,
    })

    const source = { ...item(), metadata: nested } as LayoutItem & Record<string, unknown>
    const itemValue = { owner: 'item' }
    Object.defineProperty(source, '__proto__', {
      configurable: true,
      enumerable: true,
      value: itemValue,
      writable: true,
    })

    const cloned = cloneLayout([source]) as Array<LayoutItem & Record<string, unknown>>
    const clonedMetadata = cloned[0].metadata as Record<string, unknown>

    expect(Object.getPrototypeOf(cloned[0])).toBe(Object.prototype)
    expect(Object.hasOwn(cloned[0], '__proto__')).toBe(true)
    expect(cloned[0].__proto__).toEqual(itemValue)
    expect(cloned[0].__proto__).not.toBe(itemValue)
    expect(Object.getPrototypeOf(clonedMetadata)).toBe(Object.prototype)
    expect(Object.hasOwn(clonedMetadata, '__proto__')).toBe(true)
    expect(clonedMetadata.__proto__).toEqual(nestedValue)
    expect(clonedMetadata.__proto__).not.toBe(nestedValue)
  })

  it('does not execute metadata accessors and preserves reflection causes', () => {
    let getterCalls = 0
    const accessorItem = item() as LayoutItem & Record<string, unknown>
    Object.defineProperty(accessorItem, 'metadata', {
      enumerable: true,
      get() {
        getterCalls++
        return 'not-read'
      },
    })

    expectValidation(() => validateLayout([accessorItem]), 'invalid-layout', 'layout[0].metadata')
    expect(getterCalls).toBe(0)

    const cause = new Error('reflection failed')
    const metadata = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw cause
        },
      },
    )
    const error = expectValidation(
      () => validateLayout([{ ...item(), metadata } as LayoutItem]),
      'invalid-layout',
      'layout[0].metadata',
    )
    expect(error.cause).toBe(cause)
  })
})

describe('Phase 1 stable queries', () => {
  const first = Object.freeze(item({ i: 'first', x: 0, y: 0 }))
  const second = Object.freeze(item({ i: 'second', x: 0, y: 0 }))
  const third = Object.freeze(item({ i: 'third', x: 2, y: 0 }))
  const layout = Object.freeze([first, second, third]) as ReadonlyLayout

  it('returns original readonly references in original collision order', () => {
    const query = item({ i: 'query', x: 0, y: 0 })
    const all = getAllCollisions(layout, query)
    expect(all).toEqual([first, second])
    expect(all[0]).toBe(first)
    expect(all[1]).toBe(second)
    expect(getFirstCollision(layout, query)).toBe(first)
  })

  it('sorts y then x then original index without cloning items', () => {
    const sorted = sortLayoutItemsByRowCol([
      item({ i: 'a', x: 1, y: 1 }),
      item({ i: 'b', x: 0, y: 1 }),
      item({ i: 'c', x: 0, y: 1 }),
      item({ i: 'd', x: 0, y: 0 }),
    ])
    expect(sorted.map(entry => entry.i)).toEqual(['d', 'b', 'c', 'a'])
  })

  it('uses logical id identity before half-open rectangle geometry', () => {
    expect(collides(first, { ...first })).toBe(false)
    expect(collides(first, second)).toBe(true)
    expect(collides(item({ i: 'left', x: 0, w: 1 }), item({ i: 'right', x: 1, w: 1 }))).toBe(false)
  })

  it('validates query input before reading derived geometry', () => {
    expectValidation(
      () => bottom([{ ...item(), y: Number.MAX_SAFE_INTEGER }]),
      'invalid-layout',
      'layout[0].h',
    )
    expectValidation(
      () => getAllCollisions([item({ x: Number.MAX_SAFE_INTEGER })], item({ i: 'query' })),
      'invalid-layout',
      'layout[0].w',
    )
  })
})

describe('Phase 1 compact and immutable positional APIs', () => {
  it('compacts huge y by obstacle boundaries rather than row-by-row scanning', () => {
    const source = Object.freeze([
      Object.freeze(item({ y: Number.MAX_SAFE_INTEGER - 1 })),
    ]) as ReadonlyLayout
    expect(compact(source)).toEqual([item({ y: 0 })])
    expect(source[0].y).toBe(Number.MAX_SAFE_INTEGER - 1)
  }, 100)

  it('supports verticalCompact=false with and without typed-id Map bounds', () => {
    const collisions: Layout = [item({ i: 'first', y: 0, h: 2 }), item({ i: 'second', y: 0 })]
    expect(compact(collisions, false)[1].y).toBe(2)

    const typedIds: Layout = [item({ i: 1, x: 0, y: 8 }), item({ i: '1', x: 2, y: 8 })]
    const minPositions = new Map<string | number, Readonly<{ y: number }>>([
      [1, { y: 2 }],
      ['1', { y: 5 }],
    ])
    const compacted = compact(typedIds, false, minPositions)
    expect(compacted.map(entry => entry.y)).toEqual([2, 5])
    expect(minPositions.get(1)?.y).toBe(2)
    expect(minPositions.get('1')?.y).toBe(5)
  })

  it('rejects invalid minPositions with typed paths', () => {
    const layout = [item({ i: 1, y: 5 })]
    expectValidation(
      () => compact(layout, true, new Map([[1, { y: 0 }]])),
      'invalid-config',
      'minPositions',
    )
    expectValidation(
      () => compact(layout, false, new Map([[2, { y: 0 }]])),
      'invalid-config',
      'minPositions["number:2"]',
    )
    expectValidation(
      () => compact(layout, false, new Map([[1, { y: 6 }]])),
      'invalid-config',
      'minPositions["number:1"].y',
    )
    expectValidation(
      () => compact(layout, false, new Map([[1, { y: 0, x: 0 }]]) as never),
      'invalid-config',
      'minPositions["number:1"].x',
    )
    expectValidation(
      () => compact(layout, false, new Proxy(new Map([[1, { y: 0 }]]), {})),
      'invalid-config',
      'minPositions',
    )

    let toJsonCalls = 0
    const hostileKey = {
      toJSON() {
        toJsonCalls++
        throw new Error('must not execute')
      },
    }
    expectValidation(
      () => compact(layout, false, new Map([[1n, { y: 0 }]]) as never),
      'invalid-config',
      'minPositions',
    )
    expectValidation(
      () => compact(layout, false, new Map([[hostileKey, { y: 0 }]]) as never),
      'invalid-config',
      'minPositions',
    )
    expect(toJsonCalls).toBe(0)
  })

  it('correctBounds and moveElement return detached layouts without input mutation', () => {
    const metadata = Object.freeze({ owner: 'core' })
    const source = Object.freeze([
      Object.freeze({ ...item({ i: 'a', x: -2 }), metadata }),
      Object.freeze(item({ i: 'b', x: 1 })),
    ]) as unknown as ReadonlyLayout

    const bounded = correctBounds(source, Object.freeze({ cols: 4 }))
    expect(bounded[0]).toMatchObject({ x: 0, w: 4 })
    expect(source[0].x).toBe(-2)
    expect((bounded[0] as LayoutItem & { metadata: object }).metadata).not.toBe(metadata)

    const movable = Object.freeze([
      Object.freeze(item({ i: 'a', x: 0 })),
      Object.freeze(item({ i: 'b', x: 1 })),
    ]) as ReadonlyLayout
    const moved = moveElement(movable, { ...movable[0] }, 1, 0)
    expect(moved).toEqual([item({ i: 'a', x: 1 }), item({ i: 'b', x: 1, y: 1 })])
    expect(movable[0].x).toBe(0)
    expect(moved.some(entry => Object.hasOwn(entry, 'moved'))).toBe(false)
  })

  it('rejects vertical extent overflow in correctBounds for non-static items', () => {
    expectValidation(
      () => correctBounds([item({ y: Number.MAX_SAFE_INTEGER })], { cols: 4 }),
      'invalid-layout',
      'layout[0].h',
    )
  })

  it('returns detached unchanged layouts for static and prevent paths', () => {
    const staticLayout = [item({ static: true })]
    const staticResult = moveElement(staticLayout, staticLayout[0], 2, 2)
    expect(staticResult).toEqual([item({ static: true })])
    expect(staticResult).not.toBe(staticLayout)
    expect(staticResult[0]).not.toBe(staticLayout[0])

    const collisionLayout = [item({ i: 'a', x: 0 }), item({ i: 'b', x: 1 })]
    const prevented = moveElement(collisionLayout, collisionLayout[0], 1, 0, undefined, true)
    expect(prevented).toEqual(collisionLayout)
    expect(prevented).not.toBe(collisionLayout)
  })

  it('rejects derived safe-integer overflow during move propagation', () => {
    expectValidation(
      () =>
        moveElement(
          [item({ i: 'active' }), item({ i: 'blocker', x: Number.MAX_SAFE_INTEGER - 1 })],
          item({ i: 'active' }),
          Number.MAX_SAFE_INTEGER - 1,
          0,
          false,
          false,
          'horizontal',
        ),
      'invalid-layout',
      'layout[1].w',
    )
  })
})

describe('Phase 1 normalizeLayout and Compactor boundary', () => {
  it('validates Layout before reflecting config or Compactor values', () => {
    let configReflectionCalls = 0
    const config = new Proxy(
      {},
      {
        ownKeys() {
          configReflectionCalls++
          throw new Error('config reflection must not run')
        },
      },
    )

    expectValidation(
      () => normalizeLayout([item({ w: 0 })], config as never),
      'invalid-layout',
      'layout[0].w',
    )
    expect(configReflectionCalls).toBe(0)

    let compactorReflectionCalls = 0
    const compactor = new Proxy(
      {},
      {
        ownKeys() {
          compactorReflectionCalls++
          throw new Error('compactor reflection must not run')
        },
      },
    )
    expectValidation(
      () => normalizeLayout([item({ minW: 2, maxW: 1 })], { cols: 0, compactor } as never),
      'invalid-layout',
      'layout[0].minW',
    )
    expect(compactorReflectionCalls).toBe(0)
  })

  it('normalizes min/max, cols and maxRows in the fixed order', () => {
    const result = normalizeLayout(
      [
        item({
          x: 10,
          y: 10,
          w: 8,
          h: 8,
          minW: 2,
          minH: 2,
          maxW: 6,
          maxH: 7,
        }),
      ],
      { cols: 4, maxRows: 5, collisionMode: 'overlap' },
    )
    expect(result[0]).toMatchObject({ x: 0, y: 0, w: 4, h: 5 })
  })

  it('implements overlap, prevent, and static-first push deterministically', () => {
    const overlapping = [
      item({ i: 'moving', x: 0, y: 0 }),
      item({ i: 'static', x: 0, y: 0, static: true }),
    ]
    expect(normalizeLayout(overlapping, { cols: 2, collisionMode: 'overlap' })).toEqual(overlapping)
    expectValidation(
      () => normalizeLayout(overlapping, { cols: 2, collisionMode: 'prevent' }),
      'invalid-layout',
      'layout[1]',
    )
    expect(
      normalizeLayout(overlapping, {
        cols: 2,
        collisionMode: 'push',
        compactor: noCompactor,
      }),
    ).toEqual([item({ i: 'moving', x: 0, y: 1 }), item({ i: 'static', x: 0, y: 0, static: true })])
  })

  it('runs custom Compactor only after built-in placement removes collisions', () => {
    let received: Layout | undefined
    const compactor: Compactor = {
      type: 'vertical',
      compact(layout) {
        received = layout.map(entry => ({ ...entry }))
        return layout.map(entry => ({ ...entry }))
      },
    }
    const result = normalizeLayout([item({ i: 'a', y: 0 }), item({ i: 'b', y: 0 })], {
      cols: 2,
      compactor,
    })

    expect(received).toBeDefined()
    expect(collides(received![0], received![1])).toBe(false)
    expect(result).toEqual(received)
    expect(result).not.toBe(received)
  })

  it('maps extension throws and invalid results without leaking partial state', () => {
    const cause = new Error('custom failure')
    const thrown = expectExtension(
      () =>
        normalizeLayout([item()], {
          cols: 2,
          compactor: {
            compact() {
              throw cause
            },
          },
        }),
      'extension-error',
    )
    expect(thrown.cause).toBe(cause)

    const invalidResult = [{ ...item(), w: 0 }]
    const invalid = expectExtension(
      () =>
        normalizeLayout([item()], {
          cols: 2,
          compactor: {
            compact() {
              return invalidResult
            },
          },
        }),
      'extension-invalid-result',
    )
    expect(invalid.cause).toBe(invalidResult)

    expectExtension(
      () =>
        normalizeLayout([item()], {
          cols: 2,
          compactor: {
            compact(layout) {
              ;(layout as Layout)[0].x = 1
              return layout.map(entry => ({ ...entry }))
            },
          },
        }),
      'extension-invalid-result',
    )
  })

  it('rejects every invalid Compactor shape before compact is called', () => {
    let getterCalls = 0
    const accessor = {}
    Object.defineProperty(accessor, 'compact', {
      enumerable: true,
      get() {
        getterCalls++
        return () => []
      },
    })
    const nonEnumerable = {}
    Object.defineProperty(nonEnumerable, 'compact', {
      enumerable: false,
      value: () => [],
    })
    const symbol = Symbol('extra')
    const reflectionCause = new Error('ownKeys failed')

    const cases: Array<readonly [unknown, string]> = [
      [null, 'config.compactor'],
      [Object.assign(Object.create({}), { compact: () => [] }), 'config.compactor'],
      [{ compact: () => [], extra: true }, 'config.compactor.extra'],
      [{ [symbol]: true, compact: () => [] }, 'config.compactor.<symbol>'],
      [accessor, 'config.compactor.compact'],
      [nonEnumerable, 'config.compactor.compact'],
      [{}, 'config.compactor.compact'],
      [{ compact: () => [], type: 'diagonal' }, 'config.compactor.type'],
      [{ compact: () => [], allowOverlap: 1 }, 'config.compactor.allowOverlap'],
      [
        new Proxy(
          {},
          {
            ownKeys() {
              throw reflectionCause
            },
          },
        ),
        'config.compactor',
      ],
    ]

    for (const [compactor, path] of cases) {
      expectValidation(
        () => normalizeLayout([item()], { cols: 2, compactor: compactor as Compactor }),
        'invalid-config',
        path,
      )
    }
    expect(getterCalls).toBe(0)

    const proxyError = expectValidation(
      () =>
        normalizeLayout([item()], {
          cols: 2,
          compactor: cases.at(-1)![0] as Compactor,
        }),
      'invalid-config',
      'config.compactor',
    )
    expect(proxyError.cause).toBe(reflectionCause)
  })

  it('validates withOverlap input at wrapper creation', () => {
    expectValidation(
      () => withOverlap({ compact: null } as never),
      'invalid-config',
      'config.compactor.compact',
    )
  })
})

describe('Phase 1 root/core export identity', () => {
  it('shares error constructors and exposes stable native error fields', () => {
    expect(root.GridLayoutValidationError).toBe(core.GridLayoutValidationError)
    expect(root.GridLayoutExtensionError).toBe(core.GridLayoutExtensionError)
    const validationCause = { field: 'x' }
    const validation = new root.GridLayoutValidationError('invalid', {
      code: 'invalid-layout',
      path: 'layout[0].x',
      cause: validationCause,
    })
    expect(validation).toBeInstanceOf(TypeError)
    expect(validation).toMatchObject({
      name: 'GridLayoutValidationError',
      code: 'invalid-layout',
      path: 'layout[0].x',
      cause: validationCause,
    })

    const extensionCause = new Error('cause')
    const extension = new core.GridLayoutExtensionError('extension', {
      code: 'extension-error',
      source: 'compactor',
      cause: extensionCause,
    })
    expect(extension).toBeInstanceOf(Error)
    expect(extension).toMatchObject({
      name: 'GridLayoutExtensionError',
      code: 'extension-error',
      source: 'compactor',
      path: null,
      cause: extensionCause,
    })
  })
})
