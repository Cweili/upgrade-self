import type { CommandRunner, VersionSource, VersionSourceOptions, VersionSourceResult } from '../../types.js'
import { VersionSourceError } from '../../errors.js'
import { getNpmExecutable } from '../package-manager/npm.js'

export function buildNpmInfoArgs(options: VersionSourceOptions): string[] {
  const distTag = options.distTag ?? 'latest'
  const packageSpec = distTag === 'latest' ? options.packageName : `${options.packageName}@${distTag}`
  const args = ['info', packageSpec, 'version', '--json']

  if (options.registry) {
    args.push('--registry', options.registry)
  }

  return args
}

export function parseNpmInfoVersion(stdout: string): string {
  const trimmed = stdout.trim()
  if (!trimmed) {
    throw new VersionSourceError('npm info returned empty output')
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    return extractVersion(parsed, trimmed)
  } catch {
    return extractVersion(trimmed, trimmed)
  }
}

function extractVersion(value: unknown, raw: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  if (Array.isArray(value) && value.length > 0) {
    return extractVersion(value[0], raw)
  }

  if (typeof value === 'object' && value !== null && 'version' in value) {
    const candidate = value as { version?: unknown }
    if (typeof candidate.version === 'string' && candidate.version.trim().length > 0) {
      return candidate.version.trim()
    }
  }

  throw new VersionSourceError(`Unable to parse npm version output: ${raw}`)
}

export async function checkForNpmUpdate(
  options: VersionSourceOptions,
  runner: CommandRunner,
  platform: NodeJS.Platform = process.platform,
): Promise<VersionSourceResult> {
  const result = await runner.run(getNpmExecutable(platform), buildNpmInfoArgs(options), {
    shell: false,
    windowsHide: true,
  })

  if (result.exitCode !== 0) {
    throw new VersionSourceError(result.stderr.trim() || `npm info failed with exit code ${result.exitCode}`)
  }

  return {
    packageName: options.packageName,
    latestVersion: parseNpmInfoVersion(result.stdout),
    distTag: options.distTag ?? 'latest',
    registry: options.registry,
    raw: result.stdout,
  }
}

export const npmCliVersionSource: VersionSource = {
  async getLatestVersion(options: VersionSourceOptions, runner: CommandRunner): Promise<VersionSourceResult> {
    return await checkForNpmUpdate(options, runner)
  },
}
