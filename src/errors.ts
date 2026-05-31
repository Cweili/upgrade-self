export class AutoUpgradeError extends Error {
  public readonly cause?: unknown

  public constructor(message: string, options: { cause?: unknown } = {}) {
    super(message)
    this.name = new.target.name
    this.cause = options.cause
  }
}

export class VersionFormatError extends AutoUpgradeError {}

export class VersionSourceError extends AutoUpgradeError {}

export class PackageManagerError extends AutoUpgradeError {}

export class ScheduleError extends AutoUpgradeError {}
