# 实施计划：grid-layout-plus v2.0.0 功能补齐

## 概述

将设计文档中的四个阶段转化为可执行的编码任务。每个任务构建在前一个任务之上，最终将所有模块连接集成。使用 TypeScript strict mode，测试使用 Vitest。

## 任务

- [ ] 1. 阶段 1：核心算法层（基础设施）
  - [x] 1.1 创建核心目录结构
    - 创建 `src/core/` 目录
    - 创建 `src/composables/` 目录
    - _需求: 4.1, 4.2_

  - [x] 1.2 扩展类型定义
    - 在 `src/helpers/types.ts` 中新增 `ResizeHandle`、`Compactor`、`PositionStrategy`、`GridCellDimensions` 类型
    - 更新 `LayoutItem` 接口添加 `resizeHandles?: ResizeHandle[]` 字段
    - 更新 `LayoutInstance` 接口添加 `compactor`、`positionStrategy`、`resizeHandles`、`isDroppable`、`dropItem`、`dragThreshold` 字段
    - _需求: 2.1, 5.1, 14.1_

  - [x] 1.3 实现 PositionStrategy 接口及内置策略
    - 创建 `src/core/position-strategies.ts`
    - 实现 `transformStrategy`（等价于现有 `setTransform`/`setTransformRtl`）
    - 实现 `absoluteStrategy`（等价于现有 `setTopLeft`/`setTopRight`）
    - 实现 `scaledStrategy(scale)` 工厂函数
    - _需求: 14.1, 14.2, 14.3, 14.4_

  - [x] 1.4 编写 PositionStrategy 单元测试
    - 创建 `tests/position-strategies.spec.ts`
    - 测试 `transformStrategy` 输出与现有 `setTransform`/`setTransformRtl` 一致
    - 测试 `absoluteStrategy` 输出与现有 `setTopLeft`/`setTopRight` 一致
    - 测试 `scaledStrategy` 坐标和尺寸按比例缩放
    - _验证: 需求 14.2, 14.3, 14.4_

  - [x] 1.5 实现 Compactor 接口及内置压缩器
    - 创建 `src/core/compactors.ts`
    - 实现 `verticalCompactor`（委托给现有 `compact()` 逻辑）
    - 实现 `horizontalCompactor`（按列优先排序后向左压缩）
    - 实现 `noCompactor`（返回浅拷贝，不移动元素）
    - 实现 `withOverlap(compactor)` 包装函数
    - _需求: 1.1-1.5, 2.1-2.4, 3.1, 3.4_

  - [x] 1.6 编写 Compactor 单元测试
    - 创建 `tests/compactors.spec.ts`
    - 测试 `verticalCompactor` 与现有 `compact(layout, true)` 输出一致
    - 测试 `horizontalCompactor`：元素向左压缩、y 不变、静态元素不动、碰撞处理
    - 测试 `noCompactor`：输出与输入位置相同、返回新数组引用
    - 测试 `withOverlap`：allowOverlap 时跳过碰撞推移
    - 边界用例：空布局、单元素、全静态元素、元素超出列数
    - _验证: 需求 1.1-1.4, 2.2, 2.4, 3.1_

  - [x] 1.7 实现 Fast Compactors
    - 在 `src/core/compactors.ts` 中实现 `fastVerticalCompactor`（O(n log n) 区间树加速）
    - 实现 `fastHorizontalCompactor`（O(n log n) 区间树加速）
    - _需求: 13.1, 13.2_

  - [x] 1.8 编写 Fast Compactor 单元测试
    - 在 `tests/compactors.spec.ts` 中追加测试
    - 使用多组固定布局验证 `fastVerticalCompactor` 与 `verticalCompactor` 输出一致
    - 使用多组固定布局验证 `fastHorizontalCompactor` 与 `horizontalCompactor` 输出一致
    - 测试大布局（100+ 元素）场景下不报错
    - _验证: 需求 13.3, 13.4_

  - [x] 1.9 实现 calcGridCellDimensions 工具函数
    - 创建 `src/core/utils.ts`
    - 实现 `calcGridCellDimensions` 函数
    - _需求: 15.1-15.5_

  - [x] 1.10 编写 calcGridCellDimensions 和 bottom 单元测试
    - 创建 `tests/core-utils.spec.ts`
    - 测试 `calcGridCellDimensions` 计算公式正确性
    - 测试 `bottom()` 返回所有元素中 `max(y + h)` 的值，空布局返回 0
    - _验证: 需求 3.3, 15.3, 15.4, 15.6_

  - [x] 1.11 创建核心聚合导出入口
    - 创建 `src/core.ts`，聚合导出 compactors、position-strategies、utils、helpers/common 中的纯函数和类型
    - 更新 `src/index.ts` 重新导出 CoreAPI 的所有公共符号
    - _需求: 4.1-4.6_

  - [x] 1.12 配置构建系统支持 core 入口
    - 在 `vite.config.ts` 的 `rollupOptions.input` 中添加 `src/core.ts` 入口
    - 在 `package.json` 的 `exports` 中添加 `./core` 路径映射
    - _需求: 4.5_

