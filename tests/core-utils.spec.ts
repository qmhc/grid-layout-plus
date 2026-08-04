/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'

import {
  calcGridCellDimensions,
  gridToPixelRect,
  isDerivedGeometryError,
  pixelSizeToGridSize,
  pointerToGridPosition,
} from '../src/core/utils'
import { bottom } from '../src/helpers/common'

import type { GridGeometry, Layout } from '../src/helpers/types'

// ─── calcGridCellDimensions ─────────────────────────────────

describe('calcGridCellDimensions', () => {
  it('标准参数 — 公式 (containerWidth - 2 * paddingX - gapX * (cols - 1)) / cols', () => {
    const result = calcGridCellDimensions({
      containerWidth: 1200,
      cols: 12,
      gap: [10, 10],
      containerPadding: [10, 10],
      rowHeight: 30,
    })

    // cellWidth = (1200 - 10 * 13) / 12 = (1200 - 130) / 12 = 1070 / 12
    expect(result.cellWidth).toBeCloseTo(1070 / 12)
    expect(result.cellHeight).toBe(30)
    expect(result.gapX).toBe(10)
    expect(result.gapY).toBe(10)
  })

  it('不同 gap 值 — gapX 和 gapY 独立', () => {
    const result = calcGridCellDimensions({
      containerWidth: 800,
      cols: 4,
      gap: [5, 20],
      containerPadding: [5, 20],
      rowHeight: 50,
    })

    // cellWidth = (800 - 5 * 5) / 4 = (800 - 25) / 4 = 193.75
    expect(result.cellWidth).toBeCloseTo(193.75)
    expect(result.cellHeight).toBe(50)
    expect(result.gapX).toBe(5)
    expect(result.gapY).toBe(20)
  })

  it('gap 为 0 — cellWidth = containerWidth / cols', () => {
    const result = calcGridCellDimensions({
      containerWidth: 600,
      cols: 6,
      gap: [0, 0],
      containerPadding: [0, 0],
      rowHeight: 40,
    })

    expect(result.cellWidth).toBe(100)
    expect(result.cellHeight).toBe(40)
    expect(result.gapX).toBe(0)
    expect(result.gapY).toBe(0)
  })

  it('cols <= 0 — 以稳定 path 拒绝非法配置', () => {
    expect(() =>
      calcGridCellDimensions({
        containerWidth: 1200,
        cols: 0,
        gap: [10, 10],
        containerPadding: [10, 10],
        rowHeight: 30,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid-config',
        path: 'geometry.cols',
      }),
    )
  })

  it('cols = 1 — 单列场景', () => {
    const result = calcGridCellDimensions({
      containerWidth: 500,
      cols: 1,
      gap: [10, 10],
      containerPadding: [10, 10],
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
      gap: [10, 10],
      containerPadding: [10, 10],
      rowHeight: 30,
    })

    expect(result.cellWidth).toBeGreaterThan(0)
  })

  it('containerWidth 不足时 cellWidth 可能为负数', () => {
    const result = calcGridCellDimensions({
      containerWidth: 10,
      cols: 12,
      gap: [10, 10],
      containerPadding: [10, 10],
      rowHeight: 30,
    })

    // (10 - 10 * 13) / 12 = (10 - 130) / 12 = -10，但会被 clamp 到 0
    expect(result.cellWidth).toBeCloseTo(0)
  })

  it('containerPadding 为 0 时只扣除内部 gap', () => {
    const result = calcGridCellDimensions({
      containerWidth: 1200,
      cols: 12,
      gap: [10, 10],
      containerPadding: [0, 0],
      rowHeight: 30,
    })

    expect(result.cellWidth).toBeCloseTo((1200 - 10 * 11) / 12)
  })
})

const geometry: GridGeometry = {
  width: 800,
  cols: 4,
  rowHeight: 40,
  gap: [10, 10],
  containerPadding: [20, 30],
  rtl: false,
  effectiveScale: 1,
}

