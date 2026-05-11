/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'

import { calcGridCellDimensions } from '../src/core/utils'
import { bottom } from '../src/helpers/common'

import type { Layout } from '../src/helpers/types'

// ─── calcGridCellDimensions ─────────────────────────────────

describe('calcGridCellDimensions', () => {
  it('标准参数 — 公式 (containerWidth - marginX * (cols + 1)) / cols', () => {
    const result = calcGridCellDimensions({
      containerWidth: 1200,
      cols: 12,
      margin: [10, 10],
      rowHeight: 30,
    })

    // cellWidth = (1200 - 10 * 13) / 12 = (1200 - 130) / 12 = 1070 / 12
    expect(result.cellWidth).toBeCloseTo(1070 / 12)
    expect(result.cellHeight).toBe(30)
    expect(result.marginX).toBe(10)
    expect(result.marginY).toBe(10)
  })

  it('不同 margin 值 — marginX 和 marginY 独立', () => {
    const result = calcGridCellDimensions({
      containerWidth: 800,
      cols: 4,
      margin: [5, 20],
      rowHeight: 50,
    })

    // cellWidth = (800 - 5 * 5) / 4 = (800 - 25) / 4 = 193.75
    expect(result.cellWidth).toBeCloseTo(193.75)
    expect(result.cellHeight).toBe(50)
    expect(result.marginX).toBe(5)
    expect(result.marginY).toBe(20)
  })

  it('margin 为 0 — cellWidth = containerWidth / cols', () => {
    const result = calcGridCellDimensions({
      containerWidth: 600,
      cols: 6,
      margin: [0, 0],
      rowHeight: 40,
    })

    expect(result.cellWidth).toBe(100)
    expect(result.cellHeight).toBe(40)
    expect(result.marginX).toBe(0)
    expect(result.marginY).toBe(0)
  })

  it('cols <= 0 — cellWidth 返回 0', () => {
    const result = calcGridCellDimensions({
      containerWidth: 1200,
      cols: 0,
      margin: [10, 10],
      rowHeight: 30,
    })

    expect(result.cellWidth).toBe(0)
  })

  it('cols = 1 — 单列场景', () => {
    const result = calcGridCellDimensions({
      containerWidth: 500,
      cols: 1,
      margin: [10, 10],
      rowHeight: 100,
    })

    // cellWidth = (500 - 10 * 2) / 1 = 480
    expect(result.cellWidth).toBe(480)
    expect(result.cellHeight).toBe(100)
  })

  it('containerWidth 足够时 cellWidth 为正数', () => {
    const result = calcGridCellDimensions({
      containerWidth: 1000,
      cols: 12,
      margin: [10, 10],
      rowHeight: 30,
    })

    expect(result.cellWidth).toBeGreaterThan(0)
  })

  it('containerWidth 不足时 cellWidth 可能为负数', () => {
    const result = calcGridCellDimensions({
      containerWidth: 10,
      cols: 12,
      margin: [10, 10],
      rowHeight: 30,
    })

    // (10 - 10 * 13) / 12 = (10 - 130) / 12 = -10，但会被 clamp 到 0
    expect(result.cellWidth).toBeCloseTo(0)
  })
})

// ─── bottom ─────────────────────────────────────────────────

describe('bottom', () => {
  it('空布局返回 0', () => {
    expect(bottom([])).toBe(0)
  })

  it('单元素布局', () => {
    const layout: Layout = [{ i: '1', x: 0, y: 2, w: 1, h: 3 }]
    expect(bottom(layout)).toBe(5) // 2 + 3
  })

  it('多元素返回 max(y + h)', () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 1, h: 2 },
      { i: '2', x: 1, y: 3, w: 1, h: 4 },
      { i: '3', x: 2, y: 1, w: 1, h: 1 },
    ]
    expect(bottom(layout)).toBe(7) // max(2, 7, 2) = 7
  })

  it('含静态元素 — 静态元素也参与计算', () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 1, h: 1 },
      { i: '2', x: 0, y: 10, w: 1, h: 5, static: true },
    ]
    expect(bottom(layout)).toBe(15) // 10 + 5
  })

  it('所有元素在 y=0 — 返回最大 h', () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 1, h: 3 },
      { i: '2', x: 1, y: 0, w: 1, h: 5 },
      { i: '3', x: 2, y: 0, w: 1, h: 1 },
    ]
    expect(bottom(layout)).toBe(5)
  })
})
