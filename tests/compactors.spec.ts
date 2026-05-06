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
    // 非静态元素向左压缩，遇到静态元素 (x=2,w=2) 碰撞后放在其右侧 x=4
    const item1 = result.find(l => l.i === '1')!
    expect(item1.x).toBe(4)
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
    const layout: Layout = [
      { i: '1', x: 5, y: 0, w: 1, h: 1 },
    ]
    const original = JSON.parse(JSON.stringify(layout))
    horizontalCompactor.compact(layout, 12)
    expect(layout).toEqual(original)
  })
})

// ─── noCompactor ────────────────────────────────────────────

describe('noCompactor', () => {
  it('输出与输入位置完全相同', () => {
    const layout: Layout = [
      { i: '1', x: 3, y: 5, w: 2, h: 2 },
      { i: '2', x: 0, y: 0, w: 1, h: 1 },
    ]
    const result = noCompactor.compact(layout, 12)
    expect(positions(result)).toEqual(positions(layout))
  })

  it('返回新数组引用', () => {
    const layout: Layout = [{ i: '1', x: 0, y: 0, w: 1, h: 1 }]
    const result = noCompactor.compact(layout, 12)
    expect(result).not.toBe(layout)
  })

  it('返回的元素是新对象引用（浅拷贝）', () => {
    const layout: Layout = [{ i: '1', x: 0, y: 0, w: 1, h: 1 }]
    const result = noCompactor.compact(layout, 12)
    expect(result[0]).not.toBe(layout[0])
  })

  it('空布局返回空数组', () => {
    expect(noCompactor.compact([], 12)).toEqual([])
  })

  it('含静态元素时位置也不变', () => {
    const layout: Layout = [
      { i: 's', x: 2, y: 3, w: 1, h: 1, static: true },
      { i: '1', x: 5, y: 5, w: 2, h: 2 },
    ]
    const result = noCompactor.compact(layout, 12)
    expect(positions(result)).toEqual(positions(layout))
  })
})

// ─── withOverlap ────────────────────────────────────────────

describe('withOverlap', () => {
  it('allowOverlap 属性为 true', () => {
    const wrapped = withOverlap(verticalCompactor)
    expect(wrapped.allowOverlap).toBe(true)
  })

  it('跳过碰撞推移，元素位置与输入相同', () => {
    // 两个重叠元素
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 2, h: 2 },
      { i: '2', x: 0, y: 0, w: 1, h: 1 },
    ]
    const wrapped = withOverlap(verticalCompactor)
    const result = wrapped.compact(layout, 12)
    expect(positions(result)).toEqual(positions(layout))
  })

  it('包装 horizontalCompactor 时也跳过碰撞推移', () => {
    const layout: Layout = [
      { i: '1', x: 5, y: 0, w: 2, h: 1 },
      { i: '2', x: 5, y: 0, w: 1, h: 1 },
    ]
    const wrapped = withOverlap(horizontalCompactor)
    const result = wrapped.compact(layout, 12)
    expect(positions(result)).toEqual(positions(layout))
  })

  it('返回新数组引用', () => {
    const layout: Layout = [{ i: '1', x: 0, y: 0, w: 1, h: 1 }]
    const wrapped = withOverlap(noCompactor)
    const result = wrapped.compact(layout, 12)
    expect(result).not.toBe(layout)
  })
})

// ─── 边界用例 ───────────────────────────────────────────────

