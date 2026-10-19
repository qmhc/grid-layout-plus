/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'

import {
  createLayoutEngine,
  createNormalizedLayoutEngine,
  defaultInternalConfig,
} from '../src/core/layout-engine'
import { verticalCompactor } from '../src/core/compactors'
import { cloneLayout, isSealedLayout, sealLayout } from '../src/helpers/common'

import type { InternalEffectiveConfig } from '../src/core/layout-engine'
import type { Layout } from '../src/helpers/types'

const ITEMS = 60

function config(): InternalEffectiveConfig {
  return { ...defaultInternalConfig, cols: 12, compactor: verticalCompactor, collisionMode: 'push' }
}

function grid(): Layout {
  return Array.from({ length: ITEMS }, (_, index) => ({
    i: `n${index}`,
    x: (index % 6) * 2,
    y: Math.floor(index / 6) * 2,
    w: 2,
    h: 2,
    meta: { tags: ['a', { deep: index }] },
  }))
}

function isDeepFrozen(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return true
  if (!Object.isFrozen(value)) return false
  return Object.values(value).every(isDeepFrozen)
}

function isAnyFrozen(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  if (Object.isFrozen(value) && !(Array.isArray(value) && value.every(v => typeof v === 'string')))
    return true
  return Object.values(value).some(isAnyFrozen)
}

describe('封存布局的复制语义', () => {
  it('初始化和拖拽时保留显式 undefined 的 resizeHandles', () => {
    const initial: Layout = [{ i: 'item', x: 0, y: 0, w: 1, h: 1, resizeHandles: undefined }]
    const { engine, layout } = createNormalizedLayoutEngine(initial, config())
    expect(layout).toStrictEqual(initial)

    const started = engine.beginInteraction({ type: 'drag', id: 'item' })
    if (started.status !== 'accepted') throw new Error('drag rejected')
    expect(started.session.baseLayout).toStrictEqual(initial)

    const evaluation = engine.evaluateInteraction(started.session, { type: 'drag', x: 1, y: 0 })
    const confirmed = engine.confirm(evaluation)
    expect(confirmed.status).toBe('accepted')
    expect(confirmed.layout).toStrictEqual([{ ...initial[0], x: 1 }])
    engine.closeInteraction(started.session)
  })

  it('快速复制与校验克隆结果相同，且独立、可修改', () => {
    const engine = createLayoutEngine(grid(), config())
    const evaluation = engine.evaluate({ type: 'move', id: 'n0', x: 1, y: 0 })
    engine.confirm(evaluation)
    const copy = engine.rollback(engine.evaluate({ type: 'move', id: 'n1', x: 5, y: 0 }))

    expect(isSealedLayout(copy)).toBe(false)
    expect(isAnyFrozen(copy)).toBe(false)
    expect(copy).toEqual(cloneLayout(evaluation.result.layout))
    expect(copy.map(item => Object.keys(item))).toEqual(
      evaluation.result.layout.map(item => Object.keys(item)),
    )
    const meta = (copy[0] as unknown as { meta: { tags: unknown[] } }).meta
    meta.tags.push('mutated')
    const again = engine.rollback(engine.evaluate({ type: 'move', id: 'n1', x: 5, y: 0 }))
    expect((again[0] as unknown as { meta: { tags: unknown[] } }).meta.tags).toHaveLength(2)
  })

  it('被标记的布局总是深度冻结，其快速复制与校验克隆一致', () => {
    const metadata = Object.create(null) as Record<string, unknown>
    Object.defineProperty(metadata, '__proto__', {
      value: { nested: [1, 'x'] },
      enumerable: true,
      configurable: true,
      writable: true,
    })
    const source = [
      { i: 1, x: -0, y: 0, w: 1, h: 1, resizeHandles: ['se', 'n'], custom: metadata },
      { i: 'b', x: 2, y: 3, w: 2, h: 1, static: true, zIndex: -2, maxW: Infinity },
    ] as unknown as Layout
    const sealed = sealLayout(cloneLayout(source))
    expect(isSealedLayout(sealed)).toBe(true)
    expect(isDeepFrozen(sealed)).toBe(true)

    const fast = cloneLayout(sealed)
    const slow = cloneLayout(source)
    expect(fast).toEqual(slow)
    expect(fast.map(item => Object.keys(item))).toEqual(slow.map(item => Object.keys(item)))
    expect(Object.is(fast[0].x, 0)).toBe(true)
    expect(Object.isFrozen(fast[0].resizeHandles)).toBe(true)
    expect(fast[0].resizeHandles).not.toBe(sealed[0].resizeHandles)
    const custom = (fast[0] as unknown as { custom: Record<string, unknown> }).custom
    expect(Object.getPrototypeOf(custom)).toBeNull()
    expect(Object.keys(custom)).toEqual(['__proto__'])
    expect(Object.isFrozen(custom)).toBe(false)
    expect(isSealedLayout(fast)).toBe(false)
  })

  it('从不封存或冻结外部布局与对外载荷', () => {
    const external = grid()
    const engine = createLayoutEngine(external, config())
    expect(isSealedLayout(external)).toBe(false)
    expect(isAnyFrozen(external)).toBe(false)

    const evaluation = engine.evaluate({ type: 'move', id: 'n0', x: 1, y: 0 })
    const confirmed = engine.confirm(evaluation)
    const started = engine.beginInteraction({ type: 'drag', id: 'n2' })
    if (started.status !== 'accepted') throw new Error('drag rejected')
    const step = engine.evaluateInteraction(started.session, { type: 'drag', x: 0, y: 3 })
    engine.confirm(step)
    engine.closeInteraction(started.session)
    const merged = engine.mergeExternalMetadata(external)
    const replaced = engine.replaceExternal(grid(), config())

    for (const layout of [
      external,
      evaluation.result.layout,
      evaluation.result.previousLayout,
      confirmed.layout,
      started.session.baseLayout,
      step.result.layout,
      step.result.previousLayout,
      merged,
      replaced.layout,
      replaced.previousLayout,
    ]) {
      expect(isSealedLayout(layout)).toBe(false)
      expect(isAnyFrozen(layout)).toBe(false)
    }
    // 外部数组即使被库原样封存函数处理过的副本引用，也不会获得标记。
    expect(isDeepFrozen(external)).toBe(false)
  })
})
