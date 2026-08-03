import {
  GridBackground,
  GridItem,
  GridLayout,
  absoluteStrategy,
  bottom,
  calcGridCellDimensions,
  cloneLayout,
  collides,
  compact,
  correctBounds,
  fastHorizontalCompactor,
  fastVerticalCompactor,
  getAllCollisions,
  getFirstCollision,
  horizontalCompactor,
  moveElement,
  noCompactor,
  normalizeLayout,
  scaledStrategy,
  sortLayoutItemsByRowCol,
  transformStrategy,
  useContainerWidth,
  useGridLayout,
  useResponsiveLayout,
  validateLayout,
  verticalCompactor,
  withOverlap,
} from 'grid-layout-plus'
import * as core from 'grid-layout-plus/core'

import type {
  Breakpoint,
  Breakpoints,
  CalcGridCellDimensionsInput,
  CollisionMode,
  CompactMinPositions,
  CompactType,
  Compactor,
  DeepReadonly,
  DragConfig,
  DropConfig,
  GridCellDimensions,
  GridConfig,
  GridItemProps,
  GridItemResizeHandleSlotScope,
  GridItemSlots,
  GridLayoutProps,
  GridLayoutResizeHandleSlotScope,
  GridLayoutSlots,
  Layout,
  LayoutItem,
  LayoutItemRequired,
  PositionStrategy,
  ReadonlyLayout,
  ReadonlyLayoutItem,
  ResizeConfig,
  ResizeHandleAxis,
  ResponsiveLayout,
  ResponsiveLayoutsInput,
  ResponsiveValue,
  UseGridLayoutOptions,
  UseGridLayoutReturn,
  UseResponsiveLayoutOptions,
  UseResponsiveLayoutReturn,
} from 'grid-layout-plus'
// @ts-expect-error LayoutInstance 是组件内部注入上下文，不属于 package root API。
import type { LayoutInstance as PublicLayoutInstance } from 'grid-layout-plus'
export type InternalTypeExclusionCheck = PublicLayoutInstance

void [
  GridBackground,
  GridItem,
  GridLayout,
  useContainerWidth,
  useGridLayout,
  useResponsiveLayout,
  bottom,
  cloneLayout,
  collides,
  compact,
  correctBounds,
  getAllCollisions,
  getFirstCollision,
  moveElement,
  normalizeLayout,
  sortLayoutItemsByRowCol,
  validateLayout,
  fastHorizontalCompactor,
  fastVerticalCompactor,
  horizontalCompactor,
  noCompactor,
  verticalCompactor,
  withOverlap,
  absoluteStrategy,
  scaledStrategy,
  transformStrategy,
  calcGridCellDimensions,
  core,
]

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false
type Expect<Value extends true> = Value