describe('gridToPixelRect', () => {
  it('按通用 padding 公式保留小数并返回 detached rect', () => {
    const item = { i: 'item', x: 1, y: 2, w: 2, h: 3 }
    const result = gridToPixelRect(item, geometry)

    expect(result).toEqual({
      top: 130,
      inlineStart: 212.5,
      width: 375,
      height: 140,
    })
    expect(result).not.toBe(item)
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('LTR/RTL 共享相同逻辑 inlineStart', () => {
    const item = { i: 'item', x: 1, y: 0, w: 1, h: 1 }
    expect(gridToPixelRect(item, { ...geometry, rtl: true })).toEqual(
      gridToPixelRect(item, geometry),
    )
  })

  it('按 LayoutItem path 拒绝 extent overflow 和 min/max 违规', () => {
    expect(() =>
      gridToPixelRect({ i: 'item', x: Number.MAX_SAFE_INTEGER, y: 0, w: 2, h: 1 }, geometry),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid-layout',
        path: 'layoutItem.w',
      }),
    )
    expect(() =>
      gridToPixelRect({ i: 'item', x: 0, y: 0, w: 1, h: 1, minW: 2 }, geometry),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid-layout',
        path: 'layoutItem.w',
      }),
    )
  })
})

describe('pointerToGridPosition', () => {
  const rect = {
    left: 100,
    right: 900,
    top: 50,
    bottom: 550,
    width: 800,
    height: 500,
  }

  it('应用 anchor、rounding 与 scale', () => {
    expect(
      pointerToGridPosition({
        clientX: 100 + (20 + 2.5 * 192.5 + 40) * 2,
        clientY: 50 + (30 + 1.5 * 50 + 20) * 2,
        containerRect: { ...rect, right: 1700, bottom: 1050, width: 1600, height: 1000 },
        anchor: { inline: 40, block: 20 },
        geometry: { ...geometry, effectiveScale: 2 },
      }),
    ).toEqual({ x: 3, y: 2 })
  })

  it('RTL 从容器右侧计算 inline 坐标', () => {
    const input = {
      clientY: 130,
      containerRect: rect,
      anchor: { inline: 0, block: 0 },
      geometry,
    }
    expect(pointerToGridPosition({ ...input, clientX: 312.5 })).toEqual({ x: 1, y: 1 })
    expect(
      pointerToGridPosition({
        ...input,
        clientX: 687.5,
        geometry: { ...geometry, rtl: true },
      }),
    ).toEqual({ x: 1, y: 1 })
  })

  it('允许返回负坐标，并由调用方在 rounding 后 clamp', () => {
    expect(
      pointerToGridPosition({
        clientX: 0,
        clientY: 0,
        containerRect: rect,
        anchor: { inline: 0, block: 0 },
        geometry,
      }),
    ).toEqual({ x: -1, y: -2 })
  })

  it('按稳定 path 拒绝 rect 不一致与 zero pitch', () => {
    expect(() =>
      pointerToGridPosition({
        clientX: 100,
        clientY: 100,
        containerRect: { ...rect, width: 799 },
        anchor: { inline: 0, block: 0 },
        geometry,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid-config',
        path: 'containerRect.width',
      }),
    )
    expect(() =>
      pointerToGridPosition({
        clientX: 0,
        clientY: 0,
        containerRect: { left: 0, right: 1, top: 0, bottom: 1, width: 1, height: 1 },
        anchor: { inline: 0, block: 0 },
        geometry: {
          ...geometry,
          width: 40,
          gap: [0, 0],
          containerPadding: [20, 0],
        },
      }),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid-config',
        path: 'geometry.width',
      }),
    )
  })
})

describe('pixelSizeToGridSize', () => {
  it('用相同 pitch 执行 Math.round', () => {
    expect(pixelSizeToGridSize({ width: 375, height: 140, geometry })).toEqual({ w: 2, h: 3 })
    expect(pixelSizeToGridSize({ width: 86.25, height: 15, geometry })).toEqual({ w: 1, h: 1 })
  })

  it('zero vertical pitch 固定归因到 rowHeight', () => {
    expect(() =>
      pixelSizeToGridSize({
        width: 10,
        height: 10,
        geometry: { ...geometry, rowHeight: 0, gap: [10, 0] },
      }),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid-config',
        path: 'geometry.rowHeight',
      }),
    )
  })
})

