import test from 'node:test'
import assert from 'node:assert/strict'

import { compareVersions, hasNewerVersion } from '../../src/core/version.js'
import { VersionFormatError } from '../../src/errors.js'

test('compareVersions handles patch bumps', () => {
  assert.equal(compareVersions('1.0.0', '1.0.1') < 0, true)
  assert.equal(hasNewerVersion('1.0.0', '1.0.1'), true)
})

test('compareVersions respects prerelease ordering', () => {
  assert.equal(compareVersions('1.0.0-beta.1', '1.0.0') < 0, true)
})

test('compareVersions throws on invalid semver input', () => {
  assert.throws(() => compareVersions('invalid', '1.0.0'), VersionFormatError)
})
