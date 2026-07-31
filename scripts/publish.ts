import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

import minimist from 'minimist'
import { logger, rootDir, run } from './utils'

const args = minimist<{
  d?: boolean
  dry?: boolean
  t?: string
  tag?: string
}>(process.argv.slice(2))

const isDryRun = args.dry || args.d
const releaseTag = args.tag || args.t

export function assertReleaseTag(currentVersion: string, refName: string | undefined): void {
  const expectedTag = `v${currentVersion}`
  if (refName !== expectedTag) {
    throw new Error(
      `Release tag mismatch: expected ${expectedTag}, received ${refName || '(missing)'}`,
    )
  }
}

export function assertPublishedCommit(
  currentSha: string | undefined,
  publishedGitHead: string | undefined,
): void {
  if (!currentSha || publishedGitHead !== currentSha) {
    throw new Error(
      `Published package commit mismatch: expected ${currentSha || '(missing)'}, received ${
        publishedGitHead || '(missing)'
      }`,
    )
  }
}

async function main() {
  const pkg = JSON.parse(await readFile(resolve(rootDir, 'package.json'), 'utf-8'))
  const packageName: string = pkg.name
  const currentVersion: string = pkg.version

  if (!isDryRun || process.env.GITHUB_ACTIONS === 'true') {
    assertReleaseTag(currentVersion, process.env.GITHUB_REF_NAME)
  }

  logger.withStartLn(() => logger.infoText('Publishing package...'))

  const publishArgs = [
    'publish',
    '--access',
    'public',
    '--registry',
    'https://registry.npmjs.org/',
    '--no-git-checks',
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
    logger.successText(`Successfully published v${currentVersion}`)
  } catch (error) {
    if (error.stderr?.match(/previously published/)) {
      const result = await run(
        'pnpm',
        [
          'view',
          `${packageName}@${currentVersion}`,
          'gitHead',
          '--json',
          '--registry',
          'https://registry.npmjs.org/',
        ],
        { stdio: 'pipe', cwd: rootDir },
      )
      const output = typeof result.stdout === 'string' ? result.stdout : ''
      const parsedGitHead = JSON.parse(output || 'null')
      const publishedGitHead = typeof parsedGitHead === 'string' ? parsedGitHead : undefined
      assertPublishedCommit(process.env.GITHUB_SHA, publishedGitHead)
      logger.infoText(
        `v${currentVersion} from ${publishedGitHead} was already published; skipping identical rerun`,
      )
    } else {
      throw error
    }
  }
}

const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  main().catch(error => {
    logger.error(error)
    process.exit(1)
  })
}
