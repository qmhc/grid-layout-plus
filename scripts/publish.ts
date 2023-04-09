import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import minimist from 'minimist'
import { rootDir, logger, run } from './utils'

const args = minimist<{
  d?: boolean,
  dry?: boolean,
  t?: string,
  tag?: string
}>(process.argv.slice(2))

const isDryRun = args.dry || args.d
const releaseTag = args.tag || args.t

async function main() {
  const pkg = JSON.parse(await readFile(resolve(rootDir, 'package.json'), 'utf-8'))
  const currentVersion: string = pkg.version

  logger.withStartLn(() => logger.infoText('Publishing package...'))

  const publishArgs = [
    'publish',
    '--access',
    'public',
    '--registry',
    'https://registry.npmjs.org/',
    '--no-git-checks'
  ]

  if (isDryRun) {
    publishArgs.push('--dry-run')
  }

  if (releaseTag) {
    publishArgs.push('--tag', releaseTag)
  } else if (currentVersion.includes('-')) {
    const [, preversion] = currentVersion.split('-')
    const tag = preversion && preversion.split('.')[0]

    tag && publishArgs.push('--tag', tag)
  }

  try {
    await run('pnpm', publishArgs, { stdio: 'pipe', cwd: rootDir })
    logger.successText(`Successfully published v${currentVersion}'`)
  } catch (error) {
    if (error.stderr?.match(/previously published/)) {
      logger.errorText(`Skipping already published v'${currentVersion}'`)
    } else {
      throw error
    }
  }
}

main().catch(error => {
  logger.error(error)
  process.exit(1)
})
