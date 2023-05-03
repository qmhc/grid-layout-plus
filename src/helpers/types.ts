export interface LayoutItemRequired {
  w: number,
  h: number,
  x: number,
  y: number,
  i: number | string
}

export interface LayoutItem extends LayoutItemRequired {
  minW?: number,
  minH?: number,
  maxW?: number,
  maxH?: number,
  moved?: boolean,
  static?: boolean,
  isDraggable?: boolean,
  isResizable?: boolean
}

export type Layout = Array<LayoutItem>

export type Breakpoint = 'xxs' | 'xs' | 'sm' | 'md' | 'lg'
export type Breakpoints = Record<Breakpoint, number>
export type ResponsiveLayout = Record<Breakpoint, Layout>

/** @internal */
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
  isMirrored: boolean,
  increaseItem: (item: any) => void,
  decreaseItem: (item: any) => void
}