- [x] 2. 阶段 1 检查点
  - 确保所有测试通过（`pnpm test`），如有问题请向用户确认。

- [x] 3. 阶段 2：组件功能增强
  - [x] 3.1 更新组件类型定义
    - 更新 `src/components/types.ts` 中的 `GridLayoutProps`：移除 `verticalCompact`、`useCssTransforms`、`transformScale`，新增 `compactor`、`positionStrategy`、`resizeHandles`、`isDroppable`、`dropItem`、`dragThreshold`、`gridConfig`、`dragConfig`、`resizeConfig`、`dropConfig`
    - 更新 `GridItemProps`：新增 `resizeHandles`、`dragThreshold`
    - 新增 `GridConfig`、`DragConfig`、`ResizeConfig`、`DropConfig` 接口
    - _需求: 2.5, 2.6, 5.1, 5.4, 6.5, 6.6, 7.1, 7.4, 8.1-8.4, 14.5, 14.6_

  - [x] 3.2 重构 GridLayout 组件集成新接口
    - 修改 `src/components/grid-layout.vue`：
      - 移除 `verticalCompact`、`useCssTransforms`、`transformScale` props
      - 新增 `compactor`（默认 `verticalCompactor`）、`positionStrategy`（默认 `transformStrategy`）props
      - 实现 Config 分组合并逻辑（扁平 props 优先）
      - 将 `compact()` 调用替换为 `compactor.compact()` 委托
      - 通过 provide 向子组件传递 `positionStrategy`、`resizeHandles`、`dragThreshold`
    - _需求: 2.5, 2.6, 8.1-8.6, 14.5, 14.6_

  - [x] 3.3 编写 Config 合并单元测试
    - 创建 `tests/config-merge.spec.tsx`
    - 测试扁平 props 优先级高于分组 config
    - 测试仅传分组 config 时正确生效
    - 测试两者都不传时使用默认值
    - _验证: 需求 8.5, 8.6_

  - [x] 3.4 实现多方向缩放手柄
    - 修改 `src/components/grid-item.vue`：
      - 新增 `resizeHandles` prop（默认从 GridLayout inject，回退 `['se']`）
      - 为每个方向渲染独立的手柄 `<span>` 元素，带方向特定 CSS 类名
      - 更新 `tryMakeResizable` 以根据手柄方向配置 interactjs 的 `edges`
      - 处理 n/w/nw 等方向缩放时同时更新位置和尺寸
    - 在 `src/style.scss` 中添加 8 个方向缩放手柄的定位、光标和视觉样式
    - _需求: 5.1-5.6_

  - [x] 3.5 编写缩放手柄渲染测试
    - 创建 `tests/grid-item-handles.spec.tsx`
    - 测试不同 `resizeHandles` 配置下渲染的手柄 DOM 数量和 CSS 类名
    - 测试默认 `['se']` 只渲染一个手柄
    - 测试空数组不渲染手柄
    - _验证: 需求 5.2, 5.5_

  - [x] 3.6 集成 PositionStrategy 到 GridItem
    - 修改 `src/components/grid-item.vue`：
      - 从 GridLayout inject `positionStrategy`
      - 将 `createStyle` 中的 `setTransform`/`setTopLeft` 等调用替换为 `positionStrategy.getStyle`/`positionStrategy.getRtlStyle`
      - 移除 `state.useCssTransforms` 和 `state.transformScale` 相关逻辑
    - _需求: 14.5, 14.6_

  - [x] 3.7 实现拖拽阈值功能
    - 修改 `src/components/grid-item.vue`：
      - 新增 `dragThreshold` prop（从 GridLayout inject 默认值）
      - 在 `tryMakeDraggable` 中记录 dragstart 位置
      - 在 dragmove 中计算移动距离，未超过阈值时抑制拖拽事件
    - _需求: 7.1-7.4_

  - [x] 3.8 编写拖拽阈值测试
    - 创建 `tests/drag-threshold.spec.tsx`
    - 测试阈值为 0 时立即触发拖拽
    - 测试阈值大于 0 时，移动距离不足不触发拖拽
    - 测试超过阈值后正常触发拖拽
    - _验证: 需求 7.2, 7.3_

  - [x] 3.9 实现外部拖入功能
    - 修改 `src/components/grid-layout.vue`：
      - 新增 `isDroppable`、`dropItem` props
      - 在 template 中绑定 `dragover`、`drop`、`dragleave` 原生事件
      - 实现 `handleDragOver`：计算网格坐标、显示占位符、触发 `drop-drag-over` 事件
      - 实现 `handleDrop`：触发 `drop` 事件、移除占位符
      - 实现 `handleDragLeave`：触发 `drop-drag-leave` 事件、移除占位符
      - 坐标超出范围时 clamp 到有效范围
    - _需求: 6.1-6.6_

  - [x] 3.10 编写外部拖入集成测试
    - 创建 `tests/drop-zone.spec.tsx`
    - 测试 dragover/drop/dragleave 事件触发和占位符显示
    - 测试 `isDroppable=false` 时忽略事件
    - 测试坐标 clamp 到有效范围
    - _验证: 需求 6.1-6.6_

