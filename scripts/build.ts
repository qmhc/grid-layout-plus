import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

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

async function assertCssInjectionBoundary(): Promise<void> {
  const [esmRoot, esmCore, cjsRoot, cjsCore] = await Promise.all(
    ['es/index.mjs', 'es/core.mjs', 'lib/index.cjs', 'lib/core.cjs'].map(file =>
      readFile(resolve(rootDir, file), 'utf-8'),
    ),
  )
  const injectionMarker = 'vite-plugin-css-injected-by-js'
  if (!esmRoot.includes(injectionMarker) || !cjsRoot.includes(injectionMarker)) {
    throw new Error('root entries must contain the component CSS injection')
  }
  if (esmCore.includes(injectionMarker) || cjsCore.includes(injectionMarker)) {
    throw new Error('core entries must remain free of component CSS injection')
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

  await assertCssInjectionBoundary()
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
