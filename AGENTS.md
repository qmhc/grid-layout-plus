# Grid Layout Plus — 系统规则

## 身份与边界

Vue 3 网格布局组件库。`<script setup>` + TypeScript strict mode。

不要修改 `es/`、`lib/`、`dist/` — 构建产物，由 `pnpm build` 生成
不要在 `.vue` 文件中添加 `<style>` 块 — 所有样式写在 `src/style.scss`
不要在 `src/**/*.vue` 中使用 `<template>` 和 `<script>` 以外的块
不要以 watch 模式运行 vitest — 使用 `pnpm test`（即 `vitest run`）
不要在不了解发布流程的情况下编辑 `scripts/`

## 命令

| 任务             | 命令              |
| ---------------- | ----------------- |
| 安装依赖         | `pnpm install`    |
| 本地开发         | `pnpm dev`        |
| 构建             | `pnpm build`      |
| 测试             | `pnpm test`       |
| 测试 + 覆盖率    | `pnpm test:cover` |
| Lint (JS/TS/Vue) | `pnpm lint`       |
| Lint (CSS/SCSS)  | `pnpm lint:style` |
| 格式化           | `pnpm prettier`   |

## 项目结构

```text
src/
  components/         GridLayout, GridItem (.vue) + types.ts
  helpers/            common / dom / draggable / responsive (.ts) + types.ts
  index.ts            公共入口 — 导出组件和类型
  style.scss          所有组件样式（.vue 中无 <style>）
tests/                *.spec.{ts,tsx} — Vitest + happy-dom + @vue/test-utils
scripts/              build.ts / release.ts / publish.ts / test-setup.ts / utils.ts
dev-server/           本地开发应用（pnpm workspace 子包）
docs/                 VitePress 文档站（pnpm workspace 子包）
```

## 构建

`pnpm build` 依次执行两套 Vite 配置：

1. `vite.config.ts` → `es/`（ESM）+ `lib/`（CJS），preserveModules
2. `vite.full.config.ts` → `dist/`（bundled ESM/CJS/IIFE + `.d.ts`）

模块构建的外部依赖：`vue`、`@vexip-ui/hooks`、`@vexip-ui/utils`、`interactjs`
CSS 通过 `vite-plugin-css-injected-by-js` 注入 JS
生产构建会 drop `debugger` 和 `console.log`

## 测试

- 文件：`tests/*.spec.{ts,tsx}`
- Setup（`scripts/test-setup.ts`）：stub `Transition`/`TransitionGroup`，每个测试前清空 DOM
- `@interactjs/` 作为 inline deps
- 超时：10 秒

## 代码规范

| 工具       | 配置                          | 作用范围                              |
| ---------- | ----------------------------- | ------------------------------------- |
| ESLint     | `@vexip-ui/eslint-config`     | `*.{js,ts,tsx,vue}`                   |
| Prettier   | `@vexip-ui/prettier-config`   | `*.{ts,js,json,css,scss,vue,html,md}` |
| Stylelint  | `@vexip-ui/stylelint-config`  | `*.{vue,scss}`                        |
| Commitlint | `@vexip-ui/commitlint-config` | Angular 规范                          |

`scripts/` 目录允许 `console.log` 和 `no-sequences`

## Git 钩子

| 钩子         | 行为            |
| ------------ | --------------- |
| `pre-commit` | `pnpm test`     |
| `commit-msg` | commitlint 校验 |

lint-staged 在提交时对暂存文件执行 prettier → eslint/stylelint 修复

## 提交规范

格式：`type(scope): subject` — 必须英语
示例：`fix(grid-item): correct drag offset calculation`
类型：`feat` / `fix` / `refactor` / `test` / `docs` / `chore` / `release`

## 修改流程

源码变更：读取当前文件 → 编辑 → `pnpm test` → `pnpm lint`
样式变更：编辑 `src/style.scss` → `pnpm lint:style`
新增导出：添加到 `src/index.ts` → 验证 `pnpm build` 通过
依赖变更：更新 `package.json` → `pnpm install` → `pnpm test`
