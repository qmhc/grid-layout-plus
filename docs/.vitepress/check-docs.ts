import { readFile, readdir } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

import { findRelativeMarkdownLinks, llmsBundles, renderLlmsBundle } from './llms'

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = resolve(docsRoot, '..')
const siteUrl = 'https://grid-layout-plus.netlify.app'
const errors: string[] = []

function report(condition: boolean, message: string) {
  if (!condition) errors.push(message)
}

async function read(relativePath: string) {
  return readFile(resolve(repositoryRoot, relativePath), 'utf8')
}

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(entry => {
      const path = resolve(directory, entry.name)
      return entry.isDirectory() ? collectFiles(path) : [path]
    }),
  )

  return files.flat()
}

async function checkGuidePairs() {
  const englishDirectory = resolve(docsRoot, 'guide')
  const chineseDirectory = resolve(docsRoot, 'zh/guide')
  const [englishFiles, chineseFiles] = await Promise.all([
    readdir(englishDirectory),
    readdir(chineseDirectory),
  ])
  const english = new Set(englishFiles.filter(file => extname(file) === '.md'))
  const chinese = new Set(chineseFiles.filter(file => extname(file) === '.md'))

  for (const file of english) report(chinese.has(file), `缺少中文指南：docs/zh/guide/${file}`)
  for (const file of chinese) report(english.has(file), `缺少英文指南：docs/guide/${file}`)

  const guideFiles = [
    ...[...english].map(file => ['guide', file] as const),
    ...[...chinese].map(file => ['zh/guide', file] as const),
  ]

  await Promise.all(
    guideFiles.map(async ([directory, file]) => {
      const relativePath = `docs/${directory}/${file}`
      const markdown = await read(relativePath)
      const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/u)?.[1]

      report(Boolean(frontmatter), `${relativePath} 缺少 frontmatter`)
      report(/^title:\s*\S+/mu.test(frontmatter ?? ''), `${relativePath} 缺少 title`)
      report(/^description:\s*\S+/mu.test(frontmatter ?? ''), `${relativePath} 缺少 description`)
    }),
  )
}

async function checkLlmsFiles() {
  const index = await read('docs/public/llms.txt')
  const backtick = String.fromCharCode(96)
  const fenceFixture = [
    `${backtick.repeat(4)}md`,
    '[inside](./inside)',
    backtick.repeat(3),
    '[still-inside](./still-inside)',
    backtick.repeat(4),
    '[outside](./outside)',
  ].join('\n')

  report(
    findRelativeMarkdownLinks(fenceFixture).join() === './outside',
    'LLM 链接扫描没有正确处理嵌套长度的 Markdown 围栏',
  )

  for (const bundle of llmsBundles) {
    report(index.includes(`/${bundle.outputFile}`), `llms.txt 未链接 ${bundle.outputFile}`)

    for (const file of bundle.files) {
      try {
        const markdown = await read(`docs/${file}`)
        report(/^#\s+\S+/mu.test(markdown.replace(/^---[\s\S]*?---/u, '')), `${file} 缺少 H1`)
      } catch {
        errors.push(`完整语料清单中的文件不存在：docs/${file}`)
      }
    }

    const rendered = await renderLlmsBundle(docsRoot, bundle)
    for (const link of findRelativeMarkdownLinks(rendered)) {
      errors.push(`${bundle.outputFile} 仍包含相对链接：${link}`)
    }
  }

  for (const match of index.matchAll(/\]\((https:\/\/[^)]+)\)/gu)) {
    const url = new URL(match[1])
    if (url.origin !== siteUrl || url.pathname.endsWith('.txt')) continue

    const sourcePath = url.pathname.endsWith('/')
      ? `${url.pathname.slice(1)}index.md`
      : `${url.pathname.slice(1)}.md`

    try {
      await read(`docs/${sourcePath}`)
    } catch {
      errors.push(`llms.txt 链接没有对应源文件：${url.toString()}`)
    }
  }
}