describe('边界用例', () => {
  it('空布局 — 所有压缩器返回空数组', () => {
    const empty: Layout = []
    expect(verticalCompactor.compact(empty, 12)).toEqual([])
    expect(horizontalCompactor.compact(empty, 12)).toEqual([])
    expect(noCompactor.compact(empty, 12)).toEqual([])
    expect(withOverlap(verticalCompactor).compact(empty, 12)).toEqual([])
  })

  it('单元素 — verticalCompactor 压缩到顶部', () => {
    const layout: Layout = [{ i: '1', x: 0, y: 10, w: 1, h: 1 }]
    const result = verticalCompactor.compact(layout, 12)
    expect(result[0].y).toBe(0)
    expect(result[0].x).toBe(0)
  })

  it('单元素 — horizontalCompactor 压缩到左侧', () => {
    const layout: Layout = [{ i: '1', x: 10, y: 3, w: 1, h: 1 }]
    const result = horizontalCompactor.compact(layout, 12)
    expect(result[0].x).toBe(0)
    expect(result[0].y).toBe(3)
  })

  it('全静态元素 — 所有压缩器不移动任何元素', () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 1, h: 1, static: true },
      { i: '2', x: 5, y: 5, w: 2, h: 2, static: true },
    ]
    const vResult = verticalCompactor.compact(layout, 12)
    const hResult = horizontalCompactor.compact(layout, 12)

    expect(positions(vResult)).toEqual(positions(layout))
    expect(positions(hResult)).toEqual(positions(layout))
  })

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
  it('空布局 — 与 verticalCompactor 输出一致', () => {
    const layout: Layout = []
    expect(fastVerticalCompactor.compact(layout, 12)).toEqual(
      verticalCompactor.compact(layout, 12),
    )
  })

  it('单元素有空隙 — 与 verticalCompactor 输出一致', () => {
    const layout: Layout = [{ i: '1', x: 0, y: 5, w: 1, h: 1 }]
    expect(positions(fastVerticalCompactor.compact(layout, 12))).toEqual(
      positions(verticalCompactor.compact(layout, 12)),
    )
  })

  it('多元素碰撞 — 与 verticalCompactor 输出一致', () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 2, h: 5 },
      { i: '2', x: 0, y: 0, w: 10, h: 1 },
      { i: '3', x: 5, y: 1, w: 1, h: 1 },
      { i: '4', x: 5, y: 2, w: 1, h: 1 },
      { i: '5', x: 5, y: 3, w: 1, h: 1, static: true },
    ]
    expect(positions(fastVerticalCompactor.compact(layout, 12))).toEqual(
      positions(verticalCompactor.compact(layout, 12)),
    )
  })

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

  it('全静态元素 — 与 verticalCompactor 输出一致', () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 1, h: 1, static: true },
      { i: '2', x: 5, y: 5, w: 2, h: 2, static: true },
    ]
    expect(positions(fastVerticalCompactor.compact(layout, 12))).toEqual(
      positions(verticalCompactor.compact(layout, 12)),
    )
  })

  it('密集布局 — 与 verticalCompactor 输出一致', () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 4, h: 2 },
      { i: '2', x: 4, y: 0, w: 4, h: 3 },
      { i: '3', x: 8, y: 0, w: 4, h: 1 },
      { i: '4', x: 0, y: 5, w: 6, h: 2 },
      { i: '5', x: 6, y: 5, w: 6, h: 1 },
      { i: '6', x: 0, y: 10, w: 12, h: 1 },
    ]
    expect(positions(fastVerticalCompactor.compact(layout, 12))).toEqual(
      positions(verticalCompactor.compact(layout, 12)),
    )
  })

  it('带间隙的稀疏布局 — 与 verticalCompactor 输出一致', () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 10, w: 1, h: 1 },
      { i: '2', x: 3, y: 20, w: 2, h: 3 },
      { i: '3', x: 8, y: 50, w: 1, h: 1 },
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
  it('空布局 — 与 horizontalCompactor 输出一致', () => {
    const layout: Layout = []
    expect(fastHorizontalCompactor.compact(layout, 12)).toEqual(
      horizontalCompactor.compact(layout, 12),
    )
  })

  it('单元素向左压缩 — 与 horizontalCompactor 输出一致', () => {
    const layout: Layout = [{ i: '1', x: 10, y: 3, w: 1, h: 1 }]
    expect(positions(fastHorizontalCompactor.compact(layout, 12))).toEqual(
      positions(horizontalCompactor.compact(layout, 12)),
    )
  })

  it('多元素同行碰撞 — 与 horizontalCompactor 输出一致', () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 2, h: 1 },
      { i: '2', x: 5, y: 0, w: 1, h: 1 },
      { i: '3', x: 8, y: 0, w: 3, h: 1 },
    ]
    expect(positions(fastHorizontalCompactor.compact(layout, 12))).toEqual(
      positions(horizontalCompactor.compact(layout, 12)),
    )
  })

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

  it('全静态元素 — 与 horizontalCompactor 输出一致', () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 1, h: 1, static: true },
      { i: '2', x: 5, y: 5, w: 2, h: 2, static: true },
    ]
    expect(positions(fastHorizontalCompactor.compact(layout, 12))).toEqual(
      positions(horizontalCompactor.compact(layout, 12)),
    )
  })

  it('不同行元素互不影响 — 与 horizontalCompactor 输出一致', () => {
    const layout: Layout = [
      { i: '1', x: 5, y: 0, w: 1, h: 1 },
      { i: '2', x: 8, y: 5, w: 2, h: 1 },
    ]
    expect(positions(fastHorizontalCompactor.compact(layout, 12))).toEqual(
      positions(horizontalCompactor.compact(layout, 12)),
    )
  })

  it('密集布局 — 与 horizontalCompactor 输出一致', () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 4, h: 2 },
      { i: '2', x: 4, y: 0, w: 4, h: 3 },
      { i: '3', x: 8, y: 0, w: 4, h: 1 },
      { i: '4', x: 0, y: 5, w: 6, h: 2 },
      { i: '5', x: 6, y: 5, w: 6, h: 1 },
      { i: '6', x: 0, y: 10, w: 12, h: 1 },
    ]
    expect(positions(fastHorizontalCompactor.compact(layout, 12))).toEqual(
      positions(horizontalCompactor.compact(layout, 12)),
    )
  })

  it('不修改输入布局', () => {
    const layout: Layout = [
      { i: '1', x: 5, y: 0, w: 1, h: 1 },
    ]
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
