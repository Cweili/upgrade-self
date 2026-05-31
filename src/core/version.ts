import { clean, compare, valid } from 'semver'

import { VersionFormatError } from '../errors.js'

export function normalizeVersion(value: string): string {
  const normalized = valid(value) ?? valid(clean(value) ?? '')

  if (!normalized) {
    throw new VersionFormatError(`Invalid semantic version: ${value}`)
  }

  return normalized
}

export function compareVersions(left: string, right: string): number {
  return compare(normalizeVersion(left), normalizeVersion(right))
}

export function hasNewerVersion(currentVersion: string, latestVersion: string): boolean {
  return compareVersions(currentVersion, latestVersion) < 0
}
