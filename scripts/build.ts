import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { execa } from 'execa'
import { logger, rootDir } from './utils'

import type { Options } from 'execa'

async function run(bin: string, args: string[], opts: Options = {}) {
  return execa(bin, args, { stdio: 'inherit', ...opts })
}

function assertExports(entry: string, module: Record<string, unknown>, expected: string[]) {
  for (const name of expected) {
    if (!(name in module)) {
      throw new Error(`${entry} is missing the ${name} export`)
    }
  }
}

function assertSameExport(
  name: string,
  root: Record<string, unknown>,
  core: Record<string, unknown>,
): void {
  if (root[name] !== core[name]) {
    throw new Error(`root and core do not share the ${name} export identity`)
  }
}

async function assertCssBuildBoundary(): Promise<void> {
  const javascriptFiles = [
    'es/index.mjs',
    'es/core.mjs',
    'lib/index.cjs',
    'lib/core.cjs',
    'dist/grid-layout-plus.mjs',
    'dist/grid-layout-plus.cjs',
    'dist/grid-layout-plus.js',
  ]
  const [javascriptOutputs, stylesheet] = await Promise.all([
    Promise.all(
      javascriptFiles.map(file => readFile(resolve(rootDir, file), 'utf-8')),
    ),
    readFile(resolve(rootDir, 'dist/style.css'), 'utf-8'),
  ])

  for (const [index, output] of javascriptOutputs.entries()) {
    if (
      output.includes('vite-plugin-css-injected-by-js') ||
      /document\.createElement\([`'"]style[`'"]\)/u.test(output)
    ) {
      throw new Error(`${javascriptFiles[index]} must not inject component CSS`)
    }
  }

  if (!stylesheet.includes('.vgl-layout') || !stylesheet.includes('.vgl-item')) {
    throw new Error('dist/style.css must contain the component styles')
  }

  const expectedStylePath = resolve(rootDir, 'dist/style.css')
  const expectedStyleUrl = pathToFileURL(expectedStylePath).href
  if (import.meta.resolve('grid-layout-plus/style.css') !== expectedStyleUrl) {
    throw new Error('ESM style export must resolve to dist/style.css')
  }

  const require = createRequire(import.meta.url)
  if (require.resolve('grid-layout-plus/style.css') !== expectedStylePath) {
    throw new Error('CJS style export must resolve to dist/style.css')
  }
}

async function verifyBuildOutputs() {
  const require = createRequire(import.meta.url)
  const [esmRoot, esmCore] = await Promise.all([
    import('grid-layout-plus'),
    import('grid-layout-plus/core'),
  ])
  const cjsRoot = require('grid-layout-plus') as Record<string, unknown>
  const cjsCore = require('grid-layout-plus/core') as Record<string, unknown>

  assertExports('ESM root entry', esmRoot, ['GridLayout', 'useGridLayout', 'verticalCompactor'])
  assertExports('ESM core entry', esmCore, [
    'compact',
    'GridLayoutValidationError',
    'verticalCompactor',
  ])
  assertExports('CJS root entry', cjsRoot, ['GridLayout', 'useGridLayout', 'verticalCompactor'])
  assertExports('CJS core entry', cjsCore, [
    'compact',
    'GridLayoutValidationError',
    'verticalCompactor',
  ])

  for (const name of ['GridLayoutValidationError', 'compact', 'verticalCompactor']) {
    assertSameExport(`ESM ${name}`, esmRoot, esmCore)
    assertSameExport(`CJS ${name}`, cjsRoot, cjsCore)
  }

  await assertCssBuildBoundary()
  await run('tsc', ['-p', 'tests/types/tsconfig.json'])
}

async function main() {
  logger.withBothLn(() => logger.successText('start building lib...'))

  await run('vite', ['build', '--config', 'vite.config.ts'])

  logger.ln()

  await run('vite', ['build', '--config', 'vite.full.config.ts'])

  logger.ln()

  await verifyBuildOutputs()

  if (!process.exitCode) {
    logger.withEndLn(() => logger.success('all builds completed successfully'))
  }
}

main().catch(error => {
  logger.error(error)
  process.exit(1)
})
