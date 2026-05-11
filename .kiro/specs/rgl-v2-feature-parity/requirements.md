# 需求文档

## 简介

本文档定义 grid-layout-plus v2.0.0 补齐 react-grid-layout v2 所有缺失功能的需求。变更分为四个阶段：核心算法层、组件功能增强、Composable API（headless 模式）、Extras。本次为 Major 版本升级，允许 breaking changes：废弃的 props（`verticalCompact`、`useCssTransforms`、`transformScale`）将被移除，由新的可插拔接口替代。

## 术语表

- **GridLayout**：网格布局容器组件（`<GridLayout>`），负责管理布局状态、压缩、碰撞检测
- **GridItem**：网格布局子项组件（`<GridItem>`），负责拖拽、缩放、定位
- **Layout**：布局数组，类型为 `LayoutItem[]`，描述所有子项的位置与尺寸
- **LayoutItem**：单个布局项，包含 `{ i, x, y, w, h, static?, ... }` 属性
- **Compactor**：压缩器接口，定义 `compact(layout): Layout` 方法，负责消除布局中的空隙
- **VerticalCompactor**：垂直压缩器，将元素向上移动以消除垂直空隙（现有行为）
- **HorizontalCompactor**：水平压缩器，将元素向左移动以消除水平空隙（新增）
- **NoCompactor**：无压缩器，不执行任何压缩操作（新增）
- **AllowOverlap**：允许重叠模式，Compactor 的属性，启用后元素可以重叠放置
- **ResizeHandle**：缩放手柄方向，取值为 `'s' | 'w' | 'e' | 'n' | 'sw' | 'nw' | 'se' | 'ne'`
- **DropZone**：拖放区域，GridLayout 作为外部拖入目标时的行为区域
- **DragThreshold**：拖拽阈值，鼠标移动超过该像素距离后才触发拖拽
- **Composable**：Vue 3 组合式函数（`use*`），提供可复用的响应式逻辑
- **GridBackground**：SVG 网格背景组件，可视化显示网格线
- **PositionStrategy**：定位策略接口，定义元素在 DOM 中的定位方式（transform/absolute/scaled/自定义）
- **FastCompactor**：高性能压缩器，使用 O(n log n) 算法替代默认 O(n²) 实现
- **CoreAPI**：核心算法独立导出模块（`src/core.ts`），不依赖 Vue 的纯函数集合
- **GridCellDimensions**：网格单元格尺寸，包含单元格宽度和高度的计算结果

## 需求

### 需求 1：水平压缩算法

**用户故事：** 作为开发者，我希望布局支持水平方向的压缩，以便元素能自动向左靠拢消除水平空隙。

#### 验收标准

1. WHEN GridLayout 的 `compactType` 属性设置为 `'horizontal'` 时，THE Compactor SHALL 将所有非静态 LayoutItem 向左移动至无碰撞的最小 x 坐标位置
2. WHILE 水平压缩执行期间，THE Compactor SHALL 保持每个 LayoutItem 的 y 坐标不变
3. WHILE 水平压缩执行期间，THE Compactor SHALL 跳过 `static` 属性为 `true` 的 LayoutItem，并将静态元素作为碰撞障碍物处理
4. WHEN 两个非静态 LayoutItem 在水平压缩后占据重叠区域时，THE Compactor SHALL 将后处理的元素放置在先处理元素的右侧（`x = 先处理元素.x + 先处理元素.w`）
5. THE Compactor SHALL 按列优先顺序（先 x 后 y）排序 LayoutItem 后再执行水平压缩

### 需求 2：可插拔 Compactor 接口

**用户故事：** 作为开发者，我希望压缩逻辑可插拔，以便我能选择不同的压缩策略或实现自定义压缩器。

#### 验收标准

