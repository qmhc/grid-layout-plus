# Implementation Plan: v2-docs-update

## Overview

Create 10 new demo Vue components, 20 bilingual example pages (EN + ZH), update 4 guide pages (EN + ZH), and update VitePress sidebar config to fully document grid-layout-plus v2 features.

## Tasks

- [x] 1. Create new demo components (Phase 1: Compactors & Overlap)
  - [x] 1.1 Create `docs/demos/horizontal-compact.vue`
    - Import `horizontalCompactor` and `verticalCompactor` from `grid-layout-plus`
    - Add a `<select>` to toggle between vertical and horizontal compaction
    - Use `#item` slot pattern with standard demo styles
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 Create `docs/demos/no-compact.vue`
    - Import `noCompactor` from `grid-layout-plus`
    - Render GridLayout with `noCompactor` for free-form positioning
    - _Requirements: 2.1, 2.2_
  - [x] 1.3 Create `docs/demos/allow-overlap.vue`
    - Import `withOverlap` and `verticalCompactor` from `grid-layout-plus`
    - Use `withOverlap(verticalCompactor)` as the compactor
    - Add a checkbox to toggle overlap on/off
    - _Requirements: 3.1, 3.2_

- [x] 2. Create new demo components (Phase 2: Resize, Drag, Drop)
  - [x] 2.1 Create `docs/demos/multi-resize-handles.vue`
    - Pass `resizeHandles` prop with multiple directions (e.g. `['se', 'sw', 'ne', 'nw']`)
    - Add checkboxes to toggle individual handle directions
    - _Requirements: 4.1, 4.2_
  - [x] 2.2 Create `docs/demos/drag-threshold.vue`
    - Pass `dragThreshold` prop to GridLayout
    - Add a number input or slider to adjust threshold in pixels
    - _Requirements: 5.1, 5.2_
  - [x] 2.3 Create `docs/demos/native-drop.vue`
    - Enable `is-droppable` and set `:drop-item="{ w: 2, h: 2 }"`
    - Add an external `draggable="true"` element outside the grid
    - Handle `@drop-drag-over`, `@drop`, `@drop-drag-leave` events
    - On `@drop`, push a new item to the layout array
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 3. Create new demo components (Phase 3: Background, Strategy, Config, Composable)
  - [x] 3.1 Create `docs/demos/grid-background.vue`
    - Import `GridBackground` from `grid-layout-plus` (not globally registered)
    - Place `<GridBackground />` inside `<GridLayout>` as a child
    - _Requirements: 7.1, 7.2_
  - [x] 3.2 Create `docs/demos/position-strategy.vue`
    - Import `transformStrategy`, `absoluteStrategy`, `scaledStrategy` from `grid-layout-plus`
    - Add a `<select>` to switch between the three strategies
    - For `scaledStrategy`, include a scale factor input
    - _Requirements: 8.1, 8.2_
  - [x] 3.3 Create `docs/demos/config-grouping.vue`
    - Use `gridConfig`, `dragConfig`, `resizeConfig`, `dropConfig` grouped objects instead of individual props
    - Add interactive controls to modify grouped config values
    - _Requirements: 9.1, 9.2_
  - [x] 3.4 Create `docs/demos/composable-api.vue`
    - Import `useGridLayout` and `useContainerWidth` from `grid-layout-plus`
    - Demonstrate headless layout management without using `<GridLayout>` component
    - _Requirements: 10.1, 10.2_

- [x] 4. Checkpoint - Verify all demos render
  - Ensure all 10 new demo files exist in `docs/demos/` with valid Vue SFC syntax
  - Ensure all demos use kebab-case filenames and produce unique `Demo{PascalName}` component names
  - _Requirements: 17.1, 17.2, 17.3_

