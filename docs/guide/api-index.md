---
title: API Index
description: Find the Grid Layout Plus v2 component, composable, type, method, event, or Core API export for a task.
---

# API Index

Use this page to locate a public v2 symbol. Import components, composables, and component contracts from `grid-layout-plus`. Import the component stylesheet from `grid-layout-plus/style.css`. Import DOM-free algorithms from `grid-layout-plus/core` when you do not need Vue components.

## Choose an API by task

| Task                                       | Start with                                                                                       | Read next                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Render an interactive Vue grid             | [`GridLayout`](./properties#gridlayout) and [`GridItem`](./properties#griditem)                  | [Usage](./usage)                                          |
| Add a visual grid behind items             | [`GridBackground`](./properties#gridbackground)                                                  | [Grid Background example](../example/grid-background)     |
| Customize pointer resize handles           | [`resize-handle` slot](./properties#slots)                                                       | [Custom Resize Handles](../example/custom-resize-handles) |
| Change a rendered grid from code           | [`GridLayoutExpose`](./methods#method-reference)                                                 | [Operation contracts](./contracts)                        |
| Build a custom renderer                    | [`useGridLayout`](./composables#usegridlayout)                                                   | [Composable example](../example/composable-api)           |
| Manage responsive state without components | [`useResponsiveLayout`](./composables#useresponsivelayout)                                       | [Responsive types](./properties#responsive-layouts)       |
| Observe the container width                | [`useContainerWidth`](./composables#usecontainerwidth)                                           | [Width property](./properties#width)                      |
| Validate or normalize Layout data          | [`validateLayout`](./core-api#validatelayout) or [`normalizeLayout`](./core-api#normalizelayout) | [Core API](./core-api)                                    |
| Handle a rejected operation                | [`OperationRejectedPayload`](./contracts#operationrejectedpayload)                               | [Rejection reasons](./contracts#rejection-reasons)        |
| Migrate v1 code                            | [Migration from v1](./migration)                                                                 | [Properties](./properties)                                |

## Components and component contracts

| Public export                                                                                                                                  | Reference                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `GridLayout`                                                                                                                                   | [GridLayout properties](./properties#gridlayout), [events](./events#gridlayout), and [methods](./methods) |
| `GridItem`                                                                                                                                     | [GridItem properties](./properties#griditem) and [events](./events#griditem)                              |
| `GridBackground`                                                                                                                               | [GridBackground properties](./properties#gridbackground)                                                  |
| `GridLayoutProps`, `GridItemProps`                                                                                                             | [Properties](./properties)                                                                                |
| `GridLayoutEmits`, `GridItemEmits`                                                                                                             | [Events](./events)                                                                                        |
| `GridLayoutExpose`, `LayoutTransactionReceipt`                                                                                                 | [Methods](./methods) and [transaction receipts](./contracts#layouttransactionreceipt)                     |
| `GridItemSlots`, `GridItemResizeHandleSlotScope`, `GridLayoutSlots`, `GridLayoutSlotScope`, `GridLayoutResizeHandleSlotScope`                  | [Slots](./properties#slots)                                                                               |
| `GridConfig`, `DragConfig`, `ResizeConfig`                                                                                                     | [Grouped configuration](./properties#grid-config)                                                         |
| `DropConfig`, `DropCandidate`, `DropDragOverInput`, `DropDragOverContext`, `DropEvaluationResult`, `DropCreateItemContext`, `DropCommitResult` | [Drop types](./properties#drop-types) and [drop events](./events#drop-drag-over)                          |
| `TransferConfig`, `GridTransferResult`                                                                                                         | [Transfer types](./properties#transfer-types) and [`transfer`](./events#transfer)                         |
| `LayoutUpdateMeta`, `ResponsiveWidthState`, `WidthChangedPayload`                                                                              | [Events](./events)                                                                                        |
| `InteractionStartPayload`, `InteractionChangePayload`                                                                                          | [Interaction events](./events#interaction-start-interaction-change-interaction-end)                       |

## Layout and extension types

| Public export                                                                                                                                   | Reference                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `LayoutItemRequired`, `LayoutItem`, `ReadonlyLayoutItem`, `Layout`, `ReadonlyLayout`, `ResizeHandleAxis`                                        | [Layout types](./properties#types)                                 |
| `DefaultBreakpoint`, `Breakpoints`                                                                                                              | [Breakpoint types](./properties#defaultbreakpoint-and-breakpoints) |
| `ResponsiveValue`, `ResponsiveLayoutsInput`, `CompleteResponsiveLayouts`                                                                        | [Responsive layout types](./properties#responsive-layouts)         |
| `Breakpoint`, `ResponsiveLayout`                                                                                                                | [Deprecated compatibility aliases](./migration#deprecated-apis)    |
| `CollisionMode`                                                                                                                                 | [Collision mode](./properties#collisionmode)                       |
| `Compactor`, `CompactType`, `CompactMinPositions`                                                                                               | [Compactor contract](./properties#compactor)                       |
| `PositionStrategy`, `PositionStyle`                                                                                                             | [Position strategy contract](./properties#positionstrategy)        |
| `GridCellDimensions`, `CalcGridCellDimensionsInput`, `GridGeometry`, `PixelRect`, `ReadonlyClientRect`                                          | [Geometry types](./properties#geometry-types)                      |
| `LayoutOperationResult`, `LayoutOperationResultBase`, `AcceptedLayoutOperationResult`, `RejectedLayoutOperationResult`, `LayoutOperationReason` | [Operation results](./contracts#layoutoperationresult)             |
| `NormalizeLayoutOptions`, `DeepReadonly`                                                                                                        | [Core API](./core-api) and [Layout types](./properties#types)      |
| `GridLayoutValidationCode`, `GridLayoutExtensionCode`, `GridLayoutExtensionSource`                                                              | [Errors](./contracts#errors)                                       |

## Composables and headless contracts

| Public export                                                                    | Reference                                                                     |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `useGridLayout`, `UseGridLayoutOptions`, `UseGridLayoutReturn`                   | [`useGridLayout`](./composables#usegridlayout)                                |
| `useResponsiveLayout`, `UseResponsiveLayoutOptions`, `UseResponsiveLayoutReturn` | [`useResponsiveLayout`](./composables#useresponsivelayout)                    |
| `useContainerWidth`, `UseContainerWidthOptions`, `UseContainerWidthReturn`       | [`useContainerWidth`](./composables#usecontainerwidth)                        |
| `GridDragState`, `GridResizeState`, `GridInteractionCandidate`                   | [`useGridLayout` returned state](./composables#returned-state-and-operations) |
| `GridInteractionStart`, `GridInteractionStartResult`, `GridInteractionToken`     | [`useGridLayout` interactions](./composables#returned-state-and-operations)   |
| `InteractionCommandResult`, `InteractionCancelReason`                            | [Interaction terminal contract](./contracts#interactionterminalpayload)       |
| `InteractionTerminalBase`, `InteractionTerminalPayload`                          | [Interaction terminal contract](./contracts#interactionterminalpayload)       |
| `LayoutChangeReason`, `OperationRejectedReason`, `OperationRejectedPayload`      | [Operation contracts](./contracts)                                            |
| `GridLayoutRuntimeError`                                                         | [Runtime errors](./contracts#errors)                                          |

## Core values

All values in this section are available from both `grid-layout-plus` and `grid-layout-plus/core`. Prefer the `/core` entry for algorithm-only code.

| Public export                                                                               | Reference                                                               |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `validateLayout`, `normalizeLayout`, `cloneLayout`                                          | [Validate and normalize](./core-api#validate-and-normalize)             |
| `bottom`, `collides`, `getFirstCollision`, `getAllCollisions`, `sortLayoutItemsByRowCol`    | [Query a Layout](./core-api#query-a-layout)                             |
| `correctBounds`, `compact`                                                                  | [Bounds and legacy primitives](./core-api#bounds-and-legacy-primitives) |
| `verticalCompactor`, `horizontalCompactor`, `noCompactor`                                   | [Compactors](./core-api#compactors)                                     |
| `fastVerticalCompactor`, `fastHorizontalCompactor`                                          | [Compactors](./core-api#compactors)                                     |
| `transformStrategy`, `absoluteStrategy`, `scaledStrategy`                                   | [Position strategies](./core-api#position-strategies)                   |
| `calcGridCellDimensions`, `gridToPixelRect`, `pointerToGridPosition`, `pixelSizeToGridSize` | [Geometry conversion](./core-api#geometry-conversion)                   |
| `GridLayoutValidationError`, `GridLayoutExtensionError`                                     | [Errors](./core-api#errors)                                             |
| `moveElement`, `withOverlap`                                                                | [Deprecated APIs](./migration#deprecated-apis)                          |

## Import boundaries

```ts
import { GridLayout, useGridLayout } from 'grid-layout-plus'
import { normalizeLayout, validateLayout } from 'grid-layout-plus/core'
import 'grid-layout-plus/style.css'
```

The JavaScript entries never inject component CSS. Import `grid-layout-plus/style.css` explicitly when rendering components; the `/core` entry has no Vue, DOM, or component CSS dependency. Public APIs not listed here should not be imported from `src`, `es`, `lib`, or another internal path.
