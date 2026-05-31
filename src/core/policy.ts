import type { CheckContext, CheckDecision, UpgradePolicy, UpgradeState } from '../types.js'
import { addMilliseconds, parseTimestamp, toIsoString } from './dates.js'

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])

export const DEFAULT_POLICY: UpgradePolicy = {
  enabled: true,
  checkIntervalMs: 24 * 60 * 60 * 1000,
  retryDelayMs: 12 * 60 * 60 * 1000,
  distTag: 'latest',
  addNoAudit: true,
  addNoFund: true,
  skipInCi: true,
  skipInNonInteractive: true,
  skipCommandTokens: ['upgrade', '--help', '-h', '--version', '-V'],
}

export function resolveUpgradePolicy(policy: Partial<UpgradePolicy> = {}): UpgradePolicy {
  return {
    ...DEFAULT_POLICY,
    ...policy,
    skipCommandTokens: policy.skipCommandTokens ? [...policy.skipCommandTokens] : [...DEFAULT_POLICY.skipCommandTokens],
  }
}

export function isCiEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  const ciValue = env.CI?.trim().toLowerCase()
  const nonInteractiveValue = env.NON_INTERACTIVE?.trim().toLowerCase()

  return (ciValue !== undefined && TRUE_VALUES.has(ciValue))
    || (nonInteractiveValue !== undefined && TRUE_VALUES.has(nonInteractiveValue))
}

export function matchesSkipCommand(argv: readonly string[] = [], tokens: readonly string[] = []): boolean {
  return argv.some((value) => tokens.includes(value))
}

export function shouldCheckForUpdates(
  state: UpgradeState,
  inputPolicy: Partial<UpgradePolicy> = {},
  context: CheckContext = {},
): CheckDecision {
  if (context.manual) {
    return { shouldCheck: true }
  }

  const policy = resolveUpgradePolicy(inputPolicy)
  const now = context.now ?? new Date()

  if (!policy.enabled) {
    return { shouldCheck: false, reason: 'disabled' }
  }

  if (policy.skipInCi && isCiEnvironment(context.env ?? process.env)) {
    return { shouldCheck: false, reason: 'ci' }
  }

  const isInteractive = context.isInteractive ?? Boolean(process.stdout.isTTY && process.stderr.isTTY)
  if (policy.skipInNonInteractive && !isInteractive) {
    return { shouldCheck: false, reason: 'non-interactive' }
  }

  if (matchesSkipCommand(context.argv, policy.skipCommandTokens)) {
    return { shouldCheck: false, reason: 'command' }
  }

  const retryAfter = parseTimestamp(state.retryAfter)
  if (retryAfter && retryAfter.getTime() > now.getTime()) {
    return {
      shouldCheck: false,
      reason: 'retry-after',
      nextCheckAt: retryAfter.toISOString(),
    }
  }

  const lastCheckAt = parseTimestamp(state.lastCheckAt)
  if (lastCheckAt) {
    const nextCheckAt = addMilliseconds(lastCheckAt, policy.checkIntervalMs)
    if (nextCheckAt.getTime() > now.getTime()) {
      return {
        shouldCheck: false,
        reason: 'interval',
        nextCheckAt: toIsoString(nextCheckAt),
      }
    }
  }

  return { shouldCheck: true }
}
