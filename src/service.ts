import { npmPackageManager } from './adapters/package-manager/npm.js'
import { npmCliVersionSource } from './adapters/version-source/npm-cli.js'
import { NodeCommandRunner } from './command-runner.js'
import { addMilliseconds, toIsoString } from './core/dates.js'
import { DEFAULT_POLICY, resolveUpgradePolicy, shouldCheckForUpdates } from './core/policy.js'
import { compareVersions } from './core/version.js'
import { PackageManagerError } from './errors.js'
import { readUpgradeState, resolveUpgradePaths, writeUpgradeState } from './runner/files.js'
import { scheduleUpgrade } from './runner/scheduler.js'
import type {
  AutoUpgradeServiceOptions,
  AutomaticUpgradeResult,
  ManualUpgradeOptions,
  ManualUpgradeResult,
  ScheduledUpgradeResult,
  UpdateCheckResult,
  UpgradeStatusResult,
} from './types.js'

export function createAutoUpgradeService(options: AutoUpgradeServiceOptions) {
  const commandRunner = options.commandRunner ?? new NodeCommandRunner()
  const versionSource = options.versionSource ?? npmCliVersionSource
  const packageManager = options.packageManager ?? npmPackageManager
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env
  const argv = options.argv ?? []
  const getNow = options.now ?? (() => new Date())
  const paths = resolveUpgradePaths(options.storageDir)

  async function readState() {
    return await readUpgradeState(options.storageDir)
  }

  async function getStatus(): Promise<UpgradeStatusResult> {
    return {
      outcome: 'status',
      paths,
      state: await readState(),
    }
  }

  async function checkForUpdates(params: { manual?: boolean; registry?: string; distTag?: string } = {}): Promise<UpdateCheckResult> {
    const policy = resolveUpgradePolicy({
      ...DEFAULT_POLICY,
      ...options.policy,
      distTag: params.distTag ?? options.distTag ?? options.policy?.distTag ?? DEFAULT_POLICY.distTag,
    })
    const state = await readState()
    const checkedAt = getNow()
    const decision = shouldCheckForUpdates(state, policy, {
      argv,
      env,
      isInteractive: options.isInteractive,
      manual: params.manual,
      now: checkedAt,
    })

    if (!decision.shouldCheck) {
      return {
        outcome: 'skipped',
        packageName: options.packageName,
        currentVersion: options.currentVersion,
        hasUpdate: false,
        distTag: policy.distTag,
        managerId: packageManager.id,
        reason: decision.reason,
        state,
      }
    }

    const available = await packageManager.isAvailable(commandRunner, platform)
    if (!available) {
      throw new PackageManagerError(`${packageManager.id} is not available in PATH`)
    }

    const checkedAtIso = toIsoString(checkedAt)
    await writeUpgradeState(options.storageDir, {
      lastCheckAt: checkedAtIso,
    })

    const latest = await versionSource.getLatestVersion({
      packageName: options.packageName,
      registry: params.registry ?? options.registry,
      distTag: policy.distTag,
    }, commandRunner)

    const hasUpdate = compareVersions(options.currentVersion, latest.latestVersion) < 0
    const nextState = await readState()

    if (!hasUpdate) {
      return {
        outcome: 'up-to-date',
        packageName: options.packageName,
        currentVersion: options.currentVersion,
        latestVersion: latest.latestVersion,
        hasUpdate: false,
        checkedAt: checkedAtIso,
        registry: latest.registry,
        distTag: latest.distTag,
        managerId: packageManager.id,
        state: nextState,
      }
    }

    return {
      outcome: 'update-available',
      packageName: options.packageName,
      currentVersion: options.currentVersion,
      latestVersion: latest.latestVersion,
      hasUpdate: true,
      checkedAt: checkedAtIso,
      registry: latest.registry,
      distTag: latest.distTag,
      managerId: packageManager.id,
      state: nextState,
      plan: {
        packageName: options.packageName,
        currentVersion: options.currentVersion,
        targetVersion: latest.latestVersion,
        distTag: latest.distTag,
        registry: latest.registry,
        paths,
        retryDelayMs: policy.retryDelayMs,
        installCommand: packageManager.buildInstallCommand({
          packageName: options.packageName,
          version: latest.latestVersion,
          registry: latest.registry,
          addNoAudit: policy.addNoAudit,
          addNoFund: policy.addNoFund,
        }, platform),
      },
    }
  }

  async function runAutomaticUpgrade(): Promise<AutomaticUpgradeResult> {
    const result = await checkForUpdates({ manual: false })
    if (result.outcome !== 'update-available' || !result.plan || !result.checkedAt || !result.latestVersion) {
      return result
    }

    return await scheduleUpgrade(result.plan, {
      commandRunner,
      checkedAt: result.checkedAt,
      execPath: options.execPath,
      pid: options.pid,
    })
  }

  async function runManualUpgrade(params: ManualUpgradeOptions = {}): Promise<ManualUpgradeResult> {
    if (params.statusOnly) {
      return await getStatus()
    }

    const result = await checkForUpdates({
      manual: true,
      registry: params.registry,
      distTag: params.distTag,
    })

    if (params.checkOnly || result.outcome !== 'update-available' || !result.plan || !result.checkedAt) {
      return result
    }

    return await scheduleUpgrade(result.plan, {
      commandRunner,
      checkedAt: result.checkedAt,
      execPath: options.execPath,
      pid: options.pid,
    })
  }

  return {
    paths,
    readState,
    getStatus,
    checkForUpdates,
    runAutomaticUpgrade,
    runManualUpgrade,
  }
}

export async function schedulePreparedUpgrade(result: UpdateCheckResult, options: AutoUpgradeServiceOptions): Promise<ScheduledUpgradeResult> {
  if (result.outcome !== 'update-available' || !result.plan || !result.checkedAt) {
    throw new PackageManagerError('An upgrade plan is required before scheduling an upgrade')
  }

  const commandRunner = options.commandRunner ?? new NodeCommandRunner()
  return await scheduleUpgrade(result.plan, {
    commandRunner,
    checkedAt: result.checkedAt,
    execPath: options.execPath,
    pid: options.pid,
  })
}

export async function deferChecksUntil(storageDir: string, delayMs: number): Promise<void> {
  const nextCheckAt = addMilliseconds(new Date(), delayMs)
  await writeUpgradeState(storageDir, {
    retryAfter: toIsoString(nextCheckAt),
  })
}