1. THE CoreAPI SHALL 导出 `Compactor` 接口，该接口定义 `compact(layout: Layout, cols: number): Layout` 方法签名
2. THE CoreAPI SHALL 导出 `verticalCompactor` 实现，其行为与当前 `compact()` 函数在 `verticalCompact=true` 时的行为一致
3. THE CoreAPI SHALL 导出 `horizontalCompactor` 实现，其行为符合需求 1 的水平压缩规则
4. THE CoreAPI SHALL 导出 `noCompactor` 实现，该实现返回输入布局的浅拷贝且不移动任何元素
5. WHEN GridLayout 的 `compactor` 属性被设置为自定义 Compactor 实例时，THE GridLayout SHALL 使用该自定义实例替代默认压缩器
6. WHEN GridLayout 未设置 `compactor` 属性时，THE GridLayout SHALL 使用 `verticalCompactor` 作为默认压缩器（旧 `verticalCompact` prop 已移除）

### 需求 3：允许重叠模式

**用户故事：** 作为开发者，我希望布局支持元素重叠放置，以便实现自由定位的仪表盘场景。

#### 验收标准

1. WHEN Compactor 的 `allowOverlap` 选项设置为 `true` 时，THE Compactor SHALL 跳过碰撞检测，允许 LayoutItem 之间存在重叠
2. WHEN `allowOverlap` 为 `true` 且用户拖拽 LayoutItem 时，THE GridLayout SHALL 将该元素放置在用户释放的精确网格坐标，不执行碰撞推移
3. WHEN `allowOverlap` 为 `true` 时，THE GridLayout SHALL 仍然正确计算容器高度（基于所有 LayoutItem 的最大 `y + h` 值）
4. WHEN `allowOverlap` 未设置或设置为 `false` 时，THE Compactor SHALL 保持现有碰撞检测与推移行为不变

### 需求 4：核心算法独立导出

**用户故事：** 作为开发者，我希望核心布局算法可以独立于 Vue 使用，以便在 Node.js 脚本或其他框架中复用。

#### 验收标准

1. THE CoreAPI SHALL 通过 `src/core.ts` 入口文件导出所有纯函数，包括：`compact`、`moveElement`、`correctBounds`、`getAllCollisions`、`getFirstCollision`、`collides`、`validateLayout`、`bottom`、`cloneLayout`、`sortLayoutItemsByRowCol`
2. THE CoreAPI SHALL 导出所有 Compactor 相关类型和实现（`Compactor` 接口、`verticalCompactor`、`horizontalCompactor`、`noCompactor`）
3. THE CoreAPI 中的所有函数 SHALL 不依赖 Vue 运行时（不导入 `vue` 包）
4. THE CoreAPI 中的所有函数 SHALL 不依赖浏览器 DOM API
5. WHEN 用户通过 `import { compact } from 'grid-layout-plus/core'` 导入时，THE 构建系统 SHALL 正确解析到 `src/core.ts` 的编译产物
6. THE 公共入口 `src/index.ts` SHALL 重新导出 CoreAPI 的所有公共符号，以保持向后兼容

### 需求 5：多方向缩放手柄

**用户故事：** 作为开发者，我希望 GridItem 支持 8 个方向的缩放手柄，以便用户可以从任意边或角缩放元素。

#### 验收标准

1. THE GridItem SHALL 支持 `resizeHandles` 属性，类型为 `ResizeHandle[]`，默认值为 `['se']`（保持向后兼容）
2. WHEN `resizeHandles` 包含 `'s'`、`'w'`、`'e'`、`'n'`、`'sw'`、`'nw'`、`'se'`、`'ne'` 中的任意值时，THE GridItem SHALL 在对应方向渲染缩放手柄 DOM 元素
3. WHEN 用户通过非默认方向（如 `'n'`、`'w'`、`'nw'`）的手柄缩放时，THE GridItem SHALL 同时更新元素的位置（x 和/或 y）和尺寸（w 和/或 h），使缩放视觉效果正确
4. THE GridLayout SHALL 支持 `resizeHandles` 属性作为所有子项的默认值，单个 GridItem 的 `resizeHandles` 属性优先级高于 GridLayout 的设置
5. WHEN `resizeHandles` 包含多个方向时，THE GridItem SHALL 为每个方向渲染独立的手柄元素，每个手柄具有方向特定的 CSS 类名和光标样式
6. THE `src/style.scss` SHALL 为所有 8 个方向的缩放手柄定义正确的定位（position）、光标（cursor）和视觉样式

