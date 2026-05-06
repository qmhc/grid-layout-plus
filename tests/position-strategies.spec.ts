/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'

import {
  absoluteStrategy,
  transformStrategy,
} from '../src/core/position-strategies'

import {
  setTopLeft,
  setTopRight,
  setTransform,
  setTransformRtl,
} from '../src/helpers/common'

describe('transformStrategy', () => {
  const cases = [
    { top: 0, left: 0, width: 100, height: 50 },
    { top: 10, left: 20, width: 200, height: 100 },
    { top: 0.5, left: 1.5, width: 99.9, height: 33.3 },
    { top: 1000, left: 2000, width: 500, height: 300 },
  ]

  it.each(cases)(
    'getStyle($top, $left, $width, $height) matches setTransform',
    ({ top, left, width, height }) => {
      expect(transformStrategy.getStyle(top, left, width, height)).toEqual(
        setTransform(top, left, width, height),
      )
    },
  )

  it.each(cases)(
    'getRtlStyle($top, $left, $width, $height) matches setTransformRtl',
    ({ top, left: right, width, height }) => {
      expect(transformStrategy.getRtlStyle(top, right, width, height)).toEqual(
        setTransformRtl(top, right, width, height),
      )
    },
  )
})

describe('absoluteStrategy', () => {
  const cases = [
    { top: 0, left: 0, width: 100, height: 50 },
    { top: 10, left: 20, width: 200, height: 100 },
    { top: 0.5, left: 1.5, width: 99.9, height: 33.3 },
    { top: 1000, left: 2000, width: 500, height: 300 },
  ]

  it.each(cases)(
    'getStyle($top, $left, $width, $height) matches setTopLeft',
    ({ top, left, width, height }) => {
      expect(absoluteStrategy.getStyle(top, left, width, height)).toEqual(
        setTopLeft(top, left, width, height),
      )
    },
  )

  it.each(cases)(
    'getRtlStyle($top, $left, $width, $height) matches setTopRight',
    ({ top, left: right, width, height }) => {
      expect(absoluteStrategy.getRtlStyle(top, right, width, height)).toEqual(
        setTopRight(top, right, width, height),
      )
    },
  )
})


