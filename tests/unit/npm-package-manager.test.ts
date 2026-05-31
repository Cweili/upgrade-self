import test from 'node:test'
import assert from 'node:assert/strict'

import { buildNpmInstallCommand, buildNpmInvocation, getNpmExecutable, hasNpm } from '../../src/adapters/package-manager/npm.js'
import { FakeCommandRunner } from './helpers/fake-runner.js'

test('getNpmExecutable returns npm.cmd on Windows', () => {
  assert.equal(getNpmExecutable('win32'), 'npm.cmd')
  assert.equal(getNpmExecutable('linux'), 'npm')
})

test('buildNpmInvocation wraps npm.cmd through cmd.exe on Windows', () => {
  const invocation = buildNpmInvocation(['--version'], 'win32')

  assert.match(invocation.command, /cmd\.exe$/iu)
  assert.deepEqual(invocation.args, ['/d', '/s', '/c', 'npm.cmd', '--version'])
  assert.equal(invocation.shell, false)
})

test('buildNpmInstallCommand wraps npm.cmd through cmd.exe on Windows', () => {
  const command = buildNpmInstallCommand({
    packageName: 'upgrade-self',
    version: '1.2.0',
  }, 'win32')

  assert.match(command.command, /cmd\.exe$/iu)
  assert.deepEqual(command.args, ['/d', '/s', '/c', 'npm.cmd', 'install', '-g', 'upgrade-self@1.2.0', '--no-audit', '--no-fund'])
  assert.equal(command.shell, false)
})

test('hasNpm runs npm.cmd through cmd.exe on Windows', async () => {
  const runner = new FakeCommandRunner()
  runner.pushResult({ exitCode: 0 })

  const available = await hasNpm(runner, 'win32')

  assert.equal(available, true)
  assert.match(runner.runs[0]?.command ?? '', /cmd\.exe$/iu)
  assert.deepEqual(runner.runs[0]?.args, ['/d', '/s', '/c', 'npm.cmd', '--version'])
  assert.equal(runner.runs[0]?.options?.shell, false)
})
