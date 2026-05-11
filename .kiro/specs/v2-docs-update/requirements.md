# Requirements Document

## Introduction

grid-layout-plus v2.0.0 引入了多项新功能（可插拔压缩器、定位策略、多方向缩放手柄、原生拖放、GridBackground 组件、Composable API、配置分组等），需要全面更新 VitePress 文档站，包括新增 10 个 demo、更新属性/事件参考文档、更新安装/用法指南、更新侧边栏配置，并保持英文和中文双语一致。

## Glossary

- **Documentation_Site**: 基于 VitePress 构建的 grid-layout-plus 文档站，位于 `docs/` 目录
- **Demo_Component**: 位于 `docs/demos/` 下的 Vue SFC 文件，通过 `import.meta.glob` 自动注册为 `Demo{PascalName}` 全局组件
- **Example_Page**: 位于 `docs/example/` (英文) 和 `docs/zh/example/` (中文) 下的 Markdown 页面，引用 Demo_Component 展示效果和源码
- **Guide_Page**: 位于 `docs/guide/` (英文) 和 `docs/zh/guide/` (中文) 下的 Markdown 参考文档页面
- **Sidebar_Config**: `docs/.vitepress/config.ts` 中定义的侧边栏导航配置
- **GridLayout**: 栅格布局容器组件，已全局注册
- **GridItem**: 栅格子元素组件，已全局注册
- **GridBackground**: SVG 网格背景组件，未全局注册，需手动 import
- **Compactor**: 可插拔的布局压缩算法接口
- **PositionStrategy**: 可插拔的元素定位策略接口
- **ResizeHandle**: 缩放手柄方向类型，值为 `'s' | 'w' | 'e' | 'n' | 'sw' | 'nw' | 'se' | 'ne'`

## Requirements

### Requirement 1: 水平压缩 Demo

**User Story:** As a developer, I want to see a demo of horizontal compaction, so that I can understand how to use `horizontalCompactor` to compact items leftward.

#### Acceptance Criteria

1. WHEN the Documentation_Site builds, THE Demo_Component `horizontal-compact.vue` SHALL render a GridLayout with a toggle to switch between `verticalCompactor` and `horizontalCompactor`
2. WHEN a user selects `horizontalCompactor` in the demo, THE GridLayout SHALL compact layout items toward the left
3. THE Demo_Component `horizontal-compact.vue` SHALL import `horizontalCompactor` and `verticalCompactor` from `grid-layout-plus` in its `<script setup>` block
4. THE Example_Page for horizontal compaction SHALL exist at `docs/example/horizontal-compact.md` (English) and `docs/zh/example/horizontal-compact.md` (Chinese), each referencing `<DemoHorizontalCompact />`

### Requirement 2: 无压缩 Demo

**User Story:** As a developer, I want to see a demo of no compaction mode, so that I can understand how to use `noCompactor` for free-form positioning.

#### Acceptance Criteria

1. WHEN the Documentation_Site builds, THE Demo_Component `no-compact.vue` SHALL render a GridLayout using `noCompactor` to demonstrate free-form item positioning
2. THE Demo_Component `no-compact.vue` SHALL import `noCompactor` from `grid-layout-plus` in its `<script setup>` block
3. THE Example_Page for no compaction SHALL exist at `docs/example/no-compact.md` (English) and `docs/zh/example/no-compact.md` (Chinese), each referencing `<DemoNoCompact />`

### Requirement 3: 允许重叠 Demo

**User Story:** As a developer, I want to see a demo of overlapping items, so that I can understand how to use `withOverlap()` to allow grid items to overlap.

#### Acceptance Criteria

1. WHEN the Documentation_Site builds, THE Demo_Component `allow-overlap.vue` SHALL render a GridLayout using `withOverlap(verticalCompactor)` to demonstrate overlapping items
2. THE Demo_Component `allow-overlap.vue` SHALL import `withOverlap` and `verticalCompactor` from `grid-layout-plus` in its `<script setup>` block
3. THE Example_Page for allow overlap SHALL exist at `docs/example/allow-overlap.md` (English) and `docs/zh/example/allow-overlap.md` (Chinese), each referencing `<DemoAllowOverlap />`

### Requirement 4: 多方向缩放手柄 Demo

**User Story:** As a developer, I want to see a demo of multi-directional resize handles, so that I can understand how to configure `resizeHandles` on GridLayout and GridItem.

#### Acceptance Criteria

1. WHEN the Documentation_Site builds, THE Demo_Component `multi-resize-handles.vue` SHALL render a GridLayout with `resizeHandles` prop set to multiple directions (e.g. `['se', 'sw', 'ne', 'nw']`)
2. THE Demo_Component SHALL include interactive controls to toggle different resize handle combinations
3. THE Example_Page for multi-resize handles SHALL exist at `docs/example/multi-resize-handles.md` (English) and `docs/zh/example/multi-resize-handles.md` (Chinese), each referencing `<DemoMultiResizeHandles />`

