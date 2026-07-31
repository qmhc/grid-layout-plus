/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'

import { verticalCompactor } from '../src/core/compactors'
import {
  cloneResponsiveLayouts,
  createCompleteResponsiveLayouts,
  getBreakpointFromWidth,
  snapshotDormantResponsiveInputs,
  snapshotResponsiveConfig,
  snapshotResponsiveLayouts,
} from '../src/helpers/responsive'

describe('responsive records', () => {
  it('支持自定义断点并在 width 等于 threshold 时选择该断点', () => {
    const config = snapshotResponsiveConfig<'mobile' | 'tablet' | 'desktop'>(
      { desktop: 1024, mobile: 0, tablet: 768 },
      { mobile: 2, desktop: 12, tablet: 8 },
    )

    expect(config.sorted).toEqual(['mobile', 'tablet', 'desktop'])
    expect(getBreakpointFromWidth(config.breakpoints, 768)).toBe('tablet')
    expect(getBreakpointFromWidth(config.breakpoints, 1024)).toBe('desktop')
    expect(Object.getPrototypeOf(config.breakpoints)).toBeNull()
    expect(Object.isFrozen(config.breakpoints)).toBe(true)
  })

  it('拒绝键空间不一致、重复 threshold、缺少 0 与保留 key', () => {
    expect(() =>
      snapshotResponsiveConfig({ mobile: 0, desktop: 1024 }, { mobile: 2 } as any),
    ).toThrow(
      expect.objectContaining({
        code: 'invalid-config',
        path: 'config.cols["desktop"]',
      }),
    )
    expect(() =>
      snapshotResponsiveConfig({ mobile: 0, desktop: 0 }, { mobile: 2, desktop: 12 }),
    ).toThrow(
      expect.objectContaining({
        code: 'invalid-config',
        path: 'config.breakpoints["desktop"]',
      }),
    )
    expect(() => snapshotResponsiveConfig({ mobile: 1 }, { mobile: 2 })).toThrow(
      expect.objectContaining({
        code: 'invalid-config',
        path: 'config.breakpoints',
      }),
    )
    const reserved = Object.create(null)
    Object.defineProperty(reserved, '__proto__', {
      enumerable: true,
      value: 0,
    })
    expect(() => snapshotResponsiveConfig(reserved, reserved)).toThrow(
      expect.objectContaining({
        code: 'invalid-config',
        path: 'config.breakpoints["__proto__"]',
      }),
    )
  })

  it('不读取 accessor，并保留 reflection trap cause', () => {
    let reads = 0
    const accessor = {
      get mobile() {
        reads += 1
        return 0
      },
    }
    expect(() => snapshotResponsiveConfig(accessor, { mobile: 2 })).toThrow(
      expect.objectContaining({
        code: 'invalid-config',
        path: 'config.breakpoints.mobile',
      }),
    )
    expect(reads).toBe(0)

    const failure = new Error('ownKeys failed')
    const trapped = new Proxy(
      {},
      {
        ownKeys() {
          throw failure
        },
      },
    )
    expect(() => snapshotResponsiveConfig(trapped, {})).toThrow(
      expect.objectContaining({
        code: 'invalid-config',
        path: 'config.breakpoints',
        cause: failure,
      }),
    )
  })

  it('dormant 快照只校验各 record 与 value 结构，延后键空间和 bounds 校验', () => {
    const dormant = snapshotDormantResponsiveInputs(
      { mobile: 0 },
      { desktop: 2 },
      {
        legacy: [
          { i: 'first', x: 20, y: 0, w: 3, h: 1 },
          { i: 'second', x: 20, y: 0, w: 3, h: 1 },
        ],
      },
    )

    expect(dormant.breakpoints).toEqual({ mobile: 0 })
    expect(dormant.cols).toEqual({ desktop: 2 })
    expect(dormant.layouts.legacy).toHaveLength(2)
    expect(Object.getPrototypeOf(dormant.layouts)).toBeNull()
    expect(() => snapshotDormantResponsiveInputs({ mobile: 0 }, { mobile: 0 }, {})).toThrow(
      expect.objectContaining({
        code: 'invalid-config',
        path: 'config.cols["mobile"]',
      }),
    )
  })
})

describe('responsive layout generation', () => {
  const config = snapshotResponsiveConfig<'mobile' | 'tablet' | 'desktop'>(
    { mobile: 0, tablet: 768, desktop: 1024 },
    { mobile: 2, tablet: 8, desktop: 12 },
  )
  const options = {
    maxRows: Infinity,
    collisionMode: 'push' as const,
    compactor: verticalCompactor,
  }

  it('严格校验 author，并按更宽、更窄、initialFallback 顺序补全', () => {
    const author = snapshotResponsiveLayouts(
      {
        desktop: [{ i: 'item', x: 8, y: 0, w: 2, h: 1 }],
      },
      config,
      options,
    )
    const complete = createCompleteResponsiveLayouts(
      author,
      [{ i: 'fallback', x: 0, y: 0, w: 1, h: 1 }],
      config,
      options,
    )

    expect(complete.desktop).toEqual([{ i: 'item', x: 8, y: 0, w: 2, h: 1 }])
    expect(complete.tablet).toEqual([{ i: 'item', x: 6, y: 0, w: 2, h: 1 }])
    expect(complete.mobile).toEqual([{ i: 'item', x: 0, y: 0, w: 2, h: 1 }])
    expect(Object.getPrototypeOf(complete)).toBeNull()
    expect(Object.isFrozen(complete)).toBe(true)
  })

  it('公开 clone 是 mutable detached null-prototype record', () => {
    const complete = createCompleteResponsiveLayouts(
      {},
      [{ i: 'fallback', x: 0, y: 0, w: 1, h: 1 }],
      config,
      options,
    )
    const first = cloneResponsiveLayouts(complete)
    const second = cloneResponsiveLayouts(complete)

    expect(Object.getPrototypeOf(first)).toBeNull()
    expect(Object.isFrozen(first)).toBe(false)
    first.mobile[0].x = 1
    expect(second.mobile[0].x).toBe(0)
    expect(complete.mobile[0].x).toBe(0)
  })

  it('author Layout 字段错误保留 responsiveLayouts path', () => {
    expect(() =>
      snapshotResponsiveLayouts(
        {
          mobile: [{ i: 'item', x: Number.NaN, y: 0, w: 1, h: 1 }],
        },
        config,
        options,
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'invalid-layout',
        path: 'responsiveLayouts["mobile"][0].x',
      }),
    )
  })

  it('调用方可以为 initial fallback 指定实际来源根路径', () => {
    expect(() =>
      createCompleteResponsiveLayouts(
        {},
        [
          { i: 'first', x: 0, y: 0, w: 1, h: 1, static: true },
          { i: 'second', x: 0, y: 0, w: 1, h: 1, static: true },
        ],
        config,
        options,
        'layout',
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'invalid-layout',
        path: 'layout[1]',
      }),
    )
  })
})
