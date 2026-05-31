import test from 'node:test'
import assert from 'node:assert/strict'

import { buildNpmInfoArgs, checkForNpmUpdate, parseNpmInfoVersion } from '../src/adapters/version-source/npm-cli.js'
import { VersionSourceError } from '../src/errors.js'
import { FakeCommandRunner } from './helpers/fake-runner.js'

test('buildNpmInfoArgs includes dist-tag and registry overrides', () => {
  assert.deepEqual(
    buildNpmInfoArgs({
      packageName: 'auto-upgrade',
      distTag: 'next',
      registry: 'https://registry.example.com',
    }),
    ['info', 'auto-upgrade@next', 'version', '--json', '--registry', 'https://registry.example.com'],
  )
})

test('parseNpmInfoVersion accepts JSON strings and objects', () => {
  assert.equal(parseNpmInfoVersion('"1.2.3"'), '1.2.3')
  assert.equal(parseNpmInfoVersion('{"version":"1.2.4"}'), '1.2.4')
})

test('parseNpmInfoVersion throws on empty output', () => {
  assert.throws(() => parseNpmInfoVersion(''), VersionSourceError)
})

test('checkForNpmUpdate delegates to npm and returns the latest version', async () => {
  const runner = new FakeCommandRunner()
  runner.pushResult({
    exitCode: 0,
    stdout: '"1.4.0"',
  })

  const result = await checkForNpmUpdate({
    packageName: 'auto-upgrade',
  }, runner, 'linux')

  assert.equal(result.latestVersion, '1.4.0')
  assert.equal(runner.runs.length, 1)
  assert.equal(runner.runs[0]?.command, 'npm')
})
