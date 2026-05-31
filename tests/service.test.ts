import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { createAutoUpgradeService, readUpgradeState } from '../src/index.js'
import { FakeCommandRunner } from './helpers/fake-runner.js'

async function createStorageDir(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'auto-upgrade-'))
}

test('runManualUpgrade with checkOnly returns an upgrade plan without scheduling', async () => {
  const storageDir = await createStorageDir()
  const runner = new FakeCommandRunner()
  runner.pushResult({ exitCode: 0, stdout: '' })
  runner.pushResult({ exitCode: 0, stdout: '"1.2.0"' })

  try {
    const service = createAutoUpgradeService({
      packageName: 'auto-upgrade',
      currentVersion: '1.0.0',
      storageDir,
      commandRunner: runner,
      isInteractive: true,
      env: {},
      argv: ['check'],
      now: () => new Date('2026-05-30T08:00:00.000Z'),
      platform: 'linux',
    })

    const result = await service.runManualUpgrade({ checkOnly: true })
    assert.equal(result.outcome, 'update-available')
    assert.equal(result.plan?.targetVersion, '1.2.0')
    assert.equal(runner.detachedRuns.length, 0)

    const state = await readUpgradeState(storageDir)
    assert.equal(state.lastCheckAt, '2026-05-30T08:00:00.000Z')
  } finally {
    await rm(storageDir, { recursive: true, force: true })
  }
})

test('runAutomaticUpgrade skips when argv contains an auto-skip token', async () => {
  const storageDir = await createStorageDir()

  try {
    const service = createAutoUpgradeService({
      packageName: 'auto-upgrade',
      currentVersion: '1.0.0',
      storageDir,
      isInteractive: true,
      env: {},
      argv: ['upgrade'],
      now: () => new Date('2026-05-30T08:00:00.000Z'),
      platform: 'linux',
    })

    const result = await service.runAutomaticUpgrade()
    assert.equal(result.outcome, 'skipped')
    assert.equal(result.reason, 'command')
  } finally {
    await rm(storageDir, { recursive: true, force: true })
  }
})

test('runManualUpgrade schedules a detached runner when an update is available', async () => {
  const storageDir = await createStorageDir()
  const runner = new FakeCommandRunner()
  runner.pushResult({ exitCode: 0, stdout: '' })
  runner.pushResult({ exitCode: 0, stdout: '"1.2.0"' })

  try {
    const service = createAutoUpgradeService({
      packageName: 'auto-upgrade',
      currentVersion: '1.0.0',
      storageDir,
      commandRunner: runner,
      isInteractive: true,
      env: {},
      argv: ['status'],
      now: () => new Date('2026-05-30T08:00:00.000Z'),
      platform: 'linux',
      execPath: process.execPath,
      pid: 123,
    })

    const result = await service.runManualUpgrade()
    assert.equal(result.outcome, 'scheduled')
    assert.equal(result.plan.targetVersion, '1.2.0')
    assert.equal(runner.detachedRuns.length, 1)

    const state = await readUpgradeState(storageDir)
    assert.equal(state.lastStatus, 'scheduled')
    assert.equal(state.lastVersion, '1.2.0')
  } finally {
    await rm(storageDir, { recursive: true, force: true })
  }
})
