import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

async function main() {
  const esm = await import('../dist/index.mjs')
  const cjs = require('../dist/index.cjs')

  assert.equal(typeof esm.createAutoUpgradeService, 'function')
  assert.equal(typeof esm.resolveUpgradePaths, 'function')
  assert.equal(esm.compareVersions('1.0.0', '1.0.1') < 0, true)

  const esmService = esm.createAutoUpgradeService({
    packageName: 'upgrade-self',
    currentVersion: '1.0.0',
    storageDir: '.auto-upgrade-runtime-smoke',
    env: {},
    argv: [],
    isInteractive: true,
  })

  assert.equal(typeof esmService.getStatus, 'function')
  assert.equal(typeof cjs.createAutoUpgradeService, 'function')
  assert.equal(typeof cjs.resolveUpgradePaths, 'function')
  assert.equal(cjs.compareVersions('1.0.0', '1.0.1') < 0, true)

  const cjsService = cjs.createAutoUpgradeService({
    packageName: 'upgrade-self',
    currentVersion: '1.0.0',
    storageDir: '.auto-upgrade-runtime-smoke',
    env: {},
    argv: [],
    isInteractive: true,
  })

  assert.equal(typeof cjsService.getStatus, 'function')
  console.log('runtime smoke passed')
}
