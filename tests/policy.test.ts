import test from 'node:test'
import assert from 'node:assert/strict'

import { shouldCheckForUpdates } from '../src/core/policy.js'

test('shouldCheckForUpdates respects the enabled flag', () => {
  const result = shouldCheckForUpdates({}, { enabled: false })
  assert.equal(result.shouldCheck, false)
  assert.equal(result.reason, 'disabled')
})

test('shouldCheckForUpdates throttles by interval', () => {
  const result = shouldCheckForUpdates(
    {
      lastCheckAt: '2026-05-30T10:00:00.000Z',
    },
    {
      checkIntervalMs: 60_000,
    },
    {
      now: new Date('2026-05-30T10:00:30.000Z'),
      isInteractive: true,
      env: {},
      argv: [],
    },
  )

  assert.equal(result.shouldCheck, false)
  assert.equal(result.reason, 'interval')
  assert.equal(result.nextCheckAt, '2026-05-30T10:01:00.000Z')
})

test('manual checks bypass CI and command token skips', () => {
  const result = shouldCheckForUpdates(
    {
      retryAfter: '2026-06-01T00:00:00.000Z',
    },
    {},
    {
      manual: true,
      env: { CI: 'true' },
      argv: ['upgrade'],
      isInteractive: false,
      now: new Date('2026-05-30T00:00:00.000Z'),
    },
  )

  assert.equal(result.shouldCheck, true)
})

test('automatic checks skip in CI by default', () => {
  const result = shouldCheckForUpdates({}, {}, {
    env: { CI: 'true' },
    argv: ['list'],
    isInteractive: true,
    now: new Date('2026-05-30T00:00:00.000Z'),
  })

  assert.equal(result.shouldCheck, false)
  assert.equal(result.reason, 'ci')
})
