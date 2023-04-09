import path from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import minimist from 'minimist'
import semver from 'semver'
import prompts from 'prompts'
import { logger, run, dryRun } from './utils'

const args = minimist<{
  d?: boolean,
  dry?: boolean,
  p: string,
  preid?: string
}>(process.argv.slice(2))

const isDryRun = args.dry || args.d

const rootDir = path.resolve(fileURLToPath(import.meta.url), '../..')

const runIfNotDry = isDryRun ? dryRun : run
const logStep = (msg: string) => {
  logger.ln()
  logger.infoText(msg)
}
const logSkipped = (msg = 'Skipped') => {
  logger.warningText(`(${msg})`)
}

main()

async function main() {
  const pkg = JSON.parse(
    await readFile(path.join(rootDir, 'package.json'), 'utf-8')
  )
  const currentVersion = pkg.version

  const preId =
    args.preid ||
    args.p ||
    semver.prerelease(currentVersion)?.[0]

  const versionIncrements = [
    'patch',
    'minor',
    'major',
    ...(preId ? ['prepatch', 'preminor', 'premajor', 'prerelease'] : [])
  ]

  const inc = (i: any) => semver.inc(currentVersion, i, preId as string)

  const { release } = await prompts({
    type: 'select',
    name: 'release',
    message: 'Select release type:',
    choices: versionIncrements
      .map(i => `${i} (${inc(i)})`)
      .concat(['custom'])
      .map(i => ({ title: i, value: i }))
  })

  const version =
    release === 'custom'
      ? (await prompts({
          type: 'text',
          name: 'version',
          message: 'Input custom version:'
        })).version
      : release.match(/\((.*)\)/)?.[1]

  if (!semver.valid(version)) {
    throw new Error(`Invalid target version: ${version}`)
  }

  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: `Confirm release ${version}?`
  })

  if (!confirm) return

  // 执行单元测试
  logStep('Running test...')

  if (!isDryRun) {
    await run('pnpm', ['test'])
  } else {
    logSkipped()
  }

  logStep('Updating version...')

  pkg.version = version
  await writeFile(path.resolve(rootDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')

  // 构建库
  logStep('Building package...')

  if (!isDryRun) {
    await run('pnpm', ['build'])
  } else {
    logSkipped()
  }

  // 更新 Change Log
  logStep('Updating changelog...')

  await run('pnpm', ['changelog'])

  // 提交改动
  logStep('Comitting changes...')

  const { stdout } = await run('git', ['diff'], { stdio: 'pipe' })

  if (stdout) {
    await runIfNotDry('git', ['add', '-A'])
    await runIfNotDry('git', ['commit', '-m', `release: v${version}`])
  } else {
    logSkipped('No changes to commit')
  }

  // 推送到远程仓库
  logStep('Pushing to Remote Repository...')

  await runIfNotDry('git', ['tag', `v${version}`])
  await runIfNotDry('git', ['push', 'origin', `refs/tags/v${version}`])
  await runIfNotDry('git', ['push'])

  logger.ln()

  if (isDryRun) {
    logger.success('Dry run finished - run git diff to see package changes')
  } else {
    logger.success('Release successfully')
  }

  logger.ln()
}
