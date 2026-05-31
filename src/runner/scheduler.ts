import type { CommandRunner, ScheduledUpgradeResult, UpgradePlan, UpgradeState } from '../types.js'
import { writeRunnerFiles, writeUpgradeState } from './files.js'

export interface ScheduleUpgradeOptions {
  commandRunner: CommandRunner
  checkedAt: string
  execPath?: string
  pid?: number
}

export async function scheduleUpgrade(
  plan: UpgradePlan,
  options: ScheduleUpgradeOptions,
): Promise<ScheduledUpgradeResult> {
  const state = await writeUpgradeState(plan.paths.storageDir, {
    lastAttemptAt: options.checkedAt,
    lastStatus: 'scheduled',
    lastVersion: plan.targetVersion,
    lastError: undefined,
    lastLogPath: plan.paths.logPath,
  })

  await writeRunnerFiles(plan.paths, {
    statePath: plan.paths.statePath,
    contextPath: plan.paths.contextPath,
    logPath: plan.paths.logPath,
    command: plan.installCommand.command,
    args: plan.installCommand.args,
    shell: plan.installCommand.shell,
    targetVersion: plan.targetVersion,
    parentPid: options.pid ?? process.pid,
    retryDelayMs: plan.retryDelayMs,
  })

  await options.commandRunner.spawnDetached(options.execPath ?? process.execPath, [
    plan.paths.runnerPath,
    plan.paths.contextPath,
  ], {
    shell: false,
    windowsHide: true,
  })

  return {
    outcome: 'scheduled',
    currentVersion: plan.currentVersion,
    latestVersion: plan.targetVersion,
    checkedAt: options.checkedAt,
    plan,
    state,
  }
}

export function createFailedState(
  current: UpgradeState,
  message: string,
  retryAfter: string,
  logPath?: string,
): UpgradeState {
  return {
    ...current,
    lastStatus: 'failed',
    lastError: message,
    lastLogPath: logPath,
    retryAfter,
  }
}
