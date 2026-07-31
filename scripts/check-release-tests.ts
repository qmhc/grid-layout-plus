import { readFile, readdir } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import ts from 'typescript'
import { logger, rootDir } from './utils'

const defaultTestRoots = ['test', 'describe', 'it']
const forbiddenMarkers = new Set(['fail', 'skip', 'fixme', 'only'])

export interface ReleaseTestMarker {
  line: number
  text: string
}

function getRootName(expression: ts.Expression): string | undefined {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isTypeAssertionExpression(expression)
  ) {
    return getRootName(expression.expression)
  }
  if (ts.isIdentifier(expression)) return expression.text
  if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
    return getRootName(expression.expression)
  }
}

function getMemberName(expression: ts.Expression): string | undefined {
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text
  if (ts.isElementAccessExpression(expression) && expression.argumentExpression) {
    let argument = expression.argumentExpression
    while (ts.isParenthesizedExpression(argument)) argument = argument.expression
    if (ts.isStringLiteralLike(argument)) return argument.text
  }
}

function collectTestRoots(sourceFile: ts.SourceFile): Set<string> {
  const roots = new Set(defaultTestRoots)

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== '@playwright/test'
    ) {
      continue
    }
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue

    for (const binding of bindings.elements) {
      const importedName = binding.propertyName?.text || binding.name.text
      if (defaultTestRoots.includes(importedName)) roots.add(binding.name.text)
    }
  }

  return roots
}

export function findReleaseTestMarkers(source: string, fileName = 'test.ts'): ReleaseTestMarker[] {
  const scriptKind = fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind)
  const testRoots = collectTestRoots(sourceFile)
  const markers: ReleaseTestMarker[] = []

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const root = getRootName(node.expression)
      const marker = getMemberName(node.expression)
      if (root && marker && testRoots.has(root) && forbiddenMarkers.has(marker)) {
        const start = node.expression.getStart(sourceFile)
        const { line } = sourceFile.getLineAndCharacterOfPosition(start)
        markers.push({
          line: line + 1,
          text: source.slice(start, node.expression.getEnd()).replace(/\s+/g, ' '),
        })
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return markers
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

async function main(): Promise<void> {
  const testRoot = resolve(rootDir, 'tests/e2e')
  const files = (await collectFiles(testRoot)).filter(file =>
    ['.ts', '.tsx', '.js', '.jsx'].includes(extname(file)),
  )
  const failures: string[] = []

  for (const file of files) {
    const source = await readFile(file, 'utf-8')
    for (const marker of findReleaseTestMarkers(source, file)) {
      failures.push(`${file.slice(rootDir.length + 1)}:${marker.line}: ${marker.text}`)
    }
  }

  if (failures.length) {
    throw new Error(`Playwright release markers are forbidden:\n${failures.join('\n')}`)
  }
  logger.success(`checked ${files.length} Playwright files: no fail/skip/fixme/only markers`)
}

const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  main().catch(error => {
    logger.error(error)
    process.exit(1)
  })
}