- [x] 5. Create English example pages
  - [x] 5.1 Create `docs/example/horizontal-compact.md`
    - Follow pattern: `# Horizontal Compaction` / `## Effect` / `<ClientOnly><DemoHorizontalCompact /></ClientOnly>` / `## Source` / `<<< @/demos/horizontal-compact.vue`
    - _Requirements: 1.4, 16.1_
  - [x] 5.2 Create `docs/example/no-compact.md`
    - Title: `No Compaction`, reference `<DemoNoCompact />`
    - _Requirements: 2.3, 16.1_
  - [x] 5.3 Create `docs/example/allow-overlap.md`
    - Title: `Allow Overlap`, reference `<DemoAllowOverlap />`
    - _Requirements: 3.3, 16.1_
  - [x] 5.4 Create `docs/example/multi-resize-handles.md`
    - Title: `Multi-directional Resize Handles`, reference `<DemoMultiResizeHandles />`
    - _Requirements: 4.3, 16.1_
  - [x] 5.5 Create `docs/example/drag-threshold.md`
    - Title: `Drag Threshold`, reference `<DemoDragThreshold />`
    - _Requirements: 5.3, 16.1_
  - [x] 5.6 Create `docs/example/native-drop.md`
    - Title: `Native Drag & Drop`, reference `<DemoNativeDrop />`
    - _Requirements: 6.4, 16.1_
  - [x] 5.7 Create `docs/example/grid-background.md`
    - Title: `Grid Background`, reference `<DemoGridBackground />`
    - _Requirements: 7.3, 16.1_
  - [x] 5.8 Create `docs/example/position-strategy.md`
    - Title: `Position Strategy`, reference `<DemoPositionStrategy />`
    - _Requirements: 8.3, 16.1_
  - [x] 5.9 Create `docs/example/config-grouping.md`
    - Title: `Config Grouping`, reference `<DemoConfigGrouping />`
    - _Requirements: 9.3, 16.1_
  - [x] 5.10 Create `docs/example/composable-api.md`
    - Title: `Composable API`, reference `<DemoComposableApi />`
    - _Requirements: 10.3, 16.1_

- [x] 6. Create Chinese example pages
  - [x] 6.1 Create `docs/zh/example/horizontal-compact.md`
    - Follow pattern: `# 水平压缩` / `## 效果` / `<ClientOnly><DemoHorizontalCompact /></ClientOnly>` / `## 源码` / `<<< @/demos/horizontal-compact.vue`
    - _Requirements: 1.4, 16.1, 16.3_
  - [x] 6.2 Create `docs/zh/example/no-compact.md`
    - Title: `无压缩`, reference same `<DemoNoCompact />`
    - _Requirements: 2.3, 16.1, 16.3_
  - [x] 6.3 Create `docs/zh/example/allow-overlap.md`
    - Title: `允许重叠`, reference same `<DemoAllowOverlap />`
    - _Requirements: 3.3, 16.1, 16.3_
  - [x] 6.4 Create `docs/zh/example/multi-resize-handles.md`
    - Title: `多方向缩放手柄`, reference same `<DemoMultiResizeHandles />`
    - _Requirements: 4.3, 16.1, 16.3_
  - [x] 6.5 Create `docs/zh/example/drag-threshold.md`
    - Title: `拖拽阈值`, reference same `<DemoDragThreshold />`
    - _Requirements: 5.3, 16.1, 16.3_
  - [x] 6.6 Create `docs/zh/example/native-drop.md`
    - Title: `原生拖放`, reference same `<DemoNativeDrop />`
    - _Requirements: 6.4, 16.1, 16.3_
  - [x] 6.7 Create `docs/zh/example/grid-background.md`
    - Title: `网格背景`, reference same `<DemoGridBackground />`
    - _Requirements: 7.3, 16.1, 16.3_
  - [x] 6.8 Create `docs/zh/example/position-strategy.md`
    - Title: `定位策略`, reference same `<DemoPositionStrategy />`
    - _Requirements: 8.3, 16.1, 16.3_
  - [x] 6.9 Create `docs/zh/example/config-grouping.md`
    - Title: `配置分组`, reference same `<DemoConfigGrouping />`
    - _Requirements: 9.3, 16.1, 16.3_
  - [x] 6.10 Create `docs/zh/example/composable-api.md`
    - Title: `组合式 API`, reference same `<DemoComposableApi />`
    - _Requirements: 10.3, 16.1, 16.3_

