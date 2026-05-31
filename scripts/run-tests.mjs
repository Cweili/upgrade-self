import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const scriptDir = dirname(fileURLToPath(import.meta.url))
const rootDir = dirname(scriptDir)
const outDir = join(rootDir, '.tmp', 'test-dist')
const tscCliPath = require.resolve('typescript/bin/tsc')
const target = process.argv[2] ?? 'all'
const validTargets = new Set(['all', 'unit', 'e2e', 'prepare'])

if (!validTargets.has(target)) {
  console.error(`Unknown test target: ${target}`)
  process.exit(1)
}

rmSync(outDir, { recursive: true, force: true })

run(process.execPath, [tscCliPath, '-p', 'tsconfig.test.json', '--pretty', 'false'])

if (target === 'prepare') {
  process.exit(0)
}

const files = getTestFiles(target).map((file) => relative(rootDir, file))

if (files.length === 0) {
  const label = target === 'all' ? '' : `${target} `
  console.error(`No compiled ${label}tests found in ${relative(rootDir, outDir)}`)
  process.exit(1)
}

run(process.execPath, ['--enable-source-maps', '--test', ...files])

function getTestFiles(kind) {
  const testsDir = join(outDir, 'tests')
  const unitDir = join(testsDir, 'unit')
  const e2eDir = join(testsDir, 'e2e')

  if (kind === 'e2e') {
    return listTestFiles(e2eDir)
  }

  if (kind === 'unit' && existsSync(unitDir)) {
    return listTestFiles(unitDir)
  }

  const files = listTestFiles(testsDir)

  if (kind === 'all') {
    return files
  }

  return files.filter((file) => !file.includes(`${sep}e2e${sep}`))
}

function listTestFiles(dir) {
  if (!existsSync(dir)) {
    return []
  }

  const entries = readdirSync(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...listTestFiles(entryPath))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.test.js')) {
      files.push(entryPath)
    }
  }

  return files.sort((left, right) => left.localeCompare(right))
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
