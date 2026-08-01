import { GridLayoutValidationError } from './errors'
import {
  createAbsoluteStyle,
  createTransformStyle,
  validatePositionGeometry,
} from './position-style'

import type { PositionStrategy, PositionStyle } from '../helpers/types'

/**
 * CSS transform translate3d 定位策略（默认）。
 * 等价于现有 setTransform / setTransformRtl。
 */
export const transformStrategy: PositionStrategy = {
  usesCssTransforms: true,
  getStyle(top: number, left: number, width: number, height: number): PositionStyle {
    return createTransformStyle(validatePositionGeometry(top, left, width, height, 'ltr'), 'ltr')
  },
  getRtlStyle(top: number, right: number, width: number, height: number): PositionStyle {
    return createTransformStyle(validatePositionGeometry(top, right, width, height, 'rtl'), 'rtl')
  },
}

/**
 * CSS top/left/right 绝对定位策略。
 * 等价于现有 setTopLeft / setTopRight。
 */
export const absoluteStrategy: PositionStrategy = {
  usesCssTransforms: false,
  getStyle(top: number, left: number, width: number, height: number): PositionStyle {
    return createAbsoluteStyle(validatePositionGeometry(top, left, width, height, 'ltr'), 'ltr')
  },
  getRtlStyle(top: number, right: number, width: number, height: number): PositionStyle {
    return createAbsoluteStyle(validatePositionGeometry(top, right, width, height, 'rtl'), 'rtl')
  },
}

/**
 * 为位于 CSS transform 缩放容器中的网格创建定位策略。
 * 样式保持在布局坐标系中，缩放比例仅用于修正拖拽和缩放的指针坐标。
 */
export function scaledStrategy(scale: number): PositionStrategy {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new GridLayoutValidationError('Scale must be a positive finite number', {
      code: 'invalid-config',
      path: 'config.scale',
      cause: scale,
    })
  }

  return {
    ...transformStrategy,
    usesCssTransforms: true,
    transformScale: scale,
  }
}
