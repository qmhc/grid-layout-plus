import { GridLayoutValidationError } from './errors'
import {
  createAbsoluteStyle,
  createTransformStyle,
  validatePositionGeometry,
} from './position-style'

import type { PositionStrategy, PositionStyle } from '../helpers/types'

/** The default positioning strategy, which renders items with CSS `translate3d` transforms. */
export const transformStrategy: PositionStrategy = {
  usesCssTransforms: true,
  getStyle(top: number, left: number, width: number, height: number): PositionStyle {
    return createTransformStyle(validatePositionGeometry(top, left, width, height, 'ltr'), 'ltr')
  },
  getRtlStyle(top: number, right: number, width: number, height: number): PositionStyle {
    return createTransformStyle(validatePositionGeometry(top, right, width, height, 'rtl'), 'rtl')
  },
}

/** Positions items with absolute `top` and the direction-appropriate `left` or `right` declaration. */
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
 * Returns a transform strategy for a grid rendered inside a scaled CSS transform context.
 *
 * Generated styles stay in grid coordinates; `scale` only corrects pointer deltas.
 *
 * @param scale - The positive finite CSS scale applied by the containing transform context.
 * @throws {@link GridLayoutValidationError} If `scale` is not positive and finite.
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