### 需求 6：从外部拖入

**用户故事：** 作为开发者，我希望支持从 GridLayout 外部拖入元素，以便实现工具栏拖拽添加组件的交互。

#### 验收标准

1. WHEN 外部可拖拽元素被拖入 GridLayout 区域时，THE GridLayout SHALL 触发 `drop-drag-over` 事件，事件参数包含拖拽位置对应的网格坐标 `{ x, y }` 和原生 DragEvent
2. WHEN 外部可拖拽元素在 GridLayout 区域内移动时，THE GridLayout SHALL 显示占位符（placeholder）预览元素将要放置的位置
3. WHEN 外部可拖拽元素在 GridLayout 区域内释放时，THE GridLayout SHALL 触发 `drop` 事件，事件参数包含最终网格坐标 `{ x, y, w, h }` 和原生 DragEvent
4. WHEN 外部可拖拽元素离开 GridLayout 区域时，THE GridLayout SHALL 触发 `drop-drag-leave` 事件并移除占位符
5. THE GridLayout SHALL 支持 `isDroppable` 属性（默认 `false`），仅当该属性为 `true` 时启用外部拖入功能
6. WHEN `isDroppable` 为 `true` 时，THE GridLayout SHALL 支持 `dropItem` 属性，用于指定拖入元素的默认尺寸 `{ w, h }`

### 需求 7：拖拽阈值

**用户故事：** 作为开发者，我希望能配置拖拽触发的最小移动距离，以便区分点击和拖拽操作，避免误触发。

#### 验收标准

1. THE GridLayout SHALL 支持 `dragThreshold` 属性，类型为 `number`，单位为像素，默认值为 `0`（保持向后兼容）
2. WHEN `dragThreshold` 大于 0 时，THE GridItem SHALL 在鼠标/触摸移动距离超过 `dragThreshold` 像素后才触发 dragstart 事件
3. WHEN 鼠标/触摸移动距离未超过 `dragThreshold` 时，THE GridItem SHALL 不触发任何拖拽相关事件，mouseup/touchend 后视为普通点击
4. THE GridItem SHALL 支持独立的 `dragThreshold` 属性，其优先级高于 GridLayout 的全局设置

### 需求 8：Composable Config 接口

**用户故事：** 作为开发者，我希望将扁平的 props 分组为语义化的配置对象，以便代码更清晰且易于维护。

#### 验收标准

1. THE GridLayout SHALL 支持 `gridConfig` 属性，包含 `colNum`、`rowHeight`、`maxRows`、`margin`、`autoSize` 等网格配置
2. THE GridLayout SHALL 支持 `dragConfig` 属性，包含 `isDraggable`、`dragThreshold`、`restoreOnDrag` 等拖拽配置
3. THE GridLayout SHALL 支持 `resizeConfig` 属性，包含 `isResizable`、`resizeHandles` 等缩放配置
4. THE GridLayout SHALL 支持 `dropConfig` 属性，包含 `isDroppable`、`dropItem` 等拖放配置
5. WHEN 同一配置项同时通过分组属性和扁平属性传入时，THE GridLayout SHALL 以扁平属性的值为准（扁平属性优先级更高）
6. WHEN 仅通过扁平属性传入配置时，THE GridLayout SHALL 保持与 v1.1.1 完全一致的行为（向后兼容）

### 需求 9：useContainerWidth Composable

