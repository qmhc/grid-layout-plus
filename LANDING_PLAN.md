# Grid Layout Plus 功能落地计划 — 含浏览器级验证

## 一、当前状态

工作区已有一次性堆积的 8 个功能变更，全部测试通过（163/163），但**从未在真实浏览器中逐项验证过视觉表现和交互反馈**。计划的目标是把大变更拆成可独立验证的小步，每步都要在浏览器里"眼见为实"。

---

## 二、环境准备（只需一次）

```bash
# 1. 确认当前在 feature 分支
git checkout feature/major-refactor-landing

# 2. 安装依赖（如未安装）
pnpm install

# 3. 启动 dev-server（保持运行）
pnpm dev
# 默认打开 http://localhost:7888/
```

---

## 三、分步落地与浏览器验证清单

### Step 0 — 类型基础设施（零运行时风险）

**代码范围**：`src/helpers/types.ts` + `src/components/types.ts`

**浏览器验证**：
- 不需要浏览器验证，纯 TypeScript 类型变更。

**验收**：`pnpm test` + `pnpm lint` 通过即可。

---

### Step 1 — Core 纯算法层

**代码范围**：`src/core/compactors.ts` + `src/core/position-strategies.ts` + `src/core/utils.ts`

**浏览器验证**：
- 不需要直接浏览器验证（纯函数，无 DOM/Vue 依赖）。
- 但要确认单元测试覆盖以下边界 case：
  - `verticalCompactor` 与旧 `compact(layout, true)` 输出一致
  - `horizontalCompactor` 对静态元素不移动
  - `withOverlap(noCompactor)` 允许元素重叠时 y 坐标保持不变
  - `scaledStrategy(2)` 的 `getStyle(0,0,100,100)` 输出 `width: 200px`

**验收**：三个测试文件全部通过。

---

### Step 2 — Core 子包导出

**代码范围**：`src/core.ts` + `package.json` + `vite.config.ts`

**浏览器验证**：
- 不需要浏览器验证。
- 验证 `pnpm build` 后产物存在：`es/core.mjs`、`lib/core.js`、`dist/core.d.ts`。

---

### Step 3 — Composable API

**代码范围**：`src/composables/*.ts`

**浏览器验证**：
- 不需要浏览器验证（纯逻辑 API，不依赖 DOM）。
- 但要在 `dev-server/app.vue` 中写一个**最小可复现页面**验证 composable 在真实 Vue 组件中工作：

```vue
<script setup>
import { ref } from 'vue'
import { useGridLayout } from 'grid-layout-plus'

const layout = ref([{ i: 'a', x: 0, y: 0, w: 2, h: 2 }])
const { currentLayout, moveItem } = useGridLayout({ layout, cols: 12 })

function testMove() {
  moveItem('a', 3, 0)
  console.log('rawLayout:', layout.value)
  console.log('currentLayout:', currentLayout.value)
}
</script>

<template>
  <button @click="testMove">moveItem('a', 3, 0)</button>
  <pre>{{ currentLayout }}</pre>
</template>
```

**验证要点**：
- [ ] 点击按钮后 `currentLayout[0].x === 3`
- [ ] `layout.value[0].x` 仍为 0（不修改原始输入）
- [ ] 当前布局经 compactor 压缩后无碰撞

---

### Step 4 — PositionStrategy 替换（🔴 最高风险）

**代码范围**：`src/components/grid-layout.vue` + `src/components/grid-item.vue`

**为什么高风险**：这个改动直接决定每个 grid item 在 DOM 中的定位方式。如果策略切换逻辑有误，会导致元素位置错乱、尺寸异常。

**浏览器验证 — 必做**：

在 `dev-server/` 中创建三个测试页面，分别使用三种策略：

#### 4.1 transformStrategy（默认）
```vue
<GridLayout :layout="layout" :col-num="12" :row-height="30">
  <GridItem v-for="item in layout" :key="item.i" v-bind="item">
    {{ item.i }}
  </GridItem>
</GridLayout>
```

**验证要点**：
- [ ] 打开 DevTools → Elements，选中任意 GridItem
- [ ] 确认 `style` 属性包含 `transform: translate3d(...)`
- [ ] 拖拽一个元素，确认松手后位置正确吸附到网格
- [ ] 窗口缩小时，元素宽度按比例缩小，无溢出或断裂

