import { execa } from 'execa'
import { logger } from './utils'

import type { Options } from 'execa'

async function run(bin: string, args: string[], opts: Options = {}) {
  return execa(bin, args, { stdio: 'inherit', ...opts })
}

async function main() {
  logger.withBothLn(() => logger.successText('start building lib...'))

  await run('vite', ['build', '--config', 'vite.config.ts'])

  logger.ln()

  await run('vite', ['build', '--config', 'vite.full.config.ts'])

  logger.ln()

  if (!process.exitCode) {
    logger.withEndLn(() => logger.success('all builds completed successfully'))
  }
}

main().catch(error => {
  logger.error(error)
  process.exit(1)
})