**用户故事：** 作为开发者，我希望有一个独立的容器宽度测量 composable，以便在 headless 模式下复用响应式宽度逻辑。

#### 验收标准

1. THE `useContainerWidth` Composable SHALL 接受一个 `Ref<HTMLElement | null>` 参数，返回响应式的 `width: Ref<number>`
2. WHEN 传入的 DOM 元素尺寸发生变化时，THE `useContainerWidth` SHALL 在 16ms 内更新 `width` 值（使用 ResizeObserver）
3. WHEN 传入的 DOM 元素为 `null` 时，THE `useContainerWidth` SHALL 返回 `width` 值为 `-1`
4. WHEN 组件卸载时，THE `useContainerWidth` SHALL 自动清理 ResizeObserver 监听，不产生内存泄漏
5. THE `useContainerWidth` SHALL 不依赖 GridLayout 或 GridItem 组件，可独立使用

### 需求 10：useGridLayout Composable

**用户故事：** 作为开发者，我希望有一个核心布局状态管理 composable，以便在不使用 GridLayout 组件的情况下管理布局逻辑。

#### 验收标准

1. THE `useGridLayout` Composable SHALL 接受配置参数（`layout`、`cols`、`rowHeight`、`compactor` 等），返回响应式的布局状态和操作方法
2. THE `useGridLayout` SHALL 返回 `currentLayout: Ref<Layout>`，表示经过压缩后的当前布局
3. THE `useGridLayout` SHALL 返回 `moveItem(i, x, y): void` 方法，用于移动指定元素并触发重新压缩
4. THE `useGridLayout` SHALL 返回 `resizeItem(i, w, h): void` 方法，用于缩放指定元素并触发重新压缩
5. THE `useGridLayout` SHALL 返回 `addItem(item): void` 和 `removeItem(i): void` 方法，用于动态增删元素
6. WHEN 输入的 `layout` 引用发生变化时，THE `useGridLayout` SHALL 自动重新执行压缩并更新 `currentLayout`
7. THE `useGridLayout` SHALL 不依赖浏览器 DOM API，可在 SSR 环境中使用

### 需求 11：useResponsiveLayout Composable

**用户故事：** 作为开发者，我希望有一个响应式断点管理 composable，以便在 headless 模式下复用断点切换逻辑。

#### 验收标准

1. THE `useResponsiveLayout` Composable SHALL 接受 `breakpoints`、`cols`、`width` 和 `layouts` 参数
2. THE `useResponsiveLayout` SHALL 返回 `currentBreakpoint: Ref<Breakpoint>`，表示当前激活的断点
3. THE `useResponsiveLayout` SHALL 返回 `currentCols: Ref<number>`，表示当前断点对应的列数
4. THE `useResponsiveLayout` SHALL 返回 `currentLayout: Ref<Layout>`，表示当前断点对应的布局
5. WHEN `width` 值变化导致断点切换时，THE `useResponsiveLayout` SHALL 自动查找或生成新断点的布局
6. WHEN 断点切换发生时，THE `useResponsiveLayout` SHALL 自动保存切换前的布局到 `layouts` 缓存中
7. THE `useResponsiveLayout` SHALL 不依赖浏览器 DOM API，可在 SSR 环境中使用

### 需求 12：GridBackground 组件

**用户故事：** 作为开发者，我希望有一个网格背景组件，以便在设计模式下可视化显示网格线辅助布局。

#### 验收标准

1. THE GridBackground 组件 SHALL 根据 `cols`、`rowHeight`、`margin` 和容器宽度渲染 SVG 网格线
2. WHEN GridLayout 的尺寸或配置发生变化时，THE GridBackground SHALL 自动重新渲染以匹配新的网格参数
3. THE GridBackground SHALL 支持 `color` 属性（默认 `'rgba(0,0,0,0.1)'`）用于自定义网格线颜色
4. THE GridBackground SHALL 支持 `strokeWidth` 属性（默认 `1`）用于自定义网格线宽度
5. THE GridBackground SHALL 使用 SVG `<pattern>` 元素实现，确保大量网格线时的渲染性能
6. THE GridBackground 的所有样式 SHALL 定义在 `src/style.scss` 中

