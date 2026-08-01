/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'

import {
  fastHorizontalCompactor,
  fastVerticalCompactor,
  horizontalCompactor,
  noCompactor,
  verticalCompactor,
  withOverlap,
} from '../src/core/compactors'

import { cloneLayout, compact } from '../src/helpers/common'

import type { Layout } from '../src/helpers/types'

// ─── 辅助工具 ───────────────────────────────────────────────

/** 提取布局中每个元素的核心位置信息，用于比较 */
function positions(layout: Layout) {
  return layout.map(l => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h }))
}

// ─── verticalCompactor ──────────────────────────────────────

describe('verticalCompactor', () => {
  it.each([verticalCompactor, fastVerticalCompactor])(
    '极大合法 y 不按行扫描',
    compactor => {
      const layout: Layout = [{ i: 'large-y', x: 0, y: Number.MAX_SAFE_INTEGER - 1, w: 1, h: 1 }]
      expect(compactor.compact(layout, 4)[0].y).toBe(0)
    },
    100,
  )

  it('与 compact(layout, true) 输出一致 — 空布局', () => {
    const layout: Layout = []
    expect(verticalCompactor.compact(layout, 12)).toEqual(compact(cloneLayout(layout), true))
  })

  it('与 compact(layout, true) 输出一致 — 单元素有空隙', () => {
    const layout: Layout = [{ i: '1', x: 0, y: 5, w: 1, h: 1 }]
    expect(positions(verticalCompactor.compact(layout, 12))).toEqual(
      positions(compact(cloneLayout(layout), true)),
    )
  })

  it('与 compact(layout, true) 输出一致 — 多元素碰撞', () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 2, h: 5 },
      { i: '2', x: 0, y: 0, w: 10, h: 1 },
      { i: '3', x: 5, y: 1, w: 1, h: 1 },
      { i: '4', x: 5, y: 2, w: 1, h: 1 },
      { i: '5', x: 5, y: 3, w: 1, h: 1, static: true },
    ]
    expect(positions(verticalCompactor.compact(layout, 12))).toEqual(
      positions(compact(cloneLayout(layout), true)),
    )
  })

  it('与 compact(layout, true) 输出一致 — 含静态元素', () => {
    const layout: Layout = [
      { i: 'a', x: 0, y: 0, w: 1, h: 1, static: true },
      { i: 'b', x: 0, y: 5, w: 1, h: 1 },
      { i: 'c', x: 1, y: 3, w: 1, h: 2 },
    ]
    expect(positions(verticalCompactor.compact(layout, 12))).toEqual(
      positions(compact(cloneLayout(layout), true)),
    )
  })

  it('不修改输入布局', () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 5, w: 1, h: 1 },
      { i: '2', x: 1, y: 3, w: 1, h: 1 },
    ]
    const original = JSON.parse(JSON.stringify(layout))
    verticalCompactor.compact(layout, 12)
    expect(layout).toEqual(original)
  })
})

// ─── horizontalCompactor ────────────────────────────────────

