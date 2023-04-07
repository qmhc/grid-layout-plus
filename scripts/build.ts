import {} from 'node:path'
import { execa } from 'execa'

import type { Options } from 'execa'

async function run(bin: string, args: string[], opts: Options = {}) {
  return execa(bin, args, { stdio: 'inherit', ...opts })
}

async function main() {
  await run('vite', ['build', '--config', 'vite.config.ts'])
  await run('vite', ['build', '--config', 'vite.full.config.ts'])
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
