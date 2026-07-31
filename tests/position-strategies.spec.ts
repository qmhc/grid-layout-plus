/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest'

import {
  absoluteStrategy,
  scaledStrategy,
  transformStrategy,
} from '../src/core/position-strategies'
import { GridLayoutValidationError } from '../src/core/errors'
import {
  createAbsoluteStyle,
  createTransformStyle,
  formatPositionNumber,
  validatePositionGeometry,
  validatePositionStyleResult,
  validateTransientPositionGeometry,
} from '../src/core/position-style'
import { snapshotPositionStrategy } from '../src/core/validation'

describe('transformStrategy', () => {
  const cases = [
    { top: 0, left: 0, width: 100, height: 50 },
    { top: 10, left: 20, width: 200, height: 100 },
    { top: 0.5, left: 1.5, width: 99.9, height: 33.3 },
    { top: 1000, left: 2000, width: 500, height: 300 },
  ]

  it.each(cases)(
    'getStyle($top, $left, $width, $height) 返回 canonical transform',
    ({ top, left, width, height }) => {
      expect(transformStrategy.getStyle(top, left, width, height)).toEqual({
        transform: `translate3d(${left}px, ${top}px, 0)`,
        width: `${width}px`,
        height: `${height}px`,
        position: 'absolute',
      })
    },
  )

  it.each(cases)(
    'getRtlStyle($top, $left, $width, $height) 返回 canonical RTL transform',
    ({ top, left: right, width, height }) => {
      expect(transformStrategy.getRtlStyle(top, right, width, height)).toEqual({
        transform: `translate3d(${right === 0 ? 0 : -right}px, ${top}px, 0)`,
        width: `${width}px`,
        height: `${height}px`,
        position: 'absolute',
      })
    },
  )

  it('声明使用 CSS transform', () => {
    expect(transformStrategy.usesCssTransforms).toBe(true)
  })
})

describe('absoluteStrategy', () => {
  const cases = [
    { top: 0, left: 0, width: 100, height: 50 },
    { top: 10, left: 20, width: 200, height: 100 },
    { top: 0.5, left: 1.5, width: 99.9, height: 33.3 },
    { top: 1000, left: 2000, width: 500, height: 300 },
  ]

  it.each(cases)(
    'getStyle($top, $left, $width, $height) 返回 canonical absolute style',
    ({ top, left, width, height }) => {
      expect(absoluteStrategy.getStyle(top, left, width, height)).toEqual({
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
        position: 'absolute',
      })
    },
  )

  it.each(cases)(
    'getRtlStyle($top, $left, $width, $height) 返回 canonical RTL absolute style',
    ({ top, left: right, width, height }) => {
      expect(absoluteStrategy.getRtlStyle(top, right, width, height)).toEqual({
        top: `${top}px`,
        right: `${right}px`,
        width: `${width}px`,
        height: `${height}px`,
        position: 'absolute',
      })
    },
  )

  it('声明不使用 CSS transform', () => {
    expect(absoluteStrategy.usesCssTransforms).toBe(false)
  })
})

describe('scaledStrategy', () => {
  it('保留正常定位样式，并提供交互缩放比例', () => {
    const strategy = scaledStrategy(0.5)

    expect(strategy.transformScale).toBe(0.5)
    expect(strategy.getStyle(10, 20, 100, 50)).toEqual(transformStrategy.getStyle(10, 20, 100, 50))
    expect(strategy.getRtlStyle(10, 20, 100, 50)).toEqual(
      transformStrategy.getRtlStyle(10, 20, 100, 50),
    )
  })

  it.each([0, -1, Infinity, NaN])('拒绝非法缩放比例 %s', scale => {
    expect(() => scaledStrategy(scale)).toThrow(
      expect.objectContaining({
        name: 'GridLayoutValidationError',
        code: 'invalid-config',
        path: 'config.scale',
        cause: scale,
      }),
    )
  })

  it('内建策略按参数顺序拒绝非法几何', () => {
    expect(() => transformStrategy.getStyle(0, -1, 10, 10)).toThrow(
      expect.objectContaining({
        code: 'invalid-config',
        path: 'geometry.left',
      }),
    )
    expect(() => absoluteStrategy.getRtlStyle(0, 0, Infinity, 10)).toThrow(
      expect.objectContaining({
        code: 'invalid-config',
        path: 'geometry.width',
      }),
    )
    expect(() => transformStrategy.getStyle(0, -1, 10, 10)).toThrow(GridLayoutValidationError)
  })
})

describe('transient position geometry', () => {
  it('允许有符号位置并为 LTR/RTL 生成合法样式', () => {
    const geometry = validateTransientPositionGeometry(-10, -20, 100, 50, 'ltr')

    expect(createTransformStyle(geometry, 'ltr')).toMatchObject({
      transform: 'translate3d(-20px, -10px, 0)',
    })
    expect(createTransformStyle(geometry, 'rtl')).toMatchObject({
      transform: 'translate3d(20px, -10px, 0)',
    })
    expect(createAbsoluteStyle(geometry, 'ltr')).toMatchObject({ top: '-10px', left: '-20px' })
    expect(createAbsoluteStyle(geometry, 'rtl')).toMatchObject({ top: '-10px', right: '-20px' })
    expect(formatPositionNumber(-1e-7)).toBe('-0.0000001')
  })

  it('仍拒绝负尺寸，且正式位置几何继续拒绝负坐标', () => {
    expect(() => validateTransientPositionGeometry(0, 0, -1, 10, 'ltr')).toThrow(
      expect.objectContaining({ path: 'geometry.width' }),
    )
    expect(() => validatePositionGeometry(-1, 0, 10, 10, 'ltr')).toThrow(
      expect.objectContaining({ path: 'geometry.top' }),
    )
  })
})

describe('PositionStrategy shape snapshot', () => {
  const getStyle = (top: number, left: number, width: number, height: number) => ({
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
    height: `${height}px`,
  })
  const getRtlStyle = (top: number, right: number, width: number, height: number) => ({
    top: `${top}px`,
    right: `${right}px`,
    width: `${width}px`,
    height: `${height}px`,
  })

  it('复制 primitive 与函数引用，并与调用方对象后续突变隔离', () => {
    const replacement = vi.fn(getStyle)
    const input = {
      usesCssTransforms: false,
      transformScale: 2,
      getStyle,
      getRtlStyle,
    }

    const snapshot = snapshotPositionStrategy(input)
    input.usesCssTransforms = true
    input.transformScale = 3
    input.getStyle = replacement

    expect(snapshot).not.toBe(input)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(snapshot).toMatchObject({
      usesCssTransforms: false,
      transformScale: 2,
      getStyle,
      getRtlStyle,
    })
  })

  it('descriptor-safe 拒绝全部非法 shape，且不调用 style callback', () => {
    const callback = vi.fn(getStyle)
    let getterReads = 0
    const accessor = {
      get usesCssTransforms() {
        getterReads += 1
        return false
      },
      getStyle: callback,
      getRtlStyle,
    }
    const nonEnumerable = {
      usesCssTransforms: false,
      getStyle: callback,
    } as Record<string, unknown>
    Object.defineProperty(nonEnumerable, 'getRtlStyle', {
      enumerable: false,
      value: getRtlStyle,
    })
    const reflectionFailure = new Error('getPrototypeOf failed')
    const cases: Array<readonly [unknown, string]> = [
      [null, 'config.positionStrategy'],
      [
        Object.assign(Object.create({ inherited: true }), {
          usesCssTransforms: false,
          getStyle: callback,
          getRtlStyle,
        }),
        'config.positionStrategy',
      ],
      [accessor, 'config.positionStrategy.usesCssTransforms'],
      [nonEnumerable, 'config.positionStrategy.getRtlStyle'],
      [
        {
          usesCssTransforms: false,
          getStyle: callback,
          getRtlStyle,
          extra: true,
        },
        'config.positionStrategy.extra',
      ],
      [
        {
          usesCssTransforms: false,
          getStyle: callback,
          getRtlStyle,
          [Symbol('unsafe')]: true,
        },
        'config.positionStrategy.<symbol>',
      ],
      [{ usesCssTransforms: false, getStyle: callback }, 'config.positionStrategy.getRtlStyle'],
      [
        { usesCssTransforms: 'false', getStyle: callback, getRtlStyle },
        'config.positionStrategy.usesCssTransforms',
      ],
      [
        { usesCssTransforms: false, getStyle: null, getRtlStyle },
        'config.positionStrategy.getStyle',
      ],
      [
        new Proxy(
          {},
          {
            getPrototypeOf() {
              throw reflectionFailure
            },
          },
        ),
        'config.positionStrategy',
      ],
    ]

    for (const [value, path] of cases) {
      expect(() => snapshotPositionStrategy(value)).toThrow(
        expect.objectContaining({
          name: 'GridLayoutValidationError',
          code: 'invalid-config',
          path,
        }),
      )
    }
    expect(getterReads).toBe(0)
    expect(callback).not.toHaveBeenCalled()
  })

  it.each([0, -1, Infinity, Number.NaN, '1'])('拒绝非法 transformScale %s', transformScale => {
    expect(() =>
      snapshotPositionStrategy({
        usesCssTransforms: false,
        transformScale,
        getStyle,
        getRtlStyle,
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'invalid-config',
        path: 'config.positionStrategy.transformScale',
        cause: transformScale,
      }),
    )
  })
})

describe('PositionStyle runtime validation', () => {
  const geometry = validatePositionGeometry(10, 20, 100, 50, 'ltr')
  const basePath = 'layout[1].style'

  it('不读取 accessor，并返回 key 级 path', () => {
    let getterReads = 0
    const style = {
      top: '10px',
      left: '20px',
      height: '50px',
    } as Record<string, string>
    Object.defineProperty(style, 'width', {
      enumerable: true,
      get() {
        getterReads += 1
        return '100px'
      },
    })

    expect(validatePositionStyleResult(style, false, 'ltr', geometry, basePath)).toMatchObject({
      ok: false,
      path: 'layout[1].style["width"]',
    })
    expect(getterReads).toBe(0)
  })

  it.each([
    [
      'non-enumerable',
      () => {
        const style = { top: '10px', left: '20px', width: '100px' }
        Object.defineProperty(style, 'height', { value: '50px', enumerable: false })
        return style
      },
      'layout[1].style["height"]',
    ],
    [
      'custom prototype',
      () =>
        Object.assign(Object.create({ inherited: true }), {
          top: '10px',
          left: '20px',
          width: '100px',
          height: '50px',
        }),
      basePath,
    ],
    [
      'extra key',
      () => ({
        top: '10px',
        left: '20px',
        width: '100px',
        height: '50px',
        opacity: '1',
      }),
      'layout[1].style["opacity"]',
    ],
    [
      'non-canonical px',
      () => ({ top: '10.0px', left: '20px', width: '100px', height: '50px' }),
      'layout[1].style["top"]',
    ],
    [
      'wrong geometry value',
      () => ({ top: '10px', left: '20px', width: '101px', height: '50px' }),
      'layout[1].style["width"]',
    ],
  ])('拒绝 %s', (_name, createStyle, path) => {
    expect(
      validatePositionStyleResult(createStyle(), false, 'ltr', geometry, basePath),
    ).toMatchObject({ ok: false, path })
  })

  it('拒绝 symbol key', () => {
    const style = {
      top: '10px',
      left: '20px',
      width: '100px',
      height: '50px',
      [Symbol('unsafe')]: 'value',
    }
    expect(validatePositionStyleResult(style, false, 'ltr', geometry, basePath)).toMatchObject({
      ok: false,
      path: 'layout[1].style.<symbol>',
    })
  })

  it('保留 reflection trap 的原始异常身份', () => {
    const failure = new Error('ownKeys failed')
    const style = new Proxy(
      {},
      {
        ownKeys() {
          throw failure
        },
      },
    )
    expect(validatePositionStyleResult(style, false, 'ltr', geometry, basePath)).toEqual({
      ok: false,
      path: basePath,
      cause: failure,
    })
  })
})