describe('geometry 派生边界', () => {
  const maximum = Number.MAX_VALUE
  const minimum = Number.MIN_VALUE
  const rect = { left: 0, right: 1, top: 0, bottom: 1, width: 1, height: 1 }
  const item = { i: 'item', x: 0, y: 0, w: 1, h: 1 }

  function expectDerivedPath(run: () => unknown, path: string) {
    let captured: unknown
    try {
      run()
    } catch (error) {
      captured = error
    }
    expect(captured).toMatchObject({
      name: 'GridLayoutValidationError',
      code: 'invalid-config',
      path,
    })
    expect(isDerivedGeometryError(captured)).toBe(true)
  }

  it.each([
    [
      'grid geometry overflow',
      () =>
        gridToPixelRect(item, {
          ...geometry,
          rowHeight: maximum,
          gap: [0, maximum],
          containerPadding: [0, 0],
        }),
      'geometry.gap[1]',
    ],
    [
      'item extent overflow',
      () =>
        gridToPixelRect(
          { ...item, x: 2 },
          { ...geometry, width: maximum, cols: 1, gap: [0, 0], containerPadding: [0, 0] },
        ),
      'layoutItem.x',
    ],
  ] as const)('%s 固定归因到 %s', (_name, run, path) => {
    expectDerivedPath(run, path)
  })

  it.each([
    [
      'pointer delta overflow',
      () =>
        pointerToGridPosition({
          clientX: maximum,
          clientY: 0,
          containerRect: {
            left: -maximum,
            right: 0,
            top: 0,
            bottom: 1,
            width: maximum,
            height: 1,
          },
          anchor: { inline: 0, block: 0 },
          geometry,
        }),
      'pointer.clientX',
    ],
    [
      'scale-derived overflow',
      () =>
        pointerToGridPosition({
          clientX: maximum,
          clientY: 0,
          containerRect: rect,
          anchor: { inline: 0, block: 0 },
          geometry: { ...geometry, effectiveScale: minimum },
        }),
      'geometry.effectiveScale',
    ],
  ] as const)('%s 固定归因到 %s', (_name, run, path) => {
    expectDerivedPath(run, path)
  })

  it.each([
    [
      'size numerator overflow',
      () =>
        pixelSizeToGridSize({
          width: maximum,
          height: 0,
          geometry: {
            ...geometry,
            width: 1,
            cols: 1,
            gap: [maximum, 0],
            containerPadding: [0, 0],
          },
        }),
      'size.width',
    ],
    [
      'tiny pitch overflow',
      () =>
        pixelSizeToGridSize({
          width: maximum,
          height: 0,
          geometry: {
            ...geometry,
            width: minimum,
            cols: 1,
            gap: [0, 0],
            containerPadding: [0, 0],
          },
        }),
      'geometry.width',
    ],
  ] as const)('%s 固定归因到 %s', (_name, run, path) => {
    expectDerivedPath(run, path)
  })
})

// ─── bottom ─────────────────────────────────────────────────

describe('bottom', () => {
  it('空布局返回 0', () => {
    expect(bottom([])).toBe(0)
  })

  it('多元素返回包含静态项的 max(y + h)', () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 1, h: 2 },
      { i: '2', x: 1, y: 3, w: 1, h: 4 },
      { i: 'static', x: 2, y: 10, w: 1, h: 5, static: true },
    ]
    expect(bottom(layout)).toBe(15)
  })

  it('拒绝 y + h 的 safe-integer overflow', () => {
    const layout: Layout = [{ i: 'overflow', x: 0, y: Number.MAX_SAFE_INTEGER, w: 1, h: 1 }]
    expect(() => bottom(layout)).toThrowError(
      expect.objectContaining({
        code: 'invalid-layout',
        path: 'layout[0].h',
      }),
    )
  })
})