### Requirement 5: 拖拽阈值 Demo

**User Story:** As a developer, I want to see a demo of drag threshold, so that I can understand how `dragThreshold` prevents accidental drags.

#### Acceptance Criteria

1. WHEN the Documentation_Site builds, THE Demo_Component `drag-threshold.vue` SHALL render a GridLayout with a configurable `dragThreshold` value
2. THE Demo_Component SHALL include an interactive control (e.g. slider or input) to adjust the threshold in pixels
3. THE Example_Page for drag threshold SHALL exist at `docs/example/drag-threshold.md` (English) and `docs/zh/example/drag-threshold.md` (Chinese), each referencing `<DemoDragThreshold />`

### Requirement 6: 原生拖放 Demo

**User Story:** As a developer, I want to see a demo of native HTML5 drag-and-drop into the grid, so that I can understand how to use `isDroppable`, `dropItem`, and the drop-related events.

#### Acceptance Criteria

1. WHEN the Documentation_Site builds, THE Demo_Component `native-drop.vue` SHALL render a GridLayout with `is-droppable` enabled and a draggable external element
2. THE Demo_Component SHALL handle `@drop-drag-over`, `@drop`, and `@drop-drag-leave` events from GridLayout
3. WHEN a user drags the external element into the grid, THE Demo_Component SHALL add a new item to the layout at the drop position
4. THE Example_Page for native drop SHALL exist at `docs/example/native-drop.md` (English) and `docs/zh/example/native-drop.md` (Chinese), each referencing `<DemoNativeDrop />`

### Requirement 7: GridBackground Demo

**User Story:** As a developer, I want to see a demo of the GridBackground component, so that I can understand how to add an SVG grid background to the layout.

#### Acceptance Criteria

1. WHEN the Documentation_Site builds, THE Demo_Component `grid-background.vue` SHALL render a GridLayout containing a `<GridBackground />` child component
2. THE Demo_Component `grid-background.vue` SHALL import `GridBackground` from `grid-layout-plus` in its `<script setup>` block, because GridBackground is not globally registered
3. THE Example_Page for grid background SHALL exist at `docs/example/grid-background.md` (English) and `docs/zh/example/grid-background.md` (Chinese), each referencing `<DemoGridBackground />`

### Requirement 8: 定位策略 Demo

**User Story:** As a developer, I want to see a demo of position strategies, so that I can understand how to switch between `transformStrategy`, `absoluteStrategy`, and `scaledStrategy`.

#### Acceptance Criteria

1. WHEN the Documentation_Site builds, THE Demo_Component `position-strategy.vue` SHALL render a GridLayout with a selector to switch between `transformStrategy`, `absoluteStrategy`, and `scaledStrategy`
2. THE Demo_Component SHALL import `transformStrategy`, `absoluteStrategy`, and `scaledStrategy` from `grid-layout-plus` in its `<script setup>` block
3. THE Example_Page for position strategy SHALL exist at `docs/example/position-strategy.md` (English) and `docs/zh/example/position-strategy.md` (Chinese), each referencing `<DemoPositionStrategy />`

### Requirement 9: 配置分组 Demo

**User Story:** As a developer, I want to see a demo of config grouping, so that I can understand how to use `gridConfig`, `dragConfig`, `resizeConfig`, and `dropConfig` to organize props.

#### Acceptance Criteria

1. WHEN the Documentation_Site builds, THE Demo_Component `config-grouping.vue` SHALL render a GridLayout using grouped config objects (`gridConfig`, `dragConfig`, `resizeConfig`, `dropConfig`) instead of individual props
2. THE Demo_Component SHALL include interactive controls to modify grouped config values
3. THE Example_Page for config grouping SHALL exist at `docs/example/config-grouping.md` (English) and `docs/zh/example/config-grouping.md` (Chinese), each referencing `<DemoConfigGrouping />`

### Requirement 10: Composable API Demo

**User Story:** As a developer, I want to see a demo of the Composable API, so that I can understand how to use `useGridLayout` and `useContainerWidth` for headless layout management.

#### Acceptance Criteria

1. WHEN the Documentation_Site builds, THE Demo_Component `composable-api.vue` SHALL demonstrate usage of `useGridLayout` and `useContainerWidth` composables
2. THE Demo_Component SHALL import `useGridLayout` and `useContainerWidth` from `grid-layout-plus` in its `<script setup>` block
3. THE Example_Page for composable API SHALL exist at `docs/example/composable-api.md` (English) and `docs/zh/example/composable-api.md` (Chinese), each referencing `<DemoComposableApi />`

### Requirement 11: 属性参考文档更新

