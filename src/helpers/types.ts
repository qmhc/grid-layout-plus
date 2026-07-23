export type CompactType = 'vertical' | 'horizontal'

/** 压缩器接口 */
export interface Compactor {
  /** 碰撞避让方向；自定义压缩器不声明时保持垂直避让的兼容行为 */
  readonly type?: CompactType
  /** 对布局执行压缩，返回新布局（不修改输入） */
  compact(layout: Layout, cols: number): Layout
  /** 是否允许元素重叠 */
  allowOverlap?: boolean
}

/** 定位策略接口 */
export interface PositionStrategy {
  /** 父容器的 CSS 缩放比例，用于将指针坐标还原到布局坐标系 */
  readonly transformScale?: number
  getStyle(top: number, left: number, width: number, height: number): Record<string, string>
  getRtlStyle(top: number, right: number, width: number, height: number): Record<string, string>
}

/** 网格单元格尺寸 */
export interface GridCellDimensions {
  cellWidth: number
  cellHeight: number
  marginX: number
  marginY: number
}

export interface LayoutItemRequired {
  w: number
  h: number
  x: number
  y: number
  i: number | string
}

export interface LayoutItem extends LayoutItemRequired {
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
  moved?: boolean
  static?: boolean
  isDraggable?: boolean
  isResizable?: boolean
}

export type Layout = Array<LayoutItem>

export type Breakpoint = 'xxs' | 'xs' | 'sm' | 'md' | 'lg'
export type Breakpoints = Record<Breakpoint, number>
export type ResponsiveLayout = Record<Breakpoint, Layout>

/** @internal */
export interface LayoutInstance {
  responsive: boolean
  lastBreakpoint: Breakpoint
  cols: Breakpoints
  colNum: number
  rowHeight: number
  width: number
  margin: number[]
  isDraggable: boolean
  isResizable: boolean
  isBounded: boolean
  useStyleCursor: boolean
  maxRows: number
  isMirrored: boolean
  compactor: Compactor
  positionStrategy: PositionStrategy
  isDroppable: boolean
  dropItem: { w: number; h: number }
  dragThreshold: number
  increaseItem: (item: any) => void
  decreaseItem: (item: any) => void
}
