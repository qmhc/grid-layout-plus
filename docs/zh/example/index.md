---
aside: false
---

# 示例

第一次使用可以先看[基础用法](./basic)。已经有明确需求时，直接按功能查找。

## 基础布局

- [基础用法](./basic) — 布局数据、拖拽、缩放和静态栅格项。
- [动态增减栅格项](./dynamic-add-remove) — 在运行时增加和删除栅格项。
- [内容驱动高度](./auto-height) — 渲染内容变化时自动调整栅格行数。
- [移动和缩放事件](./events) — 监听交互过程和结束时的事件。

## 交互约束

- [拖拽和缩放手柄](./drag-resize-handler) — 将交互限制在指定手柄上。
- [栅格项限制在容器内](./bounded) — 防止栅格项越过栅格边界。
- [拖拽阈值](./drag-threshold) — 调整开始拖拽前所需的移动距离。
- [阻止碰撞](./prevent-collision) — 拒绝与其他栅格项重叠的位置。
- [允许重叠](./allow-overlap) — 叠放栅格项并调整层级。

## 响应式与定位

- [响应式](./responsive) — 随断点切换列数与布局行为。
- [预设响应式布局](./responsive-layouts) — 为指定断点提供显式布局。
- [镜像栅格布局](./mirrored) — 将逻辑原点放在右侧。
- [水平压缩](./horizontal-compact) — 沿水平方向压缩栅格项。
- [无压缩](./no-compact) — 保留栅格中的空白区域。
- [定位策略](./position-strategy) — 对比 transform、绝对定位与缩放定位。

## 拖放

- [原生拖放](./native-drop) — 使用原生拖拽事件添加固定尺寸的栅格项。
- [从外部拖入](./drag-from-outside) — 为不同来源设置尺寸和放置规则。
- [跨网格拖拽](./cross-grid) — 在多个受控栅格之间移动完整栅格项。

## 样式定制

- [定制栅格线](./styling-grid-lines) — 绘制跟随布局尺寸变化的栅格线。
- [定制占位符](./styling-placeholder) — 调整交互时显示的占位符。
- [栅格背景](./grid-background) — 使用 `GridBackground` 绘制栅格线。

## 高级 API

- [配置分组](./config-grouping) — 分组组织栅格、拖拽、缩放与放置配置。
- [组合式 API](./composable-api) — 使用布局引擎和自定义页面结构。
