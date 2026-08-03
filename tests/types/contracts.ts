import {
  GridLayoutExtensionError,
  GridLayoutValidationError,
  compact as compactLayout,
  normalizeLayout,
  useContainerWidth,
  useGridLayout,
  useResponsiveLayout,
} from 'grid-layout-plus'

import type { Ref } from 'vue'
import type {
  CompactMinPositions,
  CompleteResponsiveLayouts,
  GridDragState,
  GridInteractionCandidate,
  GridInteractionStart,
  GridInteractionStartResult,
  GridInteractionToken,
  GridItemEmits,
  GridItemProps,
  GridLayoutEmits,
  GridLayoutExpose,
  GridLayoutProps,
  GridLayoutRuntimeError,
  GridLayoutSlots,
  GridResizeState,
  InteractionCancelReason,
  InteractionCommandResult,
  InteractionTerminalBase,
  InteractionTerminalPayload,
  Layout,
  LayoutChangeReason,
  LayoutOperationResult,
  LayoutOperationResultBase,
  LayoutTransactionReceipt,
  LayoutUpdateMeta,
  OperationRejectedPayload,
  ReadonlyLayout,
  RejectedLayoutOperationResult,
  ResponsiveLayoutsInput,
  UseContainerWidthOptions,
  UseContainerWidthReturn,
  UseGridLayoutOptions,
  UseGridLayoutReturn,
  UseResponsiveLayoutOptions,
  UseResponsiveLayoutReturn,
} from 'grid-layout-plus'
import type {
  LayoutOperationResult as CoreLayoutOperationResult,
  LayoutOperationResultBase as CoreLayoutOperationResultBase,
  RejectedLayoutOperationResult as CoreRejectedLayoutOperationResult,
} from 'grid-layout-plus/core'

type BusinessBreakpoint = 'mobile' | 'desktop'
type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false
type Expect<Value extends true> = Value

type PhaseOneOperationResultExports = [
  Expect<Equal<LayoutOperationResult, CoreLayoutOperationResult>>,
  Expect<Equal<LayoutOperationResultBase, CoreLayoutOperationResultBase>>,
  Expect<Equal<RejectedLayoutOperationResult, CoreRejectedLayoutOperationResult>>,
]

export type { PhaseOneOperationResultExports }

declare function inferBreakpoint<B extends string>(props: GridLayoutProps<B>): B

const layout: Layout = [{ i: 1, x: 0, y: 0, w: 1, h: 1 }]
layout[0].autoHeight = true
const props: GridLayoutProps<BusinessBreakpoint> = {
  layout,
  autoHeight: true,
  responsive: true,
  breakpoints: { mobile: 0, desktop: 1024 },
  cols: { mobile: 2, desktop: 12 },
  responsiveLayouts: {
    mobile: layout,
  },
  gap: {
    mobile: [8, 8],
    desktop: [16, 16],
  },
  containerPadding: {
    mobile: [8, 8],
    desktop: [24, 24],
  },
}
const removedSpacingProp: GridLayoutProps = {
  layout,
  // @ts-expect-error v2 已直接移除 margin，请使用 gap
  margin: [10, 10],
}
const inferredFromBreakpoints = inferBreakpoint({
  layout,
  breakpoints: { mobile: 0, desktop: 1024 },
})
const inferredFromCols = inferBreakpoint({
  layout,
  cols: { mobile: 2, desktop: 12 },
})
const inferredFromLayouts = inferBreakpoint({
  layout,
  responsiveLayouts: { mobile: layout, desktop: layout },
})
const inferredFromSpacing = inferBreakpoint({
  layout,
  gap: { mobile: [8, 8], desktop: [16, 16] },
  containerPadding: { mobile: [8, 8], desktop: [24, 24] },
})

void [
  removedSpacingProp,
  inferredFromBreakpoints,
  inferredFromCols,
  inferredFromLayouts,
  inferredFromSpacing,
]

type InferredBreakpointAssertions = [
  Expect<Equal<typeof inferredFromBreakpoints, BusinessBreakpoint>>,
  Expect<Equal<typeof inferredFromCols, BusinessBreakpoint>>,
  Expect<Equal<typeof inferredFromLayouts, BusinessBreakpoint>>,
  Expect<Equal<typeof inferredFromSpacing, BusinessBreakpoint>>,
]

