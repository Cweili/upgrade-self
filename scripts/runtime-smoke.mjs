import assert from 'assert'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

async function main() {
  const esm = await import('../dist/index.mjs')
  const cjs = require('../dist/index.cjs')

  assert.strictEqual(typeof esm.createAutoUpgradeService, 'function')
  assert.strictEqual(typeof esm.resolveUpgradePaths, 'function')
  assert.strictEqual(esm.compareVersions('1.0.0', '1.0.1') < 0, true)

  const esmService = esm.createAutoUpgradeService({
    packageName: 'upgrade-self',
    currentVersion: '1.0.0',
    storageDir: '.auto-upgrade-runtime-smoke',
    env: {},
    argv: [],
    isInteractive: true,
  })

  assert.strictEqual(typeof esmService.getStatus, 'function')
  assert.strictEqual(typeof cjs.createAutoUpgradeService, 'function')
  assert.strictEqual(typeof cjs.resolveUpgradePaths, 'function')
  assert.strictEqual(cjs.compareVersions('1.0.0', '1.0.1') < 0, true)

  const cjsService = cjs.createAutoUpgradeService({
    packageName: 'upgrade-self',
    currentVersion: '1.0.0',
    storageDir: '.auto-upgrade-runtime-smoke',
    env: {},
    argv: [],
    isInteractive: true,
  })

  assert.strictEqual(typeof cjsService.getStatus, 'function')
  console.log('runtime smoke passed')
}