export type BaselineFieldAssertions = [
  Expect<Equal<LayoutItem['i'], string | number>>,
  Expect<Equal<LayoutItem['x'], number>>,
  Expect<Equal<LayoutItem['y'], number>>,
  Expect<Equal<LayoutItem['w'], number>>,
  Expect<Equal<LayoutItem['h'], number>>,
  Expect<Equal<LayoutItem['minW'], number | undefined>>,
  Expect<Equal<LayoutItem['minH'], number | undefined>>,
  Expect<Equal<LayoutItem['maxW'], number | undefined>>,
  Expect<Equal<LayoutItem['maxH'], number | undefined>>,
  Expect<Equal<LayoutItem['moved'], boolean | undefined>>,
  Expect<Equal<LayoutItem['static'], boolean | undefined>>,
  Expect<Equal<LayoutItem['isDraggable'], boolean | undefined>>,
  Expect<Equal<LayoutItem['isResizable'], boolean | undefined>>,
  Expect<Equal<LayoutItem['zIndex'], number | undefined>>,
  Expect<Equal<CollisionMode, 'push' | 'prevent' | 'overlap'>>,
  Expect<Equal<Breakpoint, 'xxs' | 'xs' | 'sm' | 'md' | 'lg'>>,
  Expect<Equal<Breakpoints, Readonly<Record<Breakpoint, number>>>>,
  Expect<Equal<ResponsiveLayout, Record<Breakpoint, Layout>>>,
  Expect<Equal<LayoutItemRequired, Pick<LayoutItem, 'i' | 'x' | 'y' | 'w' | 'h'>>>,
  Expect<
    Equal<GridCellDimensions, { cellWidth: number; cellHeight: number; gapX: number; gapY: number }>
  >,
  Expect<Equal<GridConfig['colNum'], number | undefined>>,
  Expect<Equal<GridConfig['rowHeight'], number | undefined>>,
  Expect<Equal<GridConfig['maxRows'], number | undefined>>,
  Expect<
    Equal<GridConfig['gap'], ResponsiveValue<Breakpoint, readonly [number, number]> | undefined>
  >,
  Expect<Equal<GridConfig['autoSize'], boolean | undefined>>,
  Expect<Equal<DragConfig['isDraggable'], boolean | undefined>>,
  Expect<Equal<DragConfig['dragThreshold'], number | undefined>>,
  Expect<Equal<DragConfig['restoreOnDrag'], boolean | undefined>>,
  Expect<Equal<ResizeConfig['isResizable'], boolean | undefined>>,
  Expect<Equal<DropConfig['isDroppable'], boolean | undefined>>,
  Expect<Equal<DropConfig['dropItem'], Readonly<{ w: number; h: number }> | undefined>>,
  Expect<Equal<GridLayoutProps['autoSize'], boolean | undefined>>,
  Expect<Equal<GridLayoutProps['colNum'], number | undefined>>,
  Expect<Equal<GridLayoutProps['rowHeight'], number | undefined>>,
  Expect<Equal<GridLayoutProps['maxRows'], number | undefined>>,
  Expect<
    Equal<
      GridLayoutProps['gap'],
      ResponsiveValue<Breakpoint, readonly [number, number]> | undefined
    >
  >,
  Expect<Equal<GridLayoutProps['isDraggable'], boolean | undefined>>,
  Expect<Equal<GridLayoutProps['isResizable'], boolean | undefined>>,
  Expect<Equal<GridLayoutProps['isMirrored'], boolean | undefined>>,
  Expect<Equal<GridLayoutProps['isBounded'], boolean | undefined>>,
  Expect<Equal<GridLayoutProps['restoreOnDrag'], boolean | undefined>>,
  Expect<Equal<GridLayoutProps['layout'], ReadonlyLayout>>,
  Expect<Equal<GridLayoutProps['responsive'], boolean | undefined>>,
  Expect<Equal<GridLayoutProps['responsiveLayouts'], ResponsiveLayoutsInput | undefined>>,
  Expect<Equal<GridLayoutProps['breakpoints'], Breakpoints | undefined>>,
  Expect<Equal<GridLayoutProps['cols'], Breakpoints | undefined>>,
  Expect<Equal<GridLayoutProps['collisionMode'], CollisionMode | undefined>>,
  Expect<Equal<GridLayoutProps['preventCollision'], boolean | undefined>>,
  Expect<Equal<GridLayoutProps['bringToFrontOnInteract'], boolean | undefined>>,
  Expect<Equal<GridLayoutProps['useStyleCursor'], boolean | undefined>>,
  Expect<Equal<GridLayoutProps['compactor'], Compactor | undefined>>,
  Expect<Equal<GridLayoutProps['positionStrategy'], PositionStrategy | undefined>>,
  Expect<Equal<GridLayoutProps['isDroppable'], boolean | undefined>>,
  Expect<Equal<GridLayoutProps['dropItem'], Readonly<{ w: number; h: number }> | undefined>>,
  Expect<Equal<GridLayoutProps['dragThreshold'], number | undefined>>,
  Expect<Equal<GridLayoutProps['gridConfig'], GridConfig | undefined>>,
  Expect<Equal<GridLayoutProps['dragConfig'], DragConfig | undefined>>,
  Expect<Equal<GridLayoutProps['resizeConfig'], ResizeConfig | undefined>>,
  Expect<Equal<GridLayoutProps['dropConfig'], DropConfig | undefined>>,
  Expect<Equal<GridItemProps['i'], string | number>>,
  Expect<Equal<GridItemProps['x'], number | undefined>>,
  Expect<Equal<GridItemProps['y'], number | undefined>>,
  Expect<Equal<GridItemProps['w'], number | undefined>>,
  Expect<Equal<GridItemProps['h'], number | undefined>>,
  Expect<Equal<GridItemProps['static'], boolean | undefined>>,
  Expect<Equal<GridItemProps['minW'], number | undefined>>,
  Expect<Equal<GridItemProps['minH'], number | undefined>>,
  Expect<Equal<GridItemProps['maxW'], number | undefined>>,
  Expect<Equal<GridItemProps['maxH'], number | undefined>>,
  Expect<Equal<GridItemProps['isDraggable'], boolean | undefined>>,
  Expect<Equal<GridItemProps['isResizable'], boolean | undefined>>,
  Expect<Equal<GridItemProps['isBounded'], boolean | undefined>>,
  Expect<Equal<GridItemProps['zIndex'], number | undefined>>,
  Expect<Equal<GridItemProps['dragIgnoreFrom'], string | undefined>>,
  Expect<Equal<GridItemProps['dragAllowFrom'], string | undefined>>,
  Expect<Equal<GridItemProps['resizeIgnoreFrom'], string | undefined>>,
  Expect<Equal<GridItemProps['preserveAspectRatio'], boolean | undefined>>,
  Expect<Equal<GridItemProps['dragThreshold'], number | undefined>>,
  Expect<Equal<GridItemResizeHandleSlotScope['axis'], ResizeHandleAxis>>,
  Expect<Equal<GridItemResizeHandleSlotScope['direction'], ResizeHandleAxis>>,
  Expect<
    Equal<Parameters<NonNullable<GridItemSlots['resize-handle']>>[0], GridItemResizeHandleSlotScope>
  >,
  Expect<Equal<GridLayoutResizeHandleSlotScope['item'], ReadonlyLayoutItem>>,
  Expect<Equal<GridLayoutResizeHandleSlotScope['index'], number>>,
  Expect<
    Equal<
      Parameters<NonNullable<GridLayoutSlots['resize-handle']>>[0],
      GridLayoutResizeHandleSlotScope
    >
  >,
  Expect<Equal<Compactor['type'], CompactType | undefined>>,
  Expect<Equal<Compactor['allowOverlap'], boolean | undefined>>,
  Expect<Equal<Parameters<Compactor['compact']>, [layout: ReadonlyLayout, cols: number]>>,
  Expect<Equal<ReturnType<Compactor['compact']>, Layout>>,
  Expect<Equal<PositionStrategy['transformScale'], number | undefined>>,
  Expect<
    Equal<
      Parameters<PositionStrategy['getStyle']>,
      [top: number, left: number, width: number, height: number]
    >
  >,
  Expect<
    Equal<
      Parameters<PositionStrategy['getRtlStyle']>,
      [top: number, right: number, width: number, height: number]
    >
  >,
]