describe('horizontalCompactor', () => {
  it('将元素向左压缩消除水平空隙', () => {
    const layout: Layout = [
      { i: '1', x: 5, y: 0, w: 1, h: 1 },
      { i: '2', x: 8, y: 1, w: 2, h: 1 },
    ]
    const result = horizontalCompactor.compact(layout, 12)
    expect(result[0].x).toBe(0)
    expect(result[1].x).toBe(0)
  })

  it('保持每个元素的 y 坐标不变', () => {
    const layout: Layout = [
      { i: '1', x: 3, y: 2, w: 1, h: 1 },
      { i: '2', x: 6, y: 5, w: 1, h: 1 },
    ]
    const result = horizontalCompactor.compact(layout, 12)
    expect(result[0].y).toBe(2)
    expect(result[1].y).toBe(5)
  })

  it('静态元素不移动，作为碰撞障碍物', () => {
    const layout: Layout = [
      { i: 's', x: 2, y: 0, w: 2, h: 2, static: true },
      { i: '1', x: 6, y: 0, w: 1, h: 1 },
    ]
    const result = horizontalCompactor.compact(layout, 12)
    // 静态元素位置不变
    const staticItem = result.find(l => l.i === 's')!
    expect(staticItem.x).toBe(2)
    expect(staticItem.y).toBe(0)
    // x=0 可容纳该元素，不需要跨过位于 x=2 的静态障碍。
    const item1 = result.find(l => l.i === '1')!
    expect(item1.x).toBe(0)
  })

  it('碰撞时放置在障碍物右侧', () => {
    // 两个元素在同一行，压缩后应紧密排列
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 2, h: 1 },
      { i: '2', x: 5, y: 0, w: 1, h: 1 },
    ]
    const result = horizontalCompactor.compact(layout, 12)
    expect(result.find(l => l.i === '1')!.x).toBe(0)
    expect(result.find(l => l.i === '2')!.x).toBe(2)
  })

  it('不同行的元素不受静态元素阻挡', () => {
    // 静态元素在 y=0，非静态元素在 y=5，不碰撞
    const layout: Layout = [
      { i: 's', x: 2, y: 0, w: 2, h: 2, static: true },
      { i: '1', x: 6, y: 5, w: 1, h: 1 },
    ]
    const result = horizontalCompactor.compact(layout, 12)
    expect(result.find(l => l.i === '1')!.x).toBe(0)
  })

  it('静态元素阻挡时，非静态元素放在静态元素右侧', () => {
    const layout: Layout = [
      { i: 's', x: 0, y: 0, w: 3, h: 1, static: true },
      { i: '1', x: 8, y: 0, w: 2, h: 1 },
    ]
    const result = horizontalCompactor.compact(layout, 12)
    expect(result.find(l => l.i === '1')!.x).toBe(3)
  })

  it('按列优先排序（先 x 后 y）处理', () => {
    // 元素 B 在 x=0 应先处理，元素 A 在 x=5 后处理
    const layout: Layout = [
      { i: 'A', x: 5, y: 0, w: 1, h: 1 },
      { i: 'B', x: 0, y: 1, w: 1, h: 1 },
    ]
    const result = horizontalCompactor.compact(layout, 12)
    // B 先处理，x 保持 0；A 后处理，向左压缩到 0（不同行不碰撞）
    expect(result.find(l => l.i === 'B')!.x).toBe(0)
    expect(result.find(l => l.i === 'A')!.x).toBe(0)
  })

  it('不修改输入布局', () => {
    const layout: Layout = [{ i: '1', x: 5, y: 0, w: 1, h: 1 }]
    const original = JSON.parse(JSON.stringify(layout))
    horizontalCompactor.compact(layout, 12)
    expect(layout).toEqual(original)
  })

  it('左侧已有空间时不因原始重叠执行不必要的换行', () => {
    const layout: Layout = [
      { i: 's', x: 10, y: 0, w: 2, h: 1, static: true },
      { i: '1', x: 10, y: 0, w: 2, h: 1 },
    ]
    const result = horizontalCompactor.compact(layout, 12)
    const item = result.find(l => l.i === '1')!

    expect(item.x + item.w).toBeLessThanOrEqual(12)
    expect(item).toEqual(expect.objectContaining({ x: 0, y: 0 }))
    expect(positions(fastHorizontalCompactor.compact(layout, 12))).toEqual(positions(result))
  })
})

// ─── noCompactor ────────────────────────────────────────────

describe('noCompactor', () => {
  it('保留含静态项的几何并返回 detached 布局', () => {
    const layout: Layout = [
      { i: 'static', x: 2, y: 3, w: 1, h: 1, static: true },
      { i: 'dynamic', x: 5, y: 5, w: 2, h: 2 },
    ]
    const result = noCompactor.compact(layout, 12)
    expect(positions(result)).toEqual(positions(layout))
    expect(result).not.toBe(layout)
    expect(result[0]).not.toBe(layout[0])
    expect(result[1]).not.toBe(layout[1])
  })
})

// ─── withOverlap ────────────────────────────────────────────

describe('withOverlap', () => {
  it('保留 type 并将 allowOverlap 标记为 true', () => {
    const wrapped = withOverlap(verticalCompactor)
    expect(wrapped.allowOverlap).toBe(true)
    expect(wrapped.type).toBe('vertical')
    expect(noCompactor.type).toBe('vertical')
  })

  it('委托 verticalCompactor 且不修改输入', () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 4, w: 2, h: 2 },
      { i: '2', x: 0, y: 6, w: 1, h: 1 },
    ]
    const wrapped = withOverlap(verticalCompactor)
    const result = wrapped.compact(layout, 12)
    expect(positions(result)).toEqual(positions(verticalCompactor.compact(layout, 12)))
    expect(positions(layout)).toEqual([
      { i: '1', x: 0, y: 4, w: 2, h: 2 },
      { i: '2', x: 0, y: 6, w: 1, h: 1 },
    ])
  })

  it('委托 horizontalCompactor', () => {
    const layout: Layout = [
      { i: '1', x: 5, y: 0, w: 2, h: 1 },
      { i: '2', x: 7, y: 0, w: 1, h: 1 },
    ]
    const wrapped = withOverlap(horizontalCompactor)
    const result = wrapped.compact(layout, 12)
    expect(positions(result)).toEqual(positions(horizontalCompactor.compact(layout, 12)))
  })

  it('包装 noCompactor 时返回 detached 布局', () => {
    const layout: Layout = [{ i: '1', x: 0, y: 0, w: 1, h: 1 }]
    const wrapped = withOverlap(noCompactor)
    const result = wrapped.compact(layout, 12)
    expect(result).not.toBe(layout)
    expect(result[0]).not.toBe(layout[0])
  })
})

// ─── 边界用例 ───────────────────────────────────────────────

