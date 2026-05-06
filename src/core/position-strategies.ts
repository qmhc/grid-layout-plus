import type { PositionStrategy } from '../helpers/types'

/**
 * CSS transform translate3d 定位策略（默认）。
 * 等价于现有 setTransform / setTransformRtl。
 */
export const transformStrategy: PositionStrategy = {
  getStyle(top: number, left: number, width: number, height: number): Record<string, string> {
    const translate = `translate3d(${left}px,${top}px, 0)`
    return {
      transform: translate,
      WebkitTransform: translate,
      MozTransform: translate,
      msTransform: translate,
      OTransform: translate,
      width: `${width}px`,
      height: `${height}px`,
      position: 'absolute',
    }
  },
  getRtlStyle(top: number, right: number, width: number, height: number): Record<string, string> {
    const translate = `translate3d(${right * -1}px,${top}px, 0)`
    return {
      transform: translate,
      WebkitTransform: translate,
      MozTransform: translate,
      msTransform: translate,
      OTransform: translate,
      width: `${width}px`,
      height: `${height}px`,
      position: 'absolute',
    }
  },
}

/**
 * CSS top/left/right 绝对定位策略。
 * 等价于现有 setTopLeft / setTopRight。
 */
export const absoluteStrategy: PositionStrategy = {
  getStyle(top: number, left: number, width: number, height: number): Record<string, string> {
    return {
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      height: `${height}px`,
      position: 'absolute',
    }
  },
  getRtlStyle(top: number, right: number, width: number, height: number): Record<string, string> {
    return {
      top: `${top}px`,
      right: `${right}px`,
      width: `${width}px`,
      height: `${height}px`,
      position: 'absolute',
    }
  },
}


