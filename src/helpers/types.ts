export type LayoutItemRequired = { w: number, h: number, x: number, y: number, i: number | string }
export type LayoutItem = LayoutItemRequired &
{
  minW?: number, minH?: number, maxW?: number, maxH?: number,
  moved?: boolean, static?: boolean,
  isDraggable?: boolean, isResizable?: boolean
}
export type Layout = Array<LayoutItem>

export type Size = { width: number, height: number }

export type Breakpoint = 'xxs' | 'xs' | 'sm' | 'md' | 'lg'
export type Breakpoints = Record<Breakpoint, number>
export type ResponsiveLayout = Record<Breakpoint, Layout>

export interface LayoutInstance {
  responsive: boolean,
  lastBreakpoint: Breakpoint,
  cols: Breakpoints,
  colNum: number,
  rowHeight: number,
  width: number,
  margin: number[],
  isDraggable: boolean,
  isResizable: boolean,
  isBounded: boolean,
  transformScale: number,
  useCssTransforms: boolean,
  useStyleCursor: boolean,
  maxRows: number,
  isMirrored: boolean
}