### 需求 13：Fast Compactors

**用户故事：** 作为开发者，我希望有高性能的压缩算法实现，以便在大量元素（100+）场景下保持流畅。

#### 验收标准

1. THE CoreAPI SHALL 导出 `fastVerticalCompactor` 实现，使用 O(n log n) 时间复杂度的算法
2. THE CoreAPI SHALL 导出 `fastHorizontalCompactor` 实现，使用 O(n log n) 时间复杂度的算法
3. FOR ALL 有效的 Layout 输入，THE `fastVerticalCompactor` SHALL 产生与 `verticalCompactor` 完全一致的输出结果
4. FOR ALL 有效的 Layout 输入，THE `fastHorizontalCompactor` SHALL 产生与 `horizontalCompactor` 完全一致的输出结果
5. WHEN Layout 包含 100 个以上 LayoutItem 时，THE FastCompactor SHALL 比标准 Compactor 具有可测量的性能优势

### 需求 14：可插拔 PositionStrategy

**用户故事：** 作为开发者，我希望元素的 DOM 定位方式可插拔，以便在不同场景下选择最优的定位策略或实现自定义定位。

#### 验收标准

1. THE CoreAPI SHALL 导出 `PositionStrategy` 接口，该接口定义 `getStyle(top: number, left: number, width: number, height: number): Record<string, string>` 方法签名和 `getRtlStyle(top: number, right: number, width: number, height: number): Record<string, string>` 方法签名
2. THE CoreAPI SHALL 导出 `transformStrategy` 实现，其行为与当前 `setTransform` / `setTransformRtl` 函数一致（使用 CSS transform translate3d 定位）
3. THE CoreAPI SHALL 导出 `absoluteStrategy` 实现，其行为与当前 `setTopLeft` / `setTopRight` 函数一致（使用 CSS top/left/right 定位）
4. THE CoreAPI SHALL 导出 `scaledStrategy` 工厂函数，接受 `scale: number` 参数，返回一个将坐标按比例缩放后应用 transform 定位的 PositionStrategy 实例
5. WHEN GridLayout 的 `positionStrategy` 属性被设置为自定义 PositionStrategy 实例时，THE GridItem SHALL 使用该策略生成定位样式
6. WHEN GridLayout 未设置 `positionStrategy` 属性时，THE GridItem SHALL 使用 `transformStrategy` 作为默认定位策略（旧 `useCssTransforms` 和 `transformScale` props 已移除）

### 需求 15：calcGridCellDimensions 工具函数

**用户故事：** 作为开发者，我希望有一个工具函数来计算网格单元格的精确尺寸，以便在自定义渲染或外部集成时获取网格几何信息。

#### 验收标准

1. THE CoreAPI SHALL 导出 `calcGridCellDimensions` 函数，接受参数 `{ containerWidth: number, cols: number, margin: [number, number], rowHeight: number }`
2. THE `calcGridCellDimensions` SHALL 返回 `{ cellWidth: number, cellHeight: number, marginX: number, marginY: number }` 对象
3. THE `cellWidth` 的计算公式 SHALL 为 `(containerWidth - margin[0] * (cols + 1)) / cols`，与 GridItem 内部的 `calcColWidth` 逻辑一致
4. THE `cellHeight` SHALL 等于传入的 `rowHeight` 值
5. THE `calcGridCellDimensions` SHALL 不依赖 Vue 运行时或浏览器 DOM API
6. FOR ALL 有效的输入参数，THE `calcGridCellDimensions` 返回的 `cellWidth` SHALL 为正数（当 `containerWidth` 足够容纳至少一列加两侧 margin 时）
