import test from 'node:test'
import assert from 'node:assert/strict'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { delimiter, join } from 'node:path'
import { tmpdir } from 'node:os'

import { createAutoUpgradeService, readUpgradeState, resolveUpgradePaths } from '../../src/index.js'
import { createStubNpm } from './helpers/create-stub-npm.js'
import { waitForUpgradeState } from './helpers/wait-for-upgrade-state.js'

test('manual upgrade e2e flows stay offline with a local npm stub', async (suite) => {
  await suite.test('checkOnly returns a plan without writing detached runner files', async () => {
    const sandboxDir = await createSandbox('auto-upgrade-e2e-check-only-')
    const storageDir = join(sandboxDir, 'storage')
    const paths = resolveUpgradePaths(storageDir)
    const stub = await createStubNpm(sandboxDir, {
      latestVersion: '1.2.0',
    })

    try {
      await withPrependedPath(stub.binDir, async () => {
        const service = createAutoUpgradeService({
          packageName: 'upgrade-self',
          currentVersion: '1.0.0',
          storageDir,
          argv: ['upgrade'],
          env: {},
          isInteractive: true,
          now: () => new Date('2026-05-31T08:00:00.000Z'),
          pid: 0,
          platform: process.platform,
        })

        const result = await service.runManualUpgrade({ checkOnly: true })
        assert.equal(result.outcome, 'update-available')
        assert.equal(result.plan?.targetVersion, '1.2.0')

        const state = await readUpgradeState(storageDir)
        assert.equal(state.lastCheckAt, '2026-05-31T08:00:00.000Z')
        await assert.rejects(() => access(paths.runnerPath))
        await assert.rejects(() => access(paths.contextPath))

        const calls = await stub.readCalls()
        assert.deepEqual(calls.map((call) => call.args[0]), ['--version', 'info'])
      })
    } finally {
      await rm(sandboxDir, { recursive: true, force: true })
    }
  })

  await suite.test('runManualUpgrade completes through the detached runner on success', async () => {
    const sandboxDir = await createSandbox('auto-upgrade-e2e-success-')
    const storageDir = join(sandboxDir, 'storage')
    const paths = resolveUpgradePaths(storageDir)
    const stub = await createStubNpm(sandboxDir, {
      latestVersion: '1.2.0',
      installStdout: 'installed upgrade-self@1.2.0\n',
    })

    try {
      await withPrependedPath(stub.binDir, async () => {
        const service = createAutoUpgradeService({
          packageName: 'upgrade-self',
          currentVersion: '1.0.0',
          storageDir,
          argv: ['upgrade'],
          env: {},
          isInteractive: true,
          now: () => new Date('2026-05-31T08:10:00.000Z'),
          execPath: process.execPath,
          pid: 0,
          platform: process.platform,
        })

        const result = await service.runManualUpgrade()
        assert.equal(result.outcome, 'scheduled')

        const finalState = await waitForUpgradeState(paths.statePath, (state) => state.lastStatus === 'success')
        assert.equal(finalState.lastVersion, '1.2.0')
        assert.equal(finalState.lastError, undefined)
        assert.equal(finalState.retryAfter, undefined)
        await assert.rejects(() => access(paths.contextPath))

        const log = await readFile(paths.logPath, 'utf8')
        assert.match(log, /upgrade runner started/)
        assert.match(log, /starting install command:/)
        assert.match(log, /installed upgrade-self@1\.2\.0/)
        assert.match(log, /upgrade completed successfully/)

        const calls = await stub.readCalls()
        assert.equal(calls.some((call) => call.args[0] === 'install'), true)
        assert.equal(calls.some((call) => call.args[0] === '--version'), true)
        assert.equal(calls.some((call) => call.args[0] === 'info'), true)
      })
    } finally {
      await rm(sandboxDir, { recursive: true, force: true })
    }
  })

  await suite.test('runManualUpgrade records failed installs through the detached runner', async () => {
    const sandboxDir = await createSandbox('auto-upgrade-e2e-failed-')
    const storageDir = join(sandboxDir, 'storage')
    const paths = resolveUpgradePaths(storageDir)
    const stub = await createStubNpm(sandboxDir, {
      latestVersion: '1.2.0',
      installExitCode: 1,
      installStderr: 'install failed\n',
    })

    try {
      await withPrependedPath(stub.binDir, async () => {
        const service = createAutoUpgradeService({
          packageName: 'upgrade-self',
          currentVersion: '1.0.0',
          storageDir,
          argv: ['upgrade'],
          env: {},
          isInteractive: true,
          now: () => new Date('2026-05-31T08:20:00.000Z'),
          execPath: process.execPath,
          pid: 0,
          platform: process.platform,
        })

        const result = await service.runManualUpgrade()
        assert.equal(result.outcome, 'scheduled')

        const finalState = await waitForUpgradeState(paths.statePath, (state) => state.lastStatus === 'failed')
        assert.equal(finalState.lastVersion, '1.2.0')
        assert.equal(finalState.lastError, 'Upgrade process failed')
        assert.equal(typeof finalState.retryAfter, 'string')
        await assert.rejects(() => access(paths.contextPath))

        const log = await readFile(paths.logPath, 'utf8')
        assert.match(log, /install failed/)
        assert.match(log, /upgrade failed with non-zero exit code/)
      })
    } finally {
      await rm(sandboxDir, { recursive: true, force: true })
    }
  })
})

async function createSandbox(prefix: string): Promise<string> {
  return await mkdtemp(join(tmpdir(), prefix))
}

async function withPrependedPath<T>(binDir: string, run: () => Promise<T>): Promise<T> {
  const previousPath = process.env.PATH
  process.env.PATH = previousPath ? `${binDir}${delimiter}${previousPath}` : binDir

  try {
    return await run()
  } finally {
    if (previousPath === undefined) {
      delete process.env.PATH
    } else {
      process.env.PATH = previousPath
    }
  }
}
