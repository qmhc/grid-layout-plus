import type {
  Breakpoints,
  Compactor,
  Layout,
  PositionStrategy,
  ResizeHandle,
  ResponsiveLayout,
} from '../helpers/types'

export interface GridConfig {
  colNum?: number,
  rowHeight?: number,
  maxRows?: number,
  margin?: number[],
  autoSize?: boolean,
}

export interface DragConfig {
  isDraggable?: boolean,
  dragThreshold?: number,
  restoreOnDrag?: boolean,
}

export interface ResizeConfig {
  isResizable?: boolean,
  resizeHandles?: ResizeHandle[],
}

export interface DropConfig {
  isDroppable?: boolean,
  dropItem?: { w: number, h: number },
}

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
  restoreOnDrag?: boolean,
  layout: Layout,
  responsive?: boolean,
  responsiveLayouts?: Partial<ResponsiveLayout>,
  breakpoints?: Breakpoints,
  cols?: Breakpoints,
  preventCollision?: boolean,
  useStyleCursor?: boolean,

  /** 可插拔压缩器（默认 verticalCompactor） */
  compactor?: Compactor,
  /** 可插拔定位策略（默认 transformStrategy） */
  positionStrategy?: PositionStrategy,
  /** 所有子项的默认缩放手柄方向 */
  resizeHandles?: ResizeHandle[],
  /** 是否允许外部拖入 */
  isDroppable?: boolean,
  /** 外部拖入元素的默认尺寸 */
  dropItem?: { w: number, h: number },
  /** 拖拽阈值（像素） */
  dragThreshold?: number,

  /** 分组配置对象 */
  gridConfig?: GridConfig,
  dragConfig?: DragConfig,
  resizeConfig?: ResizeConfig,
  dropConfig?: DropConfig,
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
  resizeOption?: Record<string, any>,

  /** 缩放手柄方向（覆盖 GridLayout 的默认值） */
  resizeHandles?: ResizeHandle[],
  /** 拖拽阈值（覆盖 GridLayout 的默认值） */
  dragThreshold?: number,
}
