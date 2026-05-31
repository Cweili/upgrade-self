import { readFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

import type { UpgradeState } from '../../../src/types.js'

export interface WaitForUpgradeStateOptions {
  timeoutMs?: number
  intervalMs?: number
}

export async function waitForUpgradeState(
  statePath: string,
  predicate: (state: UpgradeState) => boolean,
  options: WaitForUpgradeStateOptions = {},
): Promise<UpgradeState> {
  const timeoutMs = options.timeoutMs ?? 15_000
  const intervalMs = options.intervalMs ?? 100
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const state = await readStateIfPresent(statePath)

    if (state && predicate(state)) {
      return state
    }

    await delay(intervalMs)
  }

  throw new Error(`Timed out waiting for upgrade state in ${statePath}`)
}

async function readStateIfPresent(statePath: string): Promise<UpgradeState | null> {
  try {
    return JSON.parse(await readFile(statePath, 'utf8')) as UpgradeState
  } catch (error: unknown) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : ''

    if (code === 'ENOENT') {
      return null
    }

    throw error
  }
}