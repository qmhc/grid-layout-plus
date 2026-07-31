import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

interface LlmsBundle {
  files: readonly string[]
  introduction: string
  outputFile: string
  title: string
}

const siteUrl = 'https://grid-layout-plus.netlify.app'

export const llmsBundles: readonly LlmsBundle[] = [
  {
    title: 'Grid Layout Plus v2 Documentation',
    introduction:
      'Complete English guide for the controlled Vue 3 grid layout API. Prefer the public contracts and examples in this document over v1 usage found elsewhere.',
    outputFile: 'llms-full.txt',
    files: [
      'guide/installation.md',
      'guide/usage.md',
      'guide/recipes.md',
      'guide/api-index.md',
      'guide/properties.md',
      'guide/events.md',
      'guide/methods.md',
      'guide/composables.md',
      'guide/contracts.md',
      'guide/core-api.md',
      'guide/custom-style.md',
      'guide/migration.md',
    ],
  },
  {
    title: 'Grid Layout Plus v2 中文文档',
    introduction:
      '受控式 Vue 3 栅格布局 API 的完整中文指南。请优先采用本文档中的公开契约和示例，不要沿用其他来源中的 v1 写法。',
    outputFile: 'llms-full-zh.txt',
    files: [
      'zh/guide/installation.md',
      'zh/guide/usage.md',
      'zh/guide/recipes.md',
      'zh/guide/api-index.md',
      'zh/guide/properties.md',
      'zh/guide/events.md',
      'zh/guide/methods.md',
      'zh/guide/composables.md',
      'zh/guide/contracts.md',
      'zh/guide/core-api.md',
      'zh/guide/custom-style.md',
      'zh/guide/migration.md',
    ],
  },
]

function stripFrontmatter(markdown: string) {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim()
}

function pageUrl(file: string) {
  const path = file.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')
  return new URL(path, `${siteUrl}/`)
}

function mapMarkdownOutsideFences(markdown: string, transform: (line: string) => string) {
  let fence: Readonly<{ character: string; length: number }> | null = null

  return markdown
    .split('\n')
    .map(line => {
      const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/u)
      if (fenceMatch) {
        const marker = fenceMatch[1]
        if (!fence) {
          fence = { character: marker[0], length: marker.length }
        } else if (
          marker[0] === fence.character &&
          marker.length >= fence.length &&
          fenceMatch[2].trim() === ''
        ) {
          fence = null
        }
        return line
      }
      if (fence) return line

      return transform(line)
    })
    .join('\n')
}

function isAbsoluteLink(target: string) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(target)
}

export function findRelativeMarkdownLinks(markdown: string) {
  const links: string[] = []

  mapMarkdownOutsideFences(markdown, line => {
    for (const match of line.matchAll(/\]\(([^)\s]+)/gu)) {
      if (!isAbsoluteLink(match[1])) links.push(match[1])
    }
    return line
  })

  return links
}

function rewriteMarkdownLinks(markdown: string, file: string) {
  const baseUrl = pageUrl(file)

  return mapMarkdownOutsideFences(markdown, line => {
    return line.replace(/\]\(([^)]+)\)/gu, (link, destination: string) => {
      const [target, ...title] = destination.trim().split(/\s+/u)
      if (isAbsoluteLink(target)) return link

      const url = new URL(target, target.startsWith('/') ? `${siteUrl}/` : baseUrl)
      if (url.pathname.endsWith('.md')) url.pathname = url.pathname.slice(0, -3)
      const suffix = title.length ? ` ${title.join(' ')}` : ''

      return `](${url.toString()}${suffix})`
    })
  })
}

export async function renderLlmsBundle(docsRoot: string, bundle: LlmsBundle) {
  const sections = await Promise.all(
    bundle.files.map(async file => {
      const markdown = await readFile(resolve(docsRoot, file), 'utf8')
      const content = rewriteMarkdownLinks(stripFrontmatter(markdown), file)

      return `<!-- Source: /${file} -->\n\n${content}`
    }),
  )

  return `# ${bundle.title}\n\n> ${bundle.introduction}\n\n${sections.join('\n\n---\n\n')}\n`
}

export async function writeLlmsBundles(docsRoot: string, outDir: string) {
  await Promise.all(
    llmsBundles.map(async bundle => {
      const content = await renderLlmsBundle(docsRoot, bundle)
      await writeFile(resolve(outDir, bundle.outputFile), content, 'utf8')
    }),
  )
}