describe('边界用例', () => {
  it('元素超出列数 — horizontalCompactor 仍正常处理', () => {
    // cols=4，元素宽度 2 从 x=10 开始（超出范围）
    const layout: Layout = [{ i: '1', x: 10, y: 0, w: 2, h: 1 }]
    const result = horizontalCompactor.compact(layout, 4)
    // 向左压缩到 x=0
    expect(result[0].x).toBe(0)
  })

  it('多个元素在同一行紧密排列 — horizontalCompactor 保持顺序', () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 1, h: 1 },
      { i: '2', x: 1, y: 0, w: 1, h: 1 },
      { i: '3', x: 2, y: 0, w: 1, h: 1 },
    ]
    const result = horizontalCompactor.compact(layout, 12)
    expect(result.find(l => l.i === '1')!.x).toBe(0)
    expect(result.find(l => l.i === '2')!.x).toBe(1)
    expect(result.find(l => l.i === '3')!.x).toBe(2)
  })
})

// ─── fastVerticalCompactor ──────────────────────────────────

describe('fastVerticalCompactor', () => {
  it('含静态元素 — 与 verticalCompactor 输出一致', () => {
    const layout: Layout = [
      { i: 'a', x: 0, y: 0, w: 1, h: 1, static: true },
      { i: 'b', x: 0, y: 5, w: 1, h: 1 },
      { i: 'c', x: 1, y: 3, w: 1, h: 2 },
    ]
    expect(positions(fastVerticalCompactor.compact(layout, 12))).toEqual(
      positions(verticalCompactor.compact(layout, 12)),
    )
  })

  it('不修改输入布局', () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 5, w: 1, h: 1 },
      { i: '2', x: 1, y: 3, w: 1, h: 1 },
    ]
    const original = JSON.parse(JSON.stringify(layout))
    fastVerticalCompactor.compact(layout, 12)
    expect(layout).toEqual(original)
  })

  it('大布局（100+ 元素）不报错', () => {
    const layout: Layout = []
    for (let i = 0; i < 150; i++) {
      layout.push({
        i: String(i),
        x: (i * 2) % 12,
        y: Math.floor(i / 6) * 3,
        w: 2,
        h: 2,
      })
    }
    expect(() => fastVerticalCompactor.compact(layout, 12)).not.toThrow()
    // 同时验证与标准压缩器输出一致
    expect(positions(fastVerticalCompactor.compact(layout, 12))).toEqual(
      positions(verticalCompactor.compact(layout, 12)),
    )
  })
})

// ─── fastHorizontalCompactor ────────────────────────────────

describe('fastHorizontalCompactor', () => {
  it('含静态元素 — 与 horizontalCompactor 输出一致', () => {
    const layout: Layout = [
      { i: 's', x: 2, y: 0, w: 2, h: 2, static: true },
      { i: '1', x: 6, y: 0, w: 1, h: 1 },
      { i: '2', x: 8, y: 1, w: 2, h: 1 },
    ]
    expect(positions(fastHorizontalCompactor.compact(layout, 12))).toEqual(
      positions(horizontalCompactor.compact(layout, 12)),
    )
  })

  it('不修改输入布局', () => {
    const layout: Layout = [{ i: '1', x: 5, y: 0, w: 1, h: 1 }]
    const original = JSON.parse(JSON.stringify(layout))
    fastHorizontalCompactor.compact(layout, 12)
    expect(layout).toEqual(original)
  })

  it('大布局（100+ 元素）不报错', () => {
    const layout: Layout = []
    for (let i = 0; i < 150; i++) {
      layout.push({
        i: String(i),
        x: (i * 2) % 12,
        y: Math.floor(i / 6) * 3,
        w: 2,
        h: 2,
      })
    }
    expect(() => fastHorizontalCompactor.compact(layout, 12)).not.toThrow()
    // 同时验证与标准压缩器输出一致
    expect(positions(fastHorizontalCompactor.compact(layout, 12))).toEqual(
      positions(horizontalCompactor.compact(layout, 12)),
    )
  })
})

// ─── Fast Compactor 回归属性 ───────────────────────────────

describe('Fast Compactor 回归属性', () => {
  it('确定性随机布局与标准压缩器保持等价', () => {
    let seed = 0x12345678
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 0x100000000
    }

    for (let run = 0; run < 300; run++) {
      const cols = 2 + Math.floor(random() * 11)
      const count = 1 + Math.floor(random() * 25)
      const layout: Layout = Array.from({ length: count }, (_, index) => {
        const w = 1 + Math.floor(random() * Math.min(4, cols))
        return {
          i: String(index),
          x: Math.floor(random() * (cols - w + 1)),
          y: Math.floor(random() * 20),
          w,
          h: 1 + Math.floor(random() * 4),
          static: random() < 0.12,
        }
      })

      expect(positions(fastVerticalCompactor.compact(layout, cols))).toEqual(
        positions(verticalCompactor.compact(layout, cols)),
      )
      expect(positions(fastHorizontalCompactor.compact(layout, cols))).toEqual(
        positions(horizontalCompactor.compact(layout, cols)),
      )
    }
  })
})
