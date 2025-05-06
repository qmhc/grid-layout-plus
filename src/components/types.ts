import type { Breakpoints, Layout, ResponsiveLayout } from '../helpers/types'

export interface GridLayoutProps {
  autoSize?: boolean,
  colNum?: number,
  rowHeight?: number,
  maxRows?: number,
  margin?: number[],
  isDraggable?: boolean,
  isResizable?: boolean,
  isMirrored?: boolean,
  isBounded?: boolean,
  useCssTransforms?: boolean,
  verticalCompact?: boolean,
  restoreOnDrag?: boolean,
  layout: Layout,
  responsive?: boolean,
  responsiveLayouts?: Partial<ResponsiveLayout>,
  transformScale?: number,
  breakpoints?: Breakpoints,
  cols?: Breakpoints,
  preventCollision?: boolean,
  useStyleCursor?: boolean
}

export interface GridItemProps {
  isDraggable?: boolean,
  isResizable?: boolean,
  isBounded?: boolean,
  static?: boolean,
  minH?: number,
  minW?: number,
  maxH?: number,
  maxW?: number,
  x: number,
  y: number,
  w: number,
  h: number,
  i: number | string,
  dragIgnoreFrom?: string,
  dragAllowFrom?: string,
  resizeIgnoreFrom?: string,
  preserveAspectRatio?: boolean,
  dragOption?: Record<string, any>,
  resizeOption?: Record<string, any>
}