#### 4.2 absoluteStrategy
```vue
<GridLayout :layout="layout" :col-num="12" :row-height="30" :position-strategy="absoluteStrategy">
  ...
</GridLayout>

<script setup>
import { absoluteStrategy } from 'grid-layout-plus/core'
</script>
```

**验证要点**：
- [ ] DevTools 中确认 `style` 属性包含 `top: ...px; left: ...px`（无 transform）
- [ ] 拖拽、resize 行为与默认策略完全一致
- [ ] 快速拖拽后无"元素漂移"或"位置残留"

#### 4.3 scaledStrategy(2)
```vue
<GridLayout :layout="layout" :col-num="12" :row-height="30" :position-strategy="scaledStrategy(2)">
  ...
</GridLayout>

<script setup>
import { scaledStrategy } from 'grid-layout-plus/core'
</script>
```

**验证要点**：
- [ ] DevTools 中确认每个元素的 `width` / `height` 是实际网格计算值的 2 倍
- [ ] 视觉上元素确实比默认策略大一圈
- [ ] 拖拽时鼠标指针与元素边缘的相对位置保持一致

**回滚触发条件**：
- 任一策略下元素位置明显偏移（>2px）
- 拖拽后元素不吸附或吸附到错误位置
- resize 时尺寸计算错误

---

### Step 5 — Compactor 替换

**代码范围**：`src/components/grid-layout.vue` 中的 `compactLayout()`

**浏览器验证**：

在 `dev-server/` 中创建四个测试布局：

#### 5.1 verticalCompactor（默认，应等同旧行为）
- 放置两个元素：A 在 (0,0)，B 在 (0,2)
- 删除 A
- **预期**：B 自动上浮到 y=0

#### 5.2 noCompactor
```vue
<GridLayout :layout="layout" :compactor="noCompactor">
```

- 放置两个元素：A 在 (0,0)，B 在 (0,2)
- 删除 A
- **预期**：B 保持在 y=2，不上浮

#### 5.3 horizontalCompactor
```vue
<GridLayout :layout="layout" :compactor="horizontalCompactor">
```

- 放置两个元素：A 在 (0,0)，B 在 (2,0)
- 删除 A
- **预期**：B 向左移动到 x=0，y 保持不变

#### 5.4 withOverlap(noCompactor)
```vue
<GridLayout :layout="layout" :compactor="withOverlap(noCompactor)">
```

- 拖拽 B 到 A 的位置
- **预期**：B 可以与 A 重叠，松手后两者 occupy 同一网格单元

**回滚触发条件**：
- 默认 verticalCompactor 与旧行为不一致（元素不上浮或上浮过度）
- allowOverlap 模式下拖拽时 still 触发位置记录导致异常

---

### Step 6 — ResizeHandles 多方向缩放

**代码范围**：`src/components/grid-item.vue` + `src/style.scss`

**浏览器验证**：

#### 6.1 默认 se 手柄（旧行为）
- [ ] 每个 GridItem 右下角出现对角线 resizer
- [ ] 鼠标悬停时 cursor 变为 `se-resize`
- [ ] 拖拽 resize 时宽度和高度同步增加

#### 6.2 全方向手柄
```vue
<GridLayout :layout="layout" :resize-handles="['s','w','e','n','sw','nw','se','ne']">
```

**逐一手柄验证**：

| 手柄 | 鼠标悬停 cursor | 拖拽操作 | 预期视觉反馈 |
|------|----------------|---------|-------------|
| `se` | `se-resize` | 向右下拖 | 宽度和高度同时增加，元素位置不变 |
| `sw` | `sw-resize` | 向左下拖 | 宽度增加、高度增加，元素**向左移动** |
| `ne` | `ne-resize` | 向右上拖 | 宽度增加、高度增加，元素**向上移动** |
| `nw` | `nw-resize` | 向左上拖 | 宽度增加、高度增加，元素**向左上移动** |
| `s` | `s-resize` | 向下拖 | 仅高度增加，宽度不变，位置不变 |
| `n` | `n-resize` | 向上拖 | 仅高度增加，宽度不变，元素**向上移动** |
| `e` | `e-resize` | 向右拖 | 仅宽度增加，高度不变，位置不变 |
| `w` | `w-resize` | 向左拖 | 仅宽度增加，高度不变，元素**向左移动** |