function hasExportModifier(node: ts.Node) {
  return (
    ts.canHaveModifiers(node) &&
    Boolean(ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword))
  )
}

async function collectPublicExports(filePath: string, visited = new Set<string>()) {
  if (visited.has(filePath)) return new Set<string>()
  visited.add(filePath)

  const code = await readFile(filePath, 'utf8')
  const source = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true)
  const names = new Set<string>()

  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) names.add(element.name.text)
        continue
      }

      if (
        !statement.exportClause &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text.startsWith('.')
      ) {
        const target = resolve(dirname(filePath), `${statement.moduleSpecifier.text}.ts`)
        const reexported = await collectPublicExports(target, visited)
        for (const name of reexported) names.add(name)
      }
      continue
    }

    if (!hasExportModifier(statement)) continue

    if (
      (ts.isClassDeclaration(statement) ||
        ts.isFunctionDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name
    ) {
      names.add(statement.name.text)
      continue
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text)
      }
    }
  }

  return names
}

async function checkApiIndex() {
  const [rootNames, coreNames, englishIndex, chineseIndex] = await Promise.all([
    collectPublicExports(resolve(repositoryRoot, 'src/index.ts')),
    collectPublicExports(resolve(repositoryRoot, 'src/core.ts')),
    read('docs/guide/api-index.md'),
    read('docs/zh/guide/api-index.md'),
  ])
  const publicNames = new Set([...rootNames, ...coreNames])

  for (const name of publicNames) {
    report(englishIndex.includes(`\`${name}\``), `英文 API 索引缺少公开导出：${name}`)
    report(chineseIndex.includes(`\`${name}\``), `中文 API 索引缺少公开导出：${name}`)
  }
}

async function checkDeprecatedGridItemBindings() {
  const typesSource = ts.createSourceFile(
    'src/components/types.ts',
    await read('src/components/types.ts'),
    ts.ScriptTarget.Latest,
    true,
  )
  const gridItemProps = typesSource.statements.find(
    statement => ts.isInterfaceDeclaration(statement) && statement.name.text === 'GridItemProps',
  )
  const deprecatedNames = new Set<string>()

  if (gridItemProps && ts.isInterfaceDeclaration(gridItemProps)) {
    for (const member of gridItemProps.members) {
      if (!member.name || !ts.isIdentifier(member.name)) continue
      if (!ts.getJSDocTags(member).some(tag => tag.tagName.text === 'deprecated')) continue

      deprecatedNames.add(member.name.text)
      deprecatedNames.add(member.name.text.replace(/[A-Z]/gu, letter => `-${letter.toLowerCase()}`))
    }
  }

  report(deprecatedNames.size > 0, '无法从 GridItemProps 读取废弃属性')
  const files = (await collectFiles(docsRoot)).filter(file =>
    ['.md', '.vue'].includes(extname(file)),
  )
  const directBinding = new RegExp(
    `(?:^|\\s)(?::|v-bind:)?(${[...deprecatedNames].join('|')})(?=\\s|=|/?>)`,
    'u',
  )

  await Promise.all(
    files.map(async file => {
      const source = await readFile(file, 'utf8')
      const tags = source.match(/<GridItem\b[\s\S]*?>/gu) ?? []

      for (const tag of tags) {
        const binding = tag.match(directBinding)?.[1]
        if (binding) errors.push(`${file} 仍向 GridItem 绑定废弃属性：${binding}`)
        if (/(?:^|\s)v-bind(?=\s|=)/u.test(tag)) {
          errors.push(`${file} 对 GridItem 使用对象形式 v-bind，可能绕过废弃属性检查`)
        }
      }
    }),
  )
}

await Promise.all([
  checkGuidePairs(),
  checkLlmsFiles(),
  checkApiIndex(),
  checkDeprecatedGridItemBindings(),
])

if (errors.length) {
  process.stderr.write(`文档检查失败：\n- ${errors.join('\n- ')}\n`)
  process.exitCode = 1
} else {
  process.stdout.write('文档契约检查通过。\n')
}
