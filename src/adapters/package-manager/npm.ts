import type { BuildInstallCommandOptions, CommandRunner, InstallCommand, PackageManager } from '../../types.js'

export function getNpmExecutable(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? 'npm.cmd' : 'npm'
}

export function buildNpmInvocation(
  args: string[],
  platform: NodeJS.Platform = process.platform,
): Pick<InstallCommand, 'command' | 'args' | 'shell'> {
  const npmCommand = getNpmExecutable(platform)

  if (platform === 'win32') {
    return {
      command: process.env.ComSpec ?? 'cmd.exe',
      args: ['/d', '/s', '/c', npmCommand, ...args],
      shell: false,
    }
  }

  return {
    command: npmCommand,
    args,
    shell: false,
  }
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

  const invocation = buildNpmInvocation(args, platform)

  return {
    managerId: 'npm',
    command: invocation.command,
    args: invocation.args,
    shell: invocation.shell,
  }
}

export async function hasNpm(runner: CommandRunner, platform: NodeJS.Platform = process.platform): Promise<boolean> {
  const invocation = buildNpmInvocation(['--version'], platform)
  const result = await runner.run(invocation.command, invocation.args, {
    shell: invocation.shell,
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
