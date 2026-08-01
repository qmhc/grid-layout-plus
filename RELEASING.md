# 发布流程

本项目使用 Changesets 管理版本、`CHANGELOG.md`、npm 发布、Git tag 和 GitHub Release。

## 提交面向用户的改动

执行：

```bash
pnpm changeset
```

选择 `grid-layout-plus`、对应的 SemVer 级别，并使用简洁的英文描述面向用户的变化。将生成的
`.changeset/*.md` 文件与功能代码一起提交。仅修改文档、测试或内部维护代码时不需要 changeset。

## 发布正式版本

1. 带 changeset 的改动合并到 `main` 后，CI 与独立的 Release workflow 分别启动。
2. Release workflow 安装依赖并构建包，然后运行 Changesets Action。
3. Changesets Action 创建或更新 `release: version packages` PR。
4. 版本 PR 会更新 `package.json` 和 `CHANGELOG.md`，并消费已合并的 changeset 文件。
5. 合并版本 PR 后，CI 再次验证；通过后自动构建并发布 npm 包。
6. 发布成功后自动创建 `v<version>` tag 和 GitHub Release。

仓库需要配置具有 npm 发布权限的 `NPM_TOKEN` secret，并允许 GitHub Actions 创建 Pull
Request。不要手动修改版本号、`CHANGELOG.md` 或创建发布 tag。

## 本地检查

```bash
pnpm exec changeset status
```

`pnpm run version-packages` 会实际修改版本与 changelog，应只在排查版本 PR 时使用。
`pnpm run release` 会尝试发布到 npm，应只由 CI 调用。
