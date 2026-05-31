import type { CommandResult, CommandRunner, RunCommandOptions } from '../../../src/types.js'

export class FakeCommandRunner implements CommandRunner {
  public readonly runs: Array<{ command: string; args: string[]; options?: RunCommandOptions }> = []

  public readonly detachedRuns: Array<{ command: string; args: string[]; options?: RunCommandOptions }> = []

  private readonly queue: CommandResult[] = []

  public pushResult(result: Partial<CommandResult> & Pick<CommandResult, 'exitCode'>): void {
    this.queue.push({
      stdout: '',
      stderr: '',
      ...result,
    })
  }

  public async run(command: string, args: string[], options?: RunCommandOptions): Promise<CommandResult> {
    this.runs.push({
      command,
      args,
      ...(options === undefined ? {} : { options }),
    })

    return this.queue.shift() ?? {
      exitCode: 0,
      stdout: '',
      stderr: '',
    }
  }

  public async spawnDetached(command: string, args: string[], options?: RunCommandOptions): Promise<void> {
    this.detachedRuns.push({
      command,
      args,
      ...(options === undefined ? {} : { options }),
    })
  }
}