- [x] 7. Update English guide pages
  - [x] 7.1 Update `docs/guide/properties.md`
    - Add new GridLayout props section: `compactor`, `positionStrategy`, `resizeHandles`, `isDroppable`, `dropItem`, `dragThreshold`, `gridConfig`, `dragConfig`, `resizeConfig`, `dropConfig`
    - Mark `vertical-compact` as deprecated with note to use `compactor`
    - Mark `use-css-transforms` as deprecated with note to use `positionStrategy`
    - Mark `transform-scale` as deprecated with note to use `scaledStrategy()`
    - Add new GridItem props: `resizeHandles`, `dragThreshold`
    - Add new Types section: `Compactor`, `PositionStrategy`, `ResizeHandle`, `GridConfig`, `DragConfig`, `ResizeConfig`, `DropConfig`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
  - [x] 7.2 Update `docs/guide/events.md`
    - Add new GridLayout events: `drop-drag-over`, `drop`, `drop-drag-leave`
    - Include TypeScript signatures and trigger condition descriptions
    - _Requirements: 12.1, 12.2, 12.3_
  - [x] 7.3 Update `docs/guide/installation.md`
    - Add import examples for `GridBackground`, compactors, position strategies, and composables
    - Note that `GridBackground` requires explicit import
    - _Requirements: 13.1, 13.2_
  - [x] 7.4 Update `docs/guide/usage.md`
    - Replace deprecated `vertical-compact` and `use-css-transforms` with `compactor` and `positionStrategy` in code examples
    - Add brief note about new `compactor` and `positionStrategy` props
    - _Requirements: 14.1, 14.2_

- [x] 8. Update Chinese guide pages
  - [x] 8.1 Update `docs/zh/guide/properties.md`
    - Mirror all changes from English properties.md (task 7.1) in Chinese
    - _Requirements: 11.1, 16.2_
  - [x] 8.2 Update `docs/zh/guide/events.md`
    - Mirror all changes from English events.md (task 7.2) in Chinese
    - _Requirements: 12.1, 16.2_
  - [x] 8.3 Update `docs/zh/guide/installation.md`
    - Mirror all changes from English installation.md (task 7.3) in Chinese
    - _Requirements: 13.1, 13.2, 16.2_
  - [x] 8.4 Update `docs/zh/guide/usage.md`
    - Mirror all changes from English usage.md (task 7.4) in Chinese
    - _Requirements: 14.1, 14.2, 16.2_

- [x] 9. Update VitePress sidebar configuration
  - [x] 9.1 Update `docs/.vitepress/config.ts` English sidebar
    - Append 10 new example links to the English "Example" group after existing entries
    - Links: `horizontal-compact`, `no-compact`, `allow-overlap`, `multi-resize-handles`, `drag-threshold`, `native-drop`, `grid-background`, `position-strategy`, `config-grouping`, `composable-api`
    - _Requirements: 15.1_
  - [x] 9.2 Update `docs/.vitepress/config.ts` Chinese sidebar
    - Append 10 new example links to the Chinese "示例" group after existing entries
    - Fix existing `styling-grid-lines` and `styling-placeholder` links to use `/zh/example/` prefix
    - _Requirements: 15.2, 15.3_

- [x] 10. Final checkpoint - Build verification
  - Ensure VitePress docs build succeeds without unresolved component references
  - Ensure all new demo files are discovered by the glob pattern in `theme/index.ts`
  - Ensure all sidebar links point to valid pages
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 17.2_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- `GridBackground` must be explicitly imported in demos — it is NOT globally registered
- `GridLayout` and `GridItem` are globally registered in VitePress theme — no import needed in demos
- All demo files use kebab-case names and are auto-registered as `Demo{PascalName}` via glob import
- Do NOT modify `es/`, `lib/`, `dist/` build artifacts
- Demo files may have `<style scoped>` blocks; source component `.vue` files must not