#### 6.3 RTL 模式
```vue
<GridLayout :layout="layout" :is-mirrored="true">
```

- [ ] `se` 手柄的 cursor 变为 `sw-resize`
- [ ] `sw` 手柄的 cursor 变为 `se-resize`
- [ ] 向右拖拽 `e` 手柄时，元素实际向左扩展（RTL 逻辑）

**回滚触发条件**：
- 任意手柄拖拽时元素位置反向移动（如 nw 手柄向右下拖反而使元素向左上跑）
- 手柄在 DOM 中未渲染或样式缺失（无对角线/无边框）
- resize 结束后元素尺寸未正确吸附到网格

---

### Step 7 — DragThreshold

**代码范围**：`src/components/grid-item.vue` 中的拖拽阈值逻辑

**浏览器验证**：

#### 7.1 默认 threshold = 0
- [ ] 鼠标在元素上按下后立即移动 1px，元素即开始跟随拖拽

#### 7.2 threshold = 20
```vue
<GridLayout :layout="layout" :drag-threshold="20">
```

**精确操作**：
- [ ] 鼠标在元素上按下，缓慢移动 10px（<20px）
- [ ] **预期**：元素不移动，仍在原位，无 placeholder 出现
- [ ] 继续移动，总位移超过 20px
- [ ] **预期**：元素突然"粘附"到鼠标位置，开始正常拖拽
- [ ] 松手后元素正确吸附到目标网格位置

#### 7.3 Item 级覆盖
```vue
<GridItem :drag-threshold="50"> <!-- 覆盖 layout 的默认值 --> </GridItem>
```

- [ ] 该 item 需要移动 50px 才触发拖拽，其他 item 仍按 layout 默认值

**回滚触发条件**：
- threshold > 0 时，鼠标微动（<threshold）却触发了拖拽
- 超过 threshold 后元素未正确"接续"拖拽（出现位置跳变）
- dragend 时元素未正确放置

---

### Step 8 — Droppable 外部拖放

**代码范围**：`src/components/grid-layout.vue`

**浏览器验证**：

创建测试页面：
```vue
<template>
  <div draggable="true" @dragstart="handleDragStart">外部可拖元素</div>
  <GridLayout :layout="layout" :is-droppable="true" :drop-item="{ w: 2, h: 2 }"
    @drop="handleDrop" @drop-drag-over="handleDragOver" @drop-drag-leave="handleDragLeave">
    <GridItem v-for="item in layout" :key="item.i" v-bind="item">
      {{ item.i }}
    </GridItem>
  </GridLayout>
</template>
```

**操作步骤**：

1. **drag over**：
   - 从外部拖拽元素进入 GridLayout 区域
   - [ ] 视觉上出现 placeholder（半透明灰色块），尺寸为 2x2（dropItem 配置）
   - [ ] placeholder 跟随鼠标在网格间移动，实时吸附到最近网格单元
   - [ ] 控制台打印 `drop-drag-over` 事件，包含当前网格坐标

2. **drop**：
   - 在目标位置松手
   - [ ] placeholder 消失
   - [ ] 新元素被添加到 layout 中，i 为自动生成
   - [ ] 控制台打印 `drop` 事件
   - [ ] 布局自动压缩（若 compactor 不是 noCompactor）

3. **drag leave**：
   - 拖拽到 GridLayout 外部后松手
   - [ ] placeholder 消失
   - [ ] layout 不发生变化
   - [ ] 控制台打印 `drop-drag-leave` 事件

4. **isDroppable = false（默认）**：
   - [ ] 外部元素拖拽到 GridLayout 上时，浏览器显示"禁止"光标
   - [ ] 无 placeholder 出现

**回滚触发条件**：
- placeholder 尺寸不是 dropItem 配置的尺寸
- placeholder 位置与鼠标实际位置偏差超过一个网格单元
- drop 后新元素未正确插入 layout 或导致现有元素位置错乱

---

### Step 9 — GridBackground

**代码范围**：`src/components/grid-background.vue`

**浏览器验证**：

#### 9.1 独立使用
```vue
<GridBackground :cols="6" :row-height="50" :margin="[10, 10]" :width="600" />
```

- [ ] 页面上出现 SVG 网格，横向 6 列，每格之间有 10px 间隔
- [ ] 网格线颜色为默认 `rgba(0,0,0,0.1)`
- [ ] `:rows="5"` 时 SVG 高度为 5 行

