import { describe, expect, it } from 'vitest'

import { hasAnyCollision } from '../src/core/collision-sweep'
import { collides } from '../src/helpers/common'

import type { Layout } from '../src'

function naive(layout: Layout): boolean {
  for (let i = 0; i < layout.length; i++) {
    for (let j = 0; j < i; j++) if (collides(layout[i], layout[j])) return true
  }
  return false
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32
}

describe('hasAnyCollision', () => {
  it('在 3000 个随机布局上与逐对检查结果一致', () => {
    for (let seed = 1; seed <= 3000; seed++) {
      const r = rng(seed)
      const cols = 1 + Math.floor(r() * 36)
      const layout = Array.from({ length: Math.floor(r() * 60) }, (_, i) => {
        const w = 1 + Math.floor(r() * cols)
        return {
          i,
          x: Math.floor(r() * (cols - w + 1)),
          y: Math.floor(r() * 50),
          w,
          h: 1 + Math.floor(r() * 6),
        }
      })
      expect(hasAnyCollision(layout), `seed ${seed}`).toBe(naive(layout))
    }
  })

  it('边缘相接不算碰撞', () => {
    expect(
      hasAnyCollision([
        { i: 1, x: 0, y: 0, w: 2, h: 2 },
        { i: 2, x: 2, y: 0, w: 2, h: 2 },
        { i: 3, x: 0, y: 2, w: 2, h: 2 },
      ]),
    ).toBe(false)
  })

  it('与逐对检查一致，忽略 id 相同的元素', () => {
    expect(
      hasAnyCollision([
        { i: 'a', x: 0, y: 0, w: 2, h: 2 },
        { i: 'a', x: 0, y: 0, w: 2, h: 2 },
      ]),
    ).toBe(false)
  })

  it('1000 个元素纵向堆叠的移动端布局仍然很快', () => {
    let y = 0
    const layout = Array.from({ length: 1000 }, (_, i) => {
      const h = 1 + (i % 7)
      const item = { i, x: 0, y, w: 12, h }
      y += h
      return item
    })
    const start = performance.now()
    for (let k = 0; k < 20; k++) hasAnyCollision(layout)
    expect((performance.now() - start) / 20).toBeLessThan(2)
  })
})
