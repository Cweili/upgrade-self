import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { RunnerContext, UpgradePaths, UpgradeState } from '../types.js'
import { ScheduleError } from '../errors.js'
import { buildRunnerScript } from './template.js'

const STATE_FILE_NAME = 'state.json'
const RUNNER_FILE_NAME = 'runner.cjs'
const CONTEXT_FILE_NAME = 'context.json'
const LOG_FILE_NAME = 'last-run.log'

export function resolveUpgradePaths(storageDir: string): UpgradePaths {
  return {
    storageDir,
    statePath: join(storageDir, STATE_FILE_NAME),
    runnerPath: join(storageDir, RUNNER_FILE_NAME),
    contextPath: join(storageDir, CONTEXT_FILE_NAME),
    logPath: join(storageDir, LOG_FILE_NAME),
  }
}

export async function ensureStorageDir(storageDir: string): Promise<void> {
  await mkdir(storageDir, { recursive: true })
}

export async function readUpgradeState(storageDir: string): Promise<UpgradeState> {
  const paths = resolveUpgradePaths(storageDir)

  try {
    const content = await readFile(paths.statePath, 'utf8')
    const parsed = JSON.parse(content) as unknown

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new ScheduleError(`Invalid upgrade state file: ${paths.statePath}`)
    }

    return parsed as UpgradeState
  } catch (error: unknown) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : ''

    if (code === 'ENOENT') {
      return {}
    }

    throw error
  }
}

export async function writeUpgradeState(storageDir: string, patch: Partial<UpgradeState>): Promise<UpgradeState> {
  const paths = resolveUpgradePaths(storageDir)
  await ensureStorageDir(storageDir)

  const current = await readUpgradeState(storageDir)
  const nextState: UpgradeState = {
    ...current,
    ...patch,
  }

  for (const [key, value] of Object.entries(nextState)) {
    if (value === undefined) {
      delete nextState[key as keyof UpgradeState]
    }
  }

  await writeFile(paths.statePath, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8')
  return nextState
}

export async function writeRunnerFiles(paths: UpgradePaths, context: RunnerContext): Promise<void> {
  await ensureStorageDir(paths.storageDir)
  await writeFile(paths.runnerPath, `${buildRunnerScript()}\n`, 'utf8')
  await writeFile(paths.contextPath, `${JSON.stringify(context, null, 2)}\n`, 'utf8')
}
