import { spawn } from 'node:child_process'

import type { CommandResult, CommandRunner, RunCommandOptions } from './types.js'

export class NodeCommandRunner implements CommandRunner {
  public async run(command: string, args: string[], options: RunCommandOptions = {}): Promise<CommandResult> {
    return await new Promise<CommandResult>((resolve) => {
      let stdout = ''
      let stderr = ''

      const child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        shell: options.shell ?? false,
        windowsHide: options.windowsHide ?? true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      child.stdout?.on('data', (chunk) => {
        stdout += String(chunk)
      })
      child.stderr?.on('data', (chunk) => {
        stderr += String(chunk)
      })
      child.on('error', (error) => {
        resolve({
          exitCode: 1,
          stdout,
          stderr,
          error,
        })
      })
      child.on('close', (exitCode) => {
        resolve({
          exitCode: exitCode ?? 1,
          stdout,
          stderr,
        })
      })
    })
  }

  public async spawnDetached(command: string, args: string[], options: RunCommandOptions = {}): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        shell: options.shell ?? false,
        windowsHide: options.windowsHide ?? true,
        detached: true,
        stdio: 'ignore',
      })

      child.on('error', reject)
      child.unref()
      resolve()
    })
  }
}