#### 9.2 作为 GridLayout 子组件
```vue
<GridLayout :layout="layout" :col-num="6" :row-height="50">
  <GridBackground />
  <GridItem v-for="item in layout" :key="item.i" v-bind="item">
    {{ item.i }}
  </GridItem>
</GridLayout>
```

- [ ] GridBackground 自动继承 GridLayout 的 colNum、rowHeight、margin、width
- [ ] 网格线与 GridItem 的边界精确对齐（误差 <1px）
- [ ] 窗口 resize 时网格线自动重新计算并对齐

#### 9.3 自定义样式
```vue
<GridBackground color="#ff0000" :stroke-width="2" />
```

- [ ] 网格线变为红色
- [ ] 线宽为 2px

**回滚触发条件**：
- 网格线与 GridItem 边界不对齐（肉眼可见偏差）
- 窗口 resize 后网格不更新
- SVG 尺寸为 0（未正确计算 width/height）

---

### Step 10 — Config Grouping

**代码范围**：`src/components/types.ts` + `src/components/grid-layout.vue`

**浏览器验证**：

```vue
<GridLayout
  :layout="layout"
  :grid-config="{ colNum: 8, rowHeight: 40 }"
  :drag-config="{ isDraggable: false, dragThreshold: 10 }"
  :resize-config="{ isResizable: false }"
>
  ...
</GridLayout>
```

**验证要点**：
- [ ] 扁平 prop `:col-num="12"` 优先级高于 `gridConfig.colNum`，若同时设置则扁平 prop 生效
- [ ] 未设置扁平 prop 时，`gridConfig` 中的值生效（如 `rowHeight: 40`）
- [ ] `dragConfig.isDraggable: false` 时所有元素不可拖拽
- [ ] `resizeConfig.isResizable: false` 时所有元素不可 resize
- [ ] `dragConfig.dragThreshold: 10` 时拖拽阈值生效

**回滚触发条件**：
- 扁平 prop 未覆盖分组 config（优先级错误）
- 分组 config 完全未生效

---

## 四、验证工具链

### 必装浏览器插件
- **Vue DevTools**：验证组件 props、provide/inject 值
- **Page Ruler**：测量元素像素尺寸和位置，验证对齐精度

### 关键 DevTools 操作
1. **验证 PositionStrategy**：
   - Elements → 选中 GridItem → Computed → 查看 `transform` 或 `top/left`
2. **验证 ResizeHandles**：
   - Elements → 选中 `.vgl-item__resizer--se` → 确认 CSS 类名和 cursor
3. **验证 DragThreshold**：
   - Console → 手动执行 `document.addEventListener('dragstart', e => console.log(e))` 观察事件触发时机
4. **验证 Droppable**：
   - Network/Console → 观察 `drop-drag-over`/`drop`/`drop-drag-leave` 事件日志

---

## 五、Rollback 策略

每步验证不通过时的回退方式：

| 步骤 | 回退命令 | 说明 |
|------|---------|------|
| Step 4 | `git checkout HEAD -- src/components/grid-layout.vue src/components/grid-item.vue` | 回退定位策略替换，保留 core |
| Step 5 | `git checkout HEAD -- src/components/grid-layout.vue` | 回退 compactor 替换 |
| Step 6 | `git checkout HEAD -- src/components/grid-item.vue src/style.scss` | 回退多手柄，保留其他 |
| Step 7 | `git checkout HEAD -- src/components/grid-item.vue` | 回退拖拽阈值 |
| Step 8 | `git checkout HEAD -- src/components/grid-layout.vue` | 回退拖放支持 |
| Step 9 | `git checkout HEAD -- src/components/grid-background.vue src/style.scss` | 回退背景组件 |
| Step 10 | `git checkout HEAD -- src/components/grid-layout.vue` | 回退 config 合并逻辑 |

---

## 六、执行顺序建议

```
Day 1: Step 0 → 1 → 2 → 3 （纯代码/类型，无浏览器）
Day 2: Step 4 → 5 （核心组件替换，浏览器验证最耗时）
Day 3: Step 6 → 7 → 8 → 9 → 10 （交互功能，逐个在浏览器验证）
Day 4: 全量回归 + 文档站验证
```

每步执行后必须：
1. `pnpm test` 通过
2. 浏览器验证清单全部打勾
3. `git commit` 锁定 checkpoint
