import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { buildNpmInstallCommand } from '../../src/adapters/package-manager/npm.js'
import { buildRunnerScript } from '../../src/runner/template.js'
import { readUpgradeState, resolveUpgradePaths, writeUpgradeState } from '../../src/runner/files.js'
import { createFailedState, scheduleUpgrade } from '../../src/runner/scheduler.js'
import type { CommandRunner, UpgradePlan } from '../../src/types.js'

async function createStorageDir(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'auto-upgrade-runner-'))
}

test('buildRunnerScript keeps exception handlers in the generated runner', () => {
  const script = buildRunnerScript()

  assert.match(script, /main\(\)\.catch/)
  assert.match(script, /spawn error:/)
  assert.match(script, /upgrade failed with non-zero exit code/)
})

test('readUpgradeState returns an empty object when state is missing', async () => {
  const storageDir = await createStorageDir()

  try {
    assert.deepEqual(await readUpgradeState(storageDir), {})
  } finally {
    await rm(storageDir, { recursive: true, force: true })
  }
})

test('readUpgradeState throws on malformed JSON', async () => {
  const storageDir = await createStorageDir()

  try {
    await writeFile(join(storageDir, 'state.json'), '{not-json', 'utf8')

    await assert.rejects(() => readUpgradeState(storageDir), SyntaxError)
  } finally {
    await rm(storageDir, { recursive: true, force: true })
  }
})

test('writeUpgradeState rejects when the stored state is corrupted', async () => {
  const storageDir = await createStorageDir()

  try {
    await writeFile(join(storageDir, 'state.json'), '{not-json', 'utf8')

    await assert.rejects(() => writeUpgradeState(storageDir, { lastStatus: 'scheduled' }), SyntaxError)
  } finally {
    await rm(storageDir, { recursive: true, force: true })
  }
})

test('scheduleUpgrade preserves scheduled state when detached spawn fails', async () => {
  const storageDir = await createStorageDir()
  const paths = resolveUpgradePaths(storageDir)
  const plan: UpgradePlan = {
    packageName: 'auto-upgrade',
    currentVersion: '1.0.0',
    targetVersion: '1.2.3',
    distTag: 'latest',
    registry: 'https://registry.example.com',
    paths,
    retryDelayMs: 45_000,
    installCommand: buildNpmInstallCommand({
      packageName: 'auto-upgrade',
      version: '1.2.3',
      registry: 'https://registry.example.com',
      addNoAudit: true,
      addNoFund: true,
    }, 'linux'),
  }

  const failingRunner: CommandRunner = {
    run: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    spawnDetached: async () => {
      throw new Error('spawn failed')
    },
  }

  try {
    await assert.rejects(
      () => scheduleUpgrade(plan, {
        commandRunner: failingRunner,
        checkedAt: '2026-05-31T08:00:00.000Z',
        execPath: process.execPath,
        pid: 123,
      }),
      /spawn failed/,
    )

    const state = JSON.parse(await readFile(paths.statePath, 'utf8')) as Record<string, unknown>
    const context = JSON.parse(await readFile(paths.contextPath, 'utf8')) as Record<string, unknown>
    const runnerScript = await readFile(paths.runnerPath, 'utf8')

    assert.equal(state.lastStatus, 'scheduled')
    assert.equal(state.lastVersion, '1.2.3')
    assert.equal(state.lastAttemptAt, '2026-05-31T08:00:00.000Z')
    assert.equal(context.targetVersion, '1.2.3')
    assert.equal(context.command, 'npm')
    assert.match(runnerScript, /upgrade runner started/)
  } finally {
    await rm(storageDir, { recursive: true, force: true })
  }
})

test('createFailedState stores the error, log path, and retry timestamp', () => {
  const state = createFailedState({
    lastStatus: 'scheduled',
    lastVersion: '1.2.3',
  }, 'spawn failed', '2026-05-31T09:00:00.000Z', '/tmp/last-run.log')

  assert.equal(state.lastStatus, 'failed')
  assert.equal(state.lastError, 'spawn failed')
  assert.equal(state.retryAfter, '2026-05-31T09:00:00.000Z')
  assert.equal(state.lastLogPath, '/tmp/last-run.log')
})
