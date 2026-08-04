# grid-layout-plus

## 2.0.0-beta.0

### Major Changes

- [`79aa5fa`](https://github.com/qmhc/grid-layout-plus/commit/79aa5fa59dbeac465a2720424ab03d565fe8805b) Thanks [@qmhc](https://github.com/qmhc)! - Make the parent `Layout` the canonical source of `GridItem` geometry, constraints, interaction
  flags, and stacking order. The corresponding `GridItem` mirror props are deprecated, and internal
  component-ref fields have been replaced by the typed `GridLayoutExpose` command API.

- [`bb74b26`](https://github.com/qmhc/grid-layout-plus/commit/bb74b266bcce6fa6e92e1c4cac294402b6c6a90b) Thanks [@qmhc](https://github.com/qmhc)! - Require external drop item factories, commit created items before emitting `drop`, and support controlled same-group cross-grid moves with rollback.

- [#64](https://github.com/qmhc/grid-layout-plus/pull/64) [`3966b6a`](https://github.com/qmhc/grid-layout-plus/commit/3966b6aa9e650880af19afbeade42e9699b3da95) Thanks [@qmhc](https://github.com/qmhc)! - Adopt a controlled, immutable layout model. `GridLayout` now emits readonly update proposals and
  commits them only after the parent writes `layout` back. Use `v-model:layout` to persist changes
  from interactions and public commands.

- [`865f5da`](https://github.com/qmhc/grid-layout-plus/commit/865f5da486b17d6f97870d24e751afcba27a829d) Thanks [@qmhc](https://github.com/qmhc)! - Stop injecting component styles from JavaScript bundles and publish them through the explicit `grid-layout-plus/style.css` entry for consumer-side CSS processing.

- [`79aa5fa`](https://github.com/qmhc/grid-layout-plus/commit/79aa5fa59dbeac465a2720424ab03d565fe8805b) Thanks [@qmhc](https://github.com/qmhc)! - Replace legacy layout configuration with the v2 contracts. Rename `margin` to `gap`, note that
  `containerPadding` now defaults to `[0, 0]`, and replace `verticalCompact`, `useCssTransforms`, and
  `transformScale` with `compactor` and `positionStrategy`. Grouped grid, drag, resize, and drop
  configuration now merges beneath flat props.

- [`79aa5fa`](https://github.com/qmhc/grid-layout-plus/commit/79aa5fa59dbeac465a2720424ab03d565fe8805b) Thanks [@qmhc](https://github.com/qmhc)! - Enforce strict layout contracts for safe-integer geometry, unique item ids, valid constraints, and
  cloneable plain custom data. Layout algorithms no longer mutate their inputs, and invalid layouts
  now produce structured `GridLayoutValidationError` or rejected operation results.

### Minor Changes

- [`79aa5fa`](https://github.com/qmhc/grid-layout-plus/commit/79aa5fa59dbeac465a2720424ab03d565fe8805b) Thanks [@qmhc](https://github.com/qmhc)! - Add `useGridLayout`, `useResponsiveLayout`, and `useContainerWidth` for headless layout state,
  interaction lifecycles, responsive breakpoint resolution, and container measurement. Responsive
  layouts can also be persisted through synchronized controlled models.

- [`79aa5fa`](https://github.com/qmhc/grid-layout-plus/commit/79aa5fa59dbeac465a2720424ab03d565fe8805b) Thanks [@qmhc](https://github.com/qmhc)! - Add `GridBackground` for rendering grid lines from inherited or explicit geometry, with configurable
  row count, color, and stroke width.

- [`79aa5fa`](https://github.com/qmhc/grid-layout-plus/commit/79aa5fa59dbeac465a2720424ab03d565fe8805b) Thanks [@qmhc](https://github.com/qmhc)! - Expand interaction workflows with typed drag and resize lifecycles, transactional layout commands,
  native and external drop handling, drag thresholds, bounded movement, overlap layering commands,
  and structured operation events.

- [`79aa5fa`](https://github.com/qmhc/grid-layout-plus/commit/79aa5fa59dbeac465a2720424ab03d565fe8805b) Thanks [@qmhc](https://github.com/qmhc)! - Add the Vue-free `grid-layout-plus/core` entry point with immutable layout helpers, normalization,
  compactors, positioning strategies, geometry conversion, structured errors, and public types.

- [`79aa5fa`](https://github.com/qmhc/grid-layout-plus/commit/79aa5fa59dbeac465a2720424ab03d565fe8805b) Thanks [@qmhc](https://github.com/qmhc)! - Add configurable compaction, collision, and positioning strategies, including horizontal, disabled,
  and indexed compactors; push, prevent, and overlap collision modes; and absolute or scaled
  positioning.

- [`853f149`](https://github.com/qmhc/grid-layout-plus/commit/853f14986ad123203a7ff6765965f036e106da33) Thanks [@qmhc](https://github.com/qmhc)! - Add opt-in content-driven item heights with shared observation, controlled layout proposals,
  per-item overrides, collision handling, and width-only pointer resizing.

- [`cf42ee2`](https://github.com/qmhc/grid-layout-plus/commit/cf42ee21a4ab2c20e55b6785782cc4848c732bad) Thanks [@qmhc](https://github.com/qmhc)! - Support configurable resize handles on every edge and corner, with per-item overrides and scoped
  slots for custom handle visuals. Keep the active item anchored under the pointer while the
  placeholder and surrounding items preview the terminal compacted layout.

## [1.1.1](https://github.com/qmhc/grid-layout-plus/compare/v1.1.0...v1.1.1) (2025-10-13)

### 🐞 Bug Fixes

- release detached DOM nodes on destroy ([#56](https://github.com/qmhc/grid-layout-plus/issues/56)) ([20ddeb7](https://github.com/qmhc/grid-layout-plus/commit/20ddeb7d3efcf2ef3e9f14e87f3b548452e022d7))

## [1.1.0](https://github.com/qmhc/grid-layout-plus/compare/v1.0.6...v1.1.0) (2025-05-07)

### 🐞 Bug Fixes

- correct compact layout with responsive ([8c50abc](https://github.com/qmhc/grid-layout-plus/commit/8c50abc5241df3735a5ed44dabdc2db6b2b5e670)), closes [#18](https://github.com/qmhc/grid-layout-plus/issues/18) [#39](https://github.com/qmhc/grid-layout-plus/issues/39)
- RTL resizing issue when widget reaches minimum width ([#41](https://github.com/qmhc/grid-layout-plus/issues/41)) ([1b49972](https://github.com/qmhc/grid-layout-plus/commit/1b49972abe8bf13a501185ab3c95b4a097337c51))
- when window resize trigger resizeEventHandler, placeholder shouldn't hide ([#49](https://github.com/qmhc/grid-layout-plus/issues/49)) ([8ce57d0](https://github.com/qmhc/grid-layout-plus/commit/8ce57d0c79cbf5948fd2e85cd2f215d128d2133a))

### 🔨 Code Refactoring

- use typescript type props ([1e21ff4](https://github.com/qmhc/grid-layout-plus/commit/1e21ff4c280f43d93ae9d799254090a1d68b9c4e))

## [1.0.6](https://github.com/qmhc/grid-layout-plus/compare/v1.0.5...v1.0.6) (2024-11-28)

### 🐞 Bug Fixes

- resizing along the edge should affect only one axis ([#37](https://github.com/qmhc/grid-layout-plus/issues/37)) ([e0b91d5](https://github.com/qmhc/grid-layout-plus/commit/e0b91d545a80516c03d193b6bdbe96d76f76b55c))
- safely read navigator ([#35](https://github.com/qmhc/grid-layout-plus/issues/35)) ([2f10dc8](https://github.com/qmhc/grid-layout-plus/commit/2f10dc8978725ef9fdcda9edbc2d7a63e3e5ac53))

## [1.0.5](https://github.com/qmhc/grid-layout-plus/compare/v1.0.4...v1.0.5) (2024-04-22)

### 🐞 Bug Fixes

- correctly emit layout-ready event ([#20](https://github.com/qmhc/grid-layout-plus/issues/20)) ([703b3be](https://github.com/qmhc/grid-layout-plus/commit/703b3beeeb50bc29e5f2ddcf805be201b66396af))

## [1.0.4](https://github.com/qmhc/grid-layout-plus/compare/v1.0.3...v1.0.4) (2024-01-24)

### 🐞 Bug Fixes

- correctly toggle resize when margin changed ([b690562](https://github.com/qmhc/grid-layout-plus/commit/b690562f3671364e4bb33f436f0d834416239acb)), closes [#10](https://github.com/qmhc/grid-layout-plus/issues/10)

## [1.0.3](https://github.com/qmhc/grid-layout-plus/compare/v1.0.2...v1.0.3) (2023-08-23)

## [1.0.2](https://github.com/qmhc/grid-layout-plus/compare/v1.0.1...v1.0.2) (2023-05-03)

### 🐞 Bug Fixes

- current reactive dragging state for custom ([aa1c4ee](https://github.com/qmhc/grid-layout-plus/commit/aa1c4ee28fe48f95ec50af2c99f6af1397a280f4)), closes [#2](https://github.com/qmhc/grid-layout-plus/issues/2)
- ensure correct event sequence ([5d779d3](https://github.com/qmhc/grid-layout-plus/commit/5d779d313033cbbfda91fce6fcd46097e09d4000)), closes [#1](https://github.com/qmhc/grid-layout-plus/issues/1)

## [1.0.1](https://github.com/qmhc/grid-layout-plus/compare/v1.0.0-beta.3...v1.0.1) (2023-04-26)

## [1.0.0-beta.3](https://github.com/qmhc/grid-layout-plus/compare/v1.0.0-beta.2...v1.0.0-beta.3) (2023-04-23)

### ⚡ Performance Improvements

- throttle drag and resize move events ([56915f4](https://github.com/qmhc/grid-layout-plus/commit/56915f469a671f1a5e0b9b3077601c54b87c4839))

### 🔨 Code Refactoring

- redesign class names of element ([c0ef03c](https://github.com/qmhc/grid-layout-plus/commit/c0ef03c18f801dc4dc3632c53683258bddf09aee))

## [1.0.0-beta.2](https://github.com/qmhc/grid-layout-plus/compare/v1.0.0-beta.1...v1.0.0-beta.2) (2023-04-21)

### ⚡ Performance Improvements

- merge repeated watch callbacks ([4b924a1](https://github.com/qmhc/grid-layout-plus/commit/4b924a13364920ff5944b584c3485aadcf99d4e9))

## [1.0.0-beta.1](https://github.com/qmhc/grid-layout-plus/compare/v1.0.0-beta.0...v1.0.0-beta.1) (2023-04-21)

### 🐞 Bug Fixes

- on demand import interactjs packages ([e270621](https://github.com/qmhc/grid-layout-plus/commit/e270621996f806eaa023995f9328a004af2bbcb9))

### 💔 Reverts

- fix: on demand import interactjs packages ([b87cb8b](https://github.com/qmhc/grid-layout-plus/commit/b87cb8bea7d165179123383344297536980bcc11))

## 1.0.0-beta.0 (2023-04-09)
