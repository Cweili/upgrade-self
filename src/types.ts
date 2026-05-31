export type UpgradeStatus = 'idle' | 'scheduled' | 'success' | 'failed'

export type PackageManagerId = 'npm' | 'pnpm' | 'yarn' | 'bun'

export type CheckSkipReason =
  | 'disabled'
  | 'interval'
  | 'retry-after'
  | 'ci'
  | 'non-interactive'
  | 'command'

export interface UpgradeState {
  lastCheckAt?: string
  retryAfter?: string
  lastAttemptAt?: string
  lastStatus?: UpgradeStatus
  lastVersion?: string
  lastError?: string
  lastLogPath?: string
}

export interface UpgradePolicy {
  enabled: boolean
  checkIntervalMs: number
  retryDelayMs: number
  distTag: string
  addNoAudit: boolean
  addNoFund: boolean
  skipInCi: boolean
  skipInNonInteractive: boolean
  skipCommandTokens: string[]
}

export interface CheckContext {
  argv?: readonly string[]
  env?: NodeJS.ProcessEnv
  isInteractive?: boolean
  manual?: boolean
  now?: Date
}

export interface CheckDecision {
  shouldCheck: boolean
  reason?: CheckSkipReason
  nextCheckAt?: string
}

export interface RunCommandOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  shell?: boolean
  windowsHide?: boolean
}

export interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
  error?: Error
}

export interface CommandRunner {
  run(command: string, args: string[], options?: RunCommandOptions): Promise<CommandResult>
  spawnDetached(command: string, args: string[], options?: RunCommandOptions): Promise<void>
}

export interface VersionSourceOptions {
  packageName: string
  registry?: string
  distTag?: string
}

export interface VersionSourceResult {
  packageName: string
  latestVersion: string
  distTag: string
  registry?: string
  raw?: unknown
}

export interface VersionSource {
  getLatestVersion(options: VersionSourceOptions, runner: CommandRunner): Promise<VersionSourceResult>
}

export interface BuildInstallCommandOptions {
  packageName: string
  version: string
  registry?: string
  addNoAudit?: boolean
  addNoFund?: boolean
}

export interface InstallCommand {
  managerId: PackageManagerId
  command: string
  args: string[]
  shell: boolean
}

export interface PackageManager {
  id: PackageManagerId
  getExecutable(platform?: NodeJS.Platform): string
  isAvailable(runner: CommandRunner, platform?: NodeJS.Platform): Promise<boolean>
  buildInstallCommand(options: BuildInstallCommandOptions, platform?: NodeJS.Platform): InstallCommand
}

export interface UpgradePaths {
  storageDir: string
  statePath: string
  runnerPath: string
  contextPath: string
  logPath: string
}

export interface RunnerContext {
  statePath: string
  contextPath: string
  logPath: string
  command: string
  args: string[]
  shell: boolean
  targetVersion: string
  parentPid: number
  retryDelayMs: number
}

export interface UpgradePlan {
  packageName: string
  currentVersion: string
  targetVersion: string
  distTag: string
  registry?: string
  installCommand: InstallCommand
  paths: UpgradePaths
  retryDelayMs: number
}

export interface UpdateCheckResult {
  outcome: 'skipped' | 'up-to-date' | 'update-available'
  packageName: string
  currentVersion: string
  latestVersion?: string
  hasUpdate: boolean
  checkedAt?: string
  registry?: string
  distTag: string
  managerId: PackageManagerId
  reason?: CheckSkipReason
  plan?: UpgradePlan
  state: UpgradeState
}

export interface ScheduledUpgradeResult {
  outcome: 'scheduled'
  currentVersion: string
  latestVersion: string
  checkedAt: string
  plan: UpgradePlan
  state: UpgradeState
}

export interface UpgradeStatusResult {
  outcome: 'status'
  paths: UpgradePaths
  state: UpgradeState
}

export type ManualUpgradeResult = UpdateCheckResult | ScheduledUpgradeResult | UpgradeStatusResult

export type AutomaticUpgradeResult = UpdateCheckResult | ScheduledUpgradeResult

export interface ManualUpgradeOptions {
  registry?: string
  distTag?: string
  checkOnly?: boolean
  statusOnly?: boolean
}

export interface AutoUpgradeServiceOptions {
  packageName: string
  currentVersion: string
  storageDir: string
  registry?: string
  distTag?: string
  policy?: Partial<UpgradePolicy>
  versionSource?: VersionSource
  packageManager?: PackageManager
  commandRunner?: CommandRunner
  env?: NodeJS.ProcessEnv
  argv?: readonly string[]
  isInteractive?: boolean
  now?: () => Date
  execPath?: string
  pid?: number
  platform?: NodeJS.Platform
}