- [x] 4. 阶段 2 检查点
  - 确保所有测试通过（`pnpm test`），如有问题请向用户确认。

- [x] 5. 阶段 3：Composable API
  - [x] 5.1 实现 useContainerWidth composable
    - 创建 `src/composables/useContainerWidth.ts`
    - 使用 ResizeObserver 监听容器宽度变化
    - 元素为 null 时返回 width: -1
    - 组件卸载时自动清理
    - _需求: 9.1-9.5_

  - [x] 5.2 实现 useGridLayout composable
    - 创建 `src/composables/useGridLayout.ts`
    - 接受 layout、cols、rowHeight、compactor、preventCollision 参数
    - 返回 currentLayout、moveItem、resizeItem、addItem、removeItem
    - 操作后自动重新压缩
    - _需求: 10.1-10.7_

  - [x] 5.3 编写 useGridLayout 单元测试
    - 创建 `tests/composables.spec.ts`
    - 测试初始化后 currentLayout 为压缩后的布局
    - 测试 moveItem 后布局正确更新并重新压缩
    - 测试 resizeItem 后布局正确更新并重新压缩
    - 测试 addItem/removeItem 后元素数量正确
    - 测试 id 不存在时静默忽略
    - _验证: 需求 10.2-10.5_

  - [x] 5.4 实现 useResponsiveLayout composable
    - 创建 `src/composables/useResponsiveLayout.ts`
    - 接受 breakpoints、cols、width、layouts、compactor、originalLayout 参数
    - 返回 currentBreakpoint、currentCols、currentLayout
    - 断点切换时自动保存/恢复布局缓存
    - _需求: 11.1-11.7_

  - [x] 5.5 编写 useResponsiveLayout 单元测试
    - 在 `tests/composables.spec.ts` 中追加测试
    - 测试不同 width 值对应正确的断点和列数
    - 测试断点切换时布局自动生成
    - 测试切换回已缓存断点时恢复布局
    - _验证: 需求 11.2-11.6_

  - [x] 5.6 更新公共导出
    - 在 `src/index.ts` 中导出 `useContainerWidth`、`useGridLayout`、`useResponsiveLayout`
    - _需求: 4.6_

- [x] 6. 阶段 3 检查点
  - 确保所有测试通过（`pnpm test`），如有问题请向用户确认。

- [x] 7. 阶段 4：Extras
  - [x] 7.1 实现 GridBackground 组件
    - 创建 `src/components/grid-background.vue`
    - 使用 SVG `<pattern>` 元素渲染网格线
    - 支持 `cols`、`rowHeight`、`margin`、`width`、`rows`、`color`、`strokeWidth` props
    - 通过 inject 从父 GridLayout 获取配置或通过 props 独立使用
    - 在 `src/style.scss` 中添加 GridBackground 样式
    - _需求: 12.1-12.6_

  - [x] 7.2 编写 GridBackground 单元测试
    - 创建 `tests/grid-background.spec.tsx`
    - 测试渲染的 SVG 包含 `<pattern>` 元素
    - 测试 color 和 strokeWidth props 正确应用
    - 测试不同 cols/rowHeight/margin 配置下 pattern 尺寸正确
    - _验证: 需求 12.1-12.5_

  - [x] 7.3 导出 GridBackground 并更新入口
    - 在 `src/index.ts` 中导出 `GridBackground` 组件
    - _需求: 12.1_

- [x] 8. 最终检查点
  - 确保所有测试通过（`pnpm test`），如有问题请向用户确认。
  - 运行 `pnpm lint` 确保代码规范。
  - 运行 `pnpm build` 确保构建通过。

## 备注

- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点确保增量验证
- 所有代码使用 TypeScript strict mode + `<script setup>`
- 样式变更统一写入 `src/style.scss`