export type BaselineFunctionAssertions = [
  Expect<Equal<typeof bottom, typeof core.bottom>>,
  Expect<Equal<Parameters<typeof bottom>, [layout: ReadonlyLayout]>>,
  Expect<Equal<ReturnType<typeof bottom>, number>>,
  Expect<Equal<Parameters<typeof cloneLayout>, [layout: ReadonlyLayout]>>,
  Expect<Equal<ReturnType<typeof cloneLayout>, Layout>>,
  Expect<
    Equal<Parameters<typeof collides>, [first: ReadonlyLayoutItem, second: ReadonlyLayoutItem]>
  >,
  Expect<Equal<ReturnType<typeof collides>, boolean>>,
  Expect<
    Equal<
      Parameters<typeof correctBounds>,
      [layout: ReadonlyLayout, bounds: Readonly<{ cols: number }>, allowOverlap?: boolean]
    >
  >,
  Expect<
    Equal<
      Parameters<typeof getAllCollisions>,
      [layout: ReadonlyLayout, layoutItem: ReadonlyLayoutItem]
    >
  >,
  Expect<Equal<ReturnType<typeof getAllCollisions>, readonly ReadonlyLayoutItem[]>>,
  Expect<
    Equal<
      Parameters<typeof getFirstCollision>,
      [layout: ReadonlyLayout, layoutItem: ReadonlyLayoutItem]
    >
  >,
  Expect<Equal<ReturnType<typeof getFirstCollision>, ReadonlyLayoutItem | undefined>>,
  Expect<
    Equal<
      Parameters<typeof moveElement>,
      [
        layout: ReadonlyLayout,
        layoutItem: ReadonlyLayoutItem,
        x?: number,
        y?: number,
        isUserAction?: boolean,
        preventCollision?: boolean,
        compactType?: CompactType,
      ]
    >
  >,
  Expect<Equal<Parameters<typeof sortLayoutItemsByRowCol>, [layout: ReadonlyLayout]>>,
  Expect<Equal<ReturnType<typeof sortLayoutItemsByRowCol>, readonly ReadonlyLayoutItem[]>>,
  Expect<Equal<Parameters<typeof validateLayout>, [layout: ReadonlyLayout, contextName?: string]>>,
  Expect<Equal<ReturnType<typeof validateLayout>, void>>,
  Expect<
    Equal<
      Parameters<typeof normalizeLayout>,
      [
        layout: ReadonlyLayout,
        options: Readonly<{
          cols: number
          maxRows?: number
          collisionMode?: CollisionMode
          compactor?: Compactor
        }>,
      ]
    >
  >,
  Expect<Equal<ReturnType<typeof normalizeLayout>, Layout>>,
  Expect<Equal<Parameters<typeof scaledStrategy>, [scale: number]>>,
  Expect<Equal<ReturnType<typeof scaledStrategy>, PositionStrategy>>,
  Expect<
    Equal<Parameters<typeof calcGridCellDimensions>, [input: Readonly<CalcGridCellDimensionsInput>]>
  >,
  Expect<Equal<ReturnType<typeof calcGridCellDimensions>, Readonly<GridCellDimensions>>>,
  Expect<Equal<Parameters<typeof useGridLayout>, [options: UseGridLayoutOptions]>>,
  Expect<Equal<ReturnType<typeof useGridLayout>, UseGridLayoutReturn>>,
  Expect<
    Equal<
      Parameters<typeof useResponsiveLayout<Breakpoint>>,
      [options: UseResponsiveLayoutOptions<Breakpoint>]
    >
  >,
  Expect<
    Equal<ReturnType<typeof useResponsiveLayout<Breakpoint>>, UseResponsiveLayoutReturn<Breakpoint>>
  >,
]

export type PhaseOneTypes = [
  CompactMinPositions,
  DeepReadonly<LayoutItem>,
  ReadonlyLayout,
  ReadonlyLayoutItem,
]
