# Grid Layout Plus — 系统规则

## 项目边界

Vue 3 网格布局组件库；组件使用 `<script setup lang="ts">`，TypeScript 开启 strict mode。

- 禁止直接修改 `es/`、`lib/`、`dist/`；它们由 `pnpm build` 生成
- `.vue` 文件只使用 `<template>` 和 `<script>`；样式统一写入 `src/style.scss`
- 禁止以 watch 模式运行 Vitest；使用 `pnpm test`（`vitest run`）
- 修改依赖后必须运行 `pnpm install`
- 修改发布流程前先阅读 `RELEASING.md`；禁止手动修改版本号、`CHANGELOG.md` 或发布 tag

## 关键结构

```text
src/
  components/       GridLayout、GridItem、GridBackground 及公共组件类型
  composables/      useGridLayout、useResponsiveLayout、useContainerWidth
  core/             布局引擎、压缩、定位、校验与错误
  helpers/          公共类型、响应式与 DOM/交互辅助函数
  index.ts          包根入口；组件、组合式函数、公共类型及 CSS
  core.ts           无 Vue、DOM 和 CSS 依赖的算法入口
  style.scss        全部组件样式
tests/              Vitest 测试；类型契约位于 tests/types/
docs/               VitePress 中英文文档、示例与文档契约检查
dev-server/         本地开发与 E2E fixture
scripts/            构建、发布检查与测试 setup
```

## 公共 API

公共 API 包括 `src/index.ts` 或 `src/core.ts` 可达的组件、组合式函数、函数、类型，以及组件的 props、events、slots 和 expose。新增、删除、重命名、签名、默认值、行为、错误、弃用或导入路径变化均属于 API 变更。

API 变更必须在同一变更中完成：

1. 更新实现、公共类型和导出入口；核心算法或类型同时核对 `src/core.ts` 与 `src/index.ts`
2. 更新声明处的 TSDoc；对公 TSDoc 使用英文，内部实现注释使用中文
3. 同步 `docs/guide/` 与 `docs/zh/guide/` 的对应页面；两种语言的契约、默认值和示例必须一致
4. 新增或调整公开导出时，同步两个 `api-index.md`；弃用或破坏性变更同步两个 `migration.md`
5. 更新 `tests/types/contracts.ts`；行为变化补充或调整最小相关 Vitest 测试
6. 面向用户的变化添加 `.changeset/*.md`，按 SemVer 选择级别并使用简洁英文摘要；仅文档、测试或内部维护不需要 changeset

公共 TSDoc 写在声明处，至少覆盖使用者无法从类型直接得知的语义、默认值、单位、约束、只读/副作用、错误及弃用替代方案；函数按需使用 `@typeParam`、`@param`、`@returns`、`@throws`，弃用项必须使用 `@deprecated` 并给出迁移目标。不要给内部符号补英文 TSDoc，也不要在无关任务中批量翻译旧注释。

文档路由：

| API 类型             | 英文与中文对应页面     |
| -------------------- | ---------------------- |
| Props、slots         | `guide/properties.md`  |
| Events               | `guide/events.md`      |
| Component expose     | `guide/methods.md`     |
| Composables          | `guide/composables.md` |
| 结果、错误、行为契约 | `guide/contracts.md`   |
| Core API             | `guide/core-api.md`    |
| 所有公开导出         | `guide/api-index.md`   |
| 弃用、破坏性变化     | `guide/migration.md`   |

`pnpm check:docs` 只验证文档结构、双语文件配对和 API 索引覆盖，不替代对 TSDoc、正文语义及双语一致性的人工核对。

## 实现约束

- 修改前先读取当前实现；保持最小变更，不顺带重构任务范围外代码
- 公共只读输入使用 `Readonly`、`ReadonlyLayout` 等现有契约；不要用 `any` 绕过 strict mode
- `grid-layout-plus/core` 保持无 Vue 运行时、浏览器 DOM 和组件 CSS 依赖
- 样式只修改 `src/style.scss`，并运行 `pnpm lint:style`
- 新增测试放入 `tests/*.spec.{ts,tsx}`；Vitest 必须非监听运行
- 不修改生成目录来修复构建或类型问题；回到 `src/` 修复后重新构建

## 验证

按变更范围运行最小充分检查：

| 变更               | 必须运行                                                             |
| ------------------ | -------------------------------------------------------------------- |
| TS、Vue 源码       | 相关 Vitest 测试、`pnpm lint`                                        |
| 公共 API、公共类型 | `pnpm test:types`、`pnpm check:docs`、`pnpm build`、相关 Vitest 测试 |
| 文档               | `pnpm check:docs`、`pnpm build:docs`                                 |
| 样式               | `pnpm lint:style`、相关组件测试                                      |
| 依赖               | `pnpm install`、`pnpm test`、`pnpm lint`                             |
| E2E 行为           | `pnpm test:e2e`；需要浏览器时先安装对应 Playwright browser           |

常用命令以 `package.json#scripts` 为准。提交前确认未修改 `es/`、`lib/`、`dist/` 及任务范围外文件。

## 提交规范

未经明确要求，不创建分支、提交或 PR。提交信息使用英文 Angular 格式：`type(scope): subject`，例如 `fix(grid-item): correct drag offset calculation`。