export type { InferredBreakpointAssertions }

inferBreakpoint({
  layout,
  // @ts-expect-error breakpoints 必须覆盖从 cols 推导出的 tablet 键
  breakpoints: { mobile: 0, desktop: 1024 },
  // @ts-expect-error cols 必须覆盖从 breakpoints 推导出的 desktop 键
  cols: { mobile: 2, tablet: 8 },
})

props.layout[0].i satisfies string | number
// @ts-expect-error 2.0 Layout prop 是递归只读输入
props.layout[0].x = 1
// @ts-expect-error 2.0 Layout prop 不允许追加元素
props.layout.push({ i: 2, x: 1, y: 0, w: 1, h: 1 })

const completeLayouts: CompleteResponsiveLayouts<BusinessBreakpoint> = {
  mobile: layout,
  desktop: layout,
}

// @ts-expect-error 完整响应式布局的断点值是只读 Layout
completeLayouts.mobile[0].y = 2

const minPositions: CompactMinPositions = new Map<string | number, Readonly<{ y: number }>>([
  [1, { y: 0 }],
  ['1', { y: 1 }],
])

minPositions.get(1)?.y satisfies number | undefined
minPositions.get('1')?.y satisfies number | undefined
// @ts-expect-error CompactMinPositions 不再接受旧 Record
const oldMinPositions: CompactMinPositions = { 1: { y: 0 } }
// @ts-expect-error CompactMinPositions value 不再包含 x
const oldPositionX: number = minPositions.get(1)!.x

export { oldMinPositions, oldPositionX }

declare const emitLayout: GridLayoutEmits<BusinessBreakpoint>
declare const emitItem: GridItemEmits
declare const readonlyLayout: ReadonlyLayout
declare const layoutRef: Readonly<Ref<HTMLElement | null>>
declare const transactionReceipt: LayoutTransactionReceipt
declare const resultBase: LayoutOperationResultBase
declare const rejectedResult: RejectedLayoutOperationResult
declare const writableLayout: Ref<Layout>
declare const writableResponsiveLayouts: Ref<ResponsiveLayoutsInput<BusinessBreakpoint>>
declare const nullableWidth: Ref<number | null>
declare const elementRef: Readonly<Ref<HTMLElement | null>>

const publicGridItemProps: GridItemProps = {
  i: 'item',
  autoHeight: true,
  dragOption: { lockAxis: 'start' },
}
publicGridItemProps.x satisfies number | undefined
publicGridItemProps.autoHeight satisfies boolean | undefined
// @ts-expect-error interact option 是 readonly 输入
publicGridItemProps.dragOption!.lockAxis = 'x'

const normalizedLayout = normalizeLayout(readonlyLayout, { cols: 12 })
const compactedLayout = compactLayout(readonlyLayout, false, minPositions)

normalizedLayout.push({ i: 'new', x: 0, y: 0, w: 1, h: 1 })
compactedLayout.push({ i: 'new', x: 0, y: 0, w: 1, h: 1 })

// @ts-expect-error accepted 结果只能使用 reason=applied
const invalidAcceptedResult: LayoutOperationResult = {
  ...resultBase,
  status: 'accepted',
  reason: 'collision',
}
const invalidPendingReceipt: LayoutTransactionReceipt = {
  status: 'pending',
  revision: 1,
  // @ts-expect-error pending receipt 的 proposal 必须是 accepted result
  proposal: rejectedResult,
}

export { invalidAcceptedResult, invalidPendingReceipt }

function assertNever(value: never): never {
  throw new Error(`unexpected receipt: ${String(value)}`)
}

function narrowReceipt(receipt: LayoutTransactionReceipt): number | string {
  switch (receipt.status) {
    case 'pending':
      receipt.proposal.reason satisfies 'applied'
      return receipt.revision
    case 'unchanged':
      receipt.reason satisfies 'same-value'
      return receipt.reason
    case 'rejected':
      receipt.reason satisfies Exclude<LayoutOperationResult['reason'], 'applied' | 'same-value'>
      return receipt.reason
    default:
      return assertNever(receipt)
  }
}

