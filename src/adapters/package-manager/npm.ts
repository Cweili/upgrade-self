import type { BuildInstallCommandOptions, CommandRunner, InstallCommand, PackageManager } from '../../types.js'

export function getNpmExecutable(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? 'npm.cmd' : 'npm'
}

export function buildNpmInstallCommand(
  options: BuildInstallCommandOptions,
  platform: NodeJS.Platform = process.platform,
): InstallCommand {
  const args = ['install', '-g', `${options.packageName}@${options.version}`]

  if (options.registry) {
    args.push('--registry', options.registry)
  }

  if (options.addNoAudit !== false) {
    args.push('--no-audit')
  }

  if (options.addNoFund !== false) {
    args.push('--no-fund')
  }

  return {
    managerId: 'npm',
    command: getNpmExecutable(platform),
    args,
    shell: false,
  }
}

export async function hasNpm(runner: CommandRunner, platform: NodeJS.Platform = process.platform): Promise<boolean> {
  const result = await runner.run(getNpmExecutable(platform), ['--version'], {
    shell: false,
    windowsHide: true,
  })

  return result.exitCode === 0
}

export const npmPackageManager: PackageManager = {
  id: 'npm',
  getExecutable: getNpmExecutable,
  isAvailable: hasNpm,
  buildInstallCommand: buildNpmInstallCommand,
}