**User Story:** As a developer, I want the properties reference to document all v2 props, so that I can find accurate API information for both new and deprecated props.

#### Acceptance Criteria

1. THE Guide_Page `properties.md` (English) and `zh/guide/properties.md` (Chinese) SHALL document the following new GridLayout props: `compactor`, `positionStrategy`, `resizeHandles`, `isDroppable`, `dropItem`, `dragThreshold`, `gridConfig`, `dragConfig`, `resizeConfig`, `dropConfig`
2. THE Guide_Page `properties.md` SHALL mark `vertical-compact` as deprecated and reference `compactor` as its replacement
3. THE Guide_Page `properties.md` SHALL mark `use-css-transforms` as deprecated and reference `positionStrategy` as its replacement
4. THE Guide_Page `properties.md` SHALL mark `transform-scale` as deprecated and reference `scaledStrategy()` as its replacement
5. THE Guide_Page `properties.md` SHALL document the following new GridItem props: `resizeHandles`, `dragThreshold`
6. THE Guide_Page `properties.md` SHALL document the new types: `Compactor`, `PositionStrategy`, `ResizeHandle`, `GridConfig`, `DragConfig`, `ResizeConfig`, `DropConfig`

### Requirement 12: 事件参考文档更新

**User Story:** As a developer, I want the events reference to document all v2 events, so that I can find accurate event signatures for the new drop-related events.

#### Acceptance Criteria

1. THE Guide_Page `events.md` (English) and `zh/guide/events.md` (Chinese) SHALL document the following new GridLayout events: `drop-drag-over`, `drop`, `drop-drag-leave`
2. THE Guide_Page `events.md` SHALL include the TypeScript signature for each new event
3. THE Guide_Page `events.md` SHALL describe the trigger condition and parameters for each new event

### Requirement 13: 安装指南更新

**User Story:** As a developer, I want the installation guide to show how to import new v2 exports, so that I can correctly set up compactors, strategies, and composables.

#### Acceptance Criteria

1. THE Guide_Page `installation.md` (English) and `zh/guide/installation.md` (Chinese) SHALL include an import example showing `GridBackground`, compactors (`verticalCompactor`, `horizontalCompactor`, `noCompactor`), position strategies (`transformStrategy`, `absoluteStrategy`, `scaledStrategy`), and composables (`useGridLayout`, `useContainerWidth`)
2. THE Guide_Page `installation.md` SHALL note that `GridBackground` requires explicit import and is not included in the default `GridLayout`/`GridItem` registration

### Requirement 14: 用法指南更新

**User Story:** As a developer, I want the usage guide to reflect v2 API changes, so that I can follow up-to-date examples.

#### Acceptance Criteria

1. THE Guide_Page `usage.md` (English) and `zh/guide/usage.md` (Chinese) SHALL replace deprecated props (`vertical-compact`, `use-css-transforms`) with their v2 equivalents (`compactor`, `positionStrategy`) in all code examples
2. THE Guide_Page `usage.md` SHALL include a brief section or note about the new `compactor` and `positionStrategy` props in the component usage examples

### Requirement 15: 侧边栏配置更新

**User Story:** As a developer, I want the sidebar navigation to include all new demo pages, so that I can discover and navigate to all v2 examples.

#### Acceptance Criteria

1. THE Sidebar_Config SHALL include links to all 10 new Example_Pages in the English "Example" group, appended after existing entries
2. THE Sidebar_Config SHALL include links to all 10 new Example_Pages in the Chinese "示例" group, appended after existing entries
3. THE Sidebar_Config SHALL fix the existing Chinese sidebar links for `styling-grid-lines` and `styling-placeholder` to use the `/zh/example/` prefix instead of `/example/`

### Requirement 16: 双语一致性

**User Story:** As a developer, I want English and Chinese documentation to be consistent, so that I can use either language and get the same information.

#### Acceptance Criteria

1. FOR EACH new Example_Page in English, THE Documentation_Site SHALL have a corresponding Chinese Example_Page referencing the same Demo_Component
2. FOR EACH new or updated section in English Guide_Pages, THE Documentation_Site SHALL have a corresponding Chinese translation in the matching Chinese Guide_Page
3. THE English and Chinese Example_Pages SHALL use the same Demo_Component name and source code reference path

### Requirement 17: Demo 自动注册兼容性

**User Story:** As a developer, I want new demos to be automatically discovered without modifying the theme, so that the existing glob-based registration continues to work.

#### Acceptance Criteria

1. THE Demo_Component files SHALL be placed in `docs/demos/` directory with kebab-case filenames ending in `.vue`
2. WHEN the Documentation_Site builds, THE theme `index.ts` glob pattern `../../demos/*.vue` SHALL match all new Demo_Component files without modification
3. THE Demo_Component filenames SHALL produce unique `Demo{PascalName}` component names that do not conflict with existing registered components