narrowReceipt(transactionReceipt)

emitLayout('update:layout', readonlyLayout, {
  revision: 1,
  source: 'programmatic',
})
emitLayout('update:layout', readonlyLayout, {
  revision: 2,
  source: 'auto-height',
})
emitLayout('breakpoint-changed', 'mobile', readonlyLayout, {
  revision: 2,
  source: 'responsive',
})
// @ts-expect-error 自定义断点之外的名称必须被拒绝
emitLayout('breakpoint-changed', 'tablet', readonlyLayout, {
  revision: 3,
  source: 'responsive',
})
// @ts-expect-error update:layout 必须带 LayoutUpdateMeta
emitLayout('update:layout', readonlyLayout)

emitItem('move', 1, 0, 1)
emitItem('container-resized', '1', 1, 2, '30', '40')
// @ts-expect-error container-resized 的像素尺寸是十进制字符串
emitItem('container-resized', '1', 1, 2, 30, 40)

const slots: GridLayoutSlots = {
  item: scope => {
    scope.item.i satisfies string | number
    return String(scope.index)
  },
  default: () => null,
}

slots.item?.({
  item: readonlyLayout[0],
  index: 0,
  style: { transform: 'translate3d(0px, 0px, 0)' },
  isDragging: false,
  isResizing: false,
})

const expose: GridLayoutExpose = {
  root: layoutRef,
  setLayout: () => transactionReceipt,
  moveItem: () => transactionReceipt,
  resizeItem: () => transactionReceipt,
  addItem: () => transactionReceipt,
  removeItem: () => transactionReceipt,
  bringToFront: () => transactionReceipt,
  sendToBack: () => transactionReceipt,
}

expose.moveItem(1, 2, 3)

const headlessFromRef = useGridLayout({
  layout: writableLayout,
  cols: 12,
  rowHeight: () => 30,
})
const headlessFromLayout = useGridLayout({
  layout: readonlyLayout,
  cols: () => 12,
})

// @ts-expect-error standalone useGridLayout 的 cols 是必填项
useGridLayout({ layout: readonlyLayout })
// @ts-expect-error readonly layout return 不允许替换 value
headlessFromRef.layout.value = []
// @ts-expect-error readonly layout return 不允许修改 item
headlessFromLayout.layout.value[0].x = 2
// @ts-expect-error placeholder 是只读 Ref
headlessFromLayout.placeholder.value = null

headlessFromRef.setLayout(readonlyLayout) satisfies LayoutOperationResult
headlessFromRef.moveItem(1, 1, 0) satisfies LayoutOperationResult
headlessFromRef.resizeItem(1, 2, 2) satisfies LayoutOperationResult
headlessFromRef.addItem(readonlyLayout[0]) satisfies LayoutOperationResult
headlessFromRef.removeItem(1) satisfies LayoutOperationResult
headlessFromRef.bringToFront(1) satisfies LayoutOperationResult
headlessFromRef.sendToBack(1) satisfies LayoutOperationResult

const responsiveHeadless = useResponsiveLayout({
  breakpoints: { mobile: 0, desktop: 1024 },
  cols: { mobile: 2, desktop: 12 },
  width: nullableWidth,
  layout: writableLayout,
  layouts: writableResponsiveLayouts,
  initialFallback: readonlyLayout,
})
const containerWidth = useContainerWidth(elementRef, {
  explicitWidth: nullableWidth.value ?? undefined,
})

responsiveHeadless.currentBreakpoint.value satisfies BusinessBreakpoint | null
responsiveHeadless.completeLayouts
  .value satisfies CompleteResponsiveLayouts<BusinessBreakpoint> | null
containerWidth.width.value satisfies number | null
// @ts-expect-error currentBreakpoint Ref 不允许外部替换
responsiveHeadless.currentBreakpoint.value = 'mobile'
// @ts-expect-error container width Ref 不允许外部替换
containerWidth.width.value = 100

