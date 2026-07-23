import { createRequire } from 'node:module'

import { execa } from 'execa'
import { logger } from './utils'

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

async function verifyBuildOutputs() {
  const require = createRequire(import.meta.url)
  const [esmRoot, esmCore] = await Promise.all([
    import('grid-layout-plus'),
    import('grid-layout-plus/core'),
  ])
  const cjsRoot = require('grid-layout-plus') as Record<string, unknown>
  const cjsCore = require('grid-layout-plus/core') as Record<string, unknown>

  assertExports('ESM root entry', esmRoot, ['GridLayout', 'verticalCompactor'])
  assertExports('ESM core entry', esmCore, ['compact', 'verticalCompactor'])
  assertExports('CJS root entry', cjsRoot, ['GridLayout', 'verticalCompactor'])
  assertExports('CJS core entry', cjsCore, ['compact', 'verticalCompactor'])
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