type PhaseThreeComposableExports = [
  Expect<
    Equal<
      Parameters<typeof useResponsiveLayout<BusinessBreakpoint>>,
      [options: UseResponsiveLayoutOptions<BusinessBreakpoint>]
    >
  >,
  Expect<
    Equal<
      ReturnType<typeof useResponsiveLayout<BusinessBreakpoint>>,
      UseResponsiveLayoutReturn<BusinessBreakpoint>
    >
  >,
  Expect<
    Equal<
      Parameters<typeof useContainerWidth>,
      [el: Readonly<Ref<HTMLElement | null>>, options?: Readonly<UseContainerWidthOptions>]
    >
  >,
  Expect<Equal<ReturnType<typeof useContainerWidth>, UseContainerWidthReturn>>,
]

export type { PhaseThreeComposableExports }

const interaction = headlessFromRef.beginInteraction({
  type: 'drag',
  id: 1,
  nativeEvent: null,
})
if (interaction.status === 'accepted') {
  headlessFromRef.updateInteraction(interaction.token, {
    type: 'drag',
    x: 2,
    y: 1,
    nativeEvent: null,
  }) satisfies LayoutOperationResult
  headlessFromRef.endInteraction(interaction.token)
  headlessFromRef.cancelInteraction(interaction.token)
}

type PhaseTwoAComposableExports = [
  Expect<Equal<Parameters<typeof useGridLayout>, [options: UseGridLayoutOptions]>>,
  Expect<Equal<ReturnType<typeof useGridLayout>, UseGridLayoutReturn>>,
  Expect<Equal<UseGridLayoutOptions['layout'], Ref<Layout> | ReadonlyLayout>>,
  Expect<Equal<UseGridLayoutReturn['layout'], Readonly<Ref<ReadonlyLayout>>>>,
  Expect<Equal<GridInteractionStart['type'], 'drag' | 'resize'>>,
  Expect<Equal<GridInteractionCandidate['type'], 'drag' | 'resize'>>,
  Expect<Equal<GridInteractionStartResult['status'], 'accepted' | 'rejected'>>,
  Expect<Equal<InteractionCommandResult['status'], 'terminal' | 'rejected'>>,
  Expect<Equal<GridDragState['status'], 'idle' | 'active'>>,
  Expect<Equal<GridResizeState['status'], 'idle' | 'active'>>,
  Expect<Equal<InteractionTerminalPayload['type'], 'drag' | 'resize'>>,
  Expect<Equal<InteractionTerminalBase['revision'], number | null>>,
  Expect<Equal<OperationRejectedPayload['evaluationId'], number>>,
  Expect<Equal<GridLayoutRuntimeError['revision'], number | null>>,
  Expect<Equal<Extract<LayoutUpdateMeta['source'], 'auto-height'>, 'auto-height'>>,
  Expect<Equal<Extract<GridLayoutRuntimeError['source'], 'auto-height'>, 'auto-height'>>,
]

export type { PhaseTwoAComposableExports }

declare const interactionToken: GridInteractionToken
interactionToken satisfies string
declare const layoutChangeReason: LayoutChangeReason
layoutChangeReason satisfies 'set' | 'move' | 'resize' | 'add' | 'remove' | 'layer' | 'config'
declare const cancelReason: InteractionCancelReason
cancelReason satisfies
  | 'cancelled'
  | 'config-changed'
  | 'external-update'
  | 'external-not-committed'
  | 'disabled'
  | 'unmount'
  | 'geometry-error'
  | 'extension-error'
  | 'extension-invalid-result'

const validationError = new GridLayoutValidationError('invalid', {
  code: 'invalid-layout',
  path: 'layout[0].x',
  cause: Number.NaN,
})
const extensionError = new GridLayoutExtensionError('extension', {
  code: 'extension-invalid-result',
  source: 'compactor',
  path: null,
  cause: {},
})

validationError.code satisfies 'invalid-layout' | 'invalid-config'
extensionError.source satisfies 'compactor' | 'position-strategy' | 'drop-config'
new GridLayoutValidationError('invalid', {
  // @ts-expect-error validation error 不接受 extension code
  code: 'extension-error',
  path: 'layout',
})
