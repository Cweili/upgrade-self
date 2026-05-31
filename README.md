# upgrade-self

[![npm][badge-version]][npm]
[![npm downloads][badge-downloads]][npm]
[![license][badge-license]][license]

[![github][badge-issues]][github]
[![build][badge-build]][workflows]
[![coverage][badge-coverage]][coveralls]

upgrade-self is a shared upgrade core for Node.js CLIs. It checks npm for the latest version, builds an upgrade plan, writes a detached runner payload, and performs the global upgrade after the parent process exits.

The current implementation focuses on npm as the installer, while the public types and service layer keep room for additional package manager adapters.

## Capabilities

- Query the remote version with `npm info <package> version --json`
- Compare versions with semver, including prerelease semantics
- Share the same `UpgradePlan` and state machine between automatic and manual upgrade flows
- Persist upgrade state, runner context, and logs under an isolated `storageDir`
- Use a detached Node runner to avoid Windows file-lock conflicts while the CLI is still running

## Install

```bash
npm install upgrade-self
```

## Public API

```ts
import {
  buildNpmInstallCommand,
  checkForNpmUpdate,
  compareVersions,
  createAutoUpgradeService,
  readUpgradeState,
  resolveUpgradePaths,
  shouldCheckForUpdates,
} from 'upgrade-self'
```

## Integration Example

The service is designed to be wired into a CLI at startup. A consumer can call the automatic path before dispatching commands, then reuse the same service for a manual `upgrade` command.

```ts
import os from 'node:os'
import { createRequire } from 'node:module'
import path from 'node:path'

import { NodeCommandRunner, createAutoUpgradeService } from 'upgrade-self'

const require = createRequire(import.meta.url)
const packageJson = require('./package.json') as { name: string; version: string }

const service = createAutoUpgradeService({
  packageName: packageJson.name,
  currentVersion: packageJson.version,
  storageDir: path.join(os.homedir(), '.my-cli', 'upgrade'),
  registry: process.env.npm_config_registry,
  argv: process.argv.slice(2),
  env: process.env,
  isInteractive: process.stdout.isTTY && process.stderr.isTTY,
  commandRunner: new NodeCommandRunner(),
})

await service.runAutomaticUpgrade()

// Inside a dedicated `upgrade` command:
// const status = await service.getStatus()
// const result = await service.runManualUpgrade({ checkOnly: true })
```

## Design Boundaries

- This package is a shared upgrade core, not a CLI command parser or text output layer.
- This package targets Node.js only, so it does not produce browser UMD/CDN artifacts.
- The first release ships with npm-only execution, but the type surface is ready for additional package managers.
- The detached runner uses its own `storageDir` and does not depend on a consumer-specific config schema.

## Local Development

```bash
npm install
npm run lint
npm run build
npm run test:unit
npm run test:e2e
npm test
```

Version requirements:

- Published runtime: Node.js 14.18.0 or higher
- Test runtime: Node.js 18.0.0 or higher
- Build environment: Node.js 22.18.0 or higher because `tsdown` requires it

The end-to-end suite stays offline: `tests/e2e` prepends a local stub `npm` or `npm.cmd`, then exercises the real detached runner without contacting the public registry.

[badge-version]: https://img.shields.io/npm/v/upgrade-self.svg
[badge-downloads]: https://img.shields.io/npm/dt/upgrade-self.svg
[npm]: https://www.npmjs.com/package/upgrade-self

[badge-license]: https://img.shields.io/npm/l/upgrade-self.svg
[license]: https://github.com/Cweili/upgrade-self/blob/main/LICENSE

[badge-issues]: https://img.shields.io/github/issues/Cweili/upgrade-self.svg
[github]: https://github.com/Cweili/upgrade-self

[badge-build]: https://img.shields.io/github/actions/workflow/status/Cweili/upgrade-self/ci.yml?branch=main
[workflows]: https://github.com/Cweili/upgrade-self/actions/workflows/ci.yml?query=branch%3Amain

[badge-coverage]: https://img.shields.io/coveralls/github/Cweili/upgrade-self/main.svg
[coveralls]: https://coveralls.io/github/Cweili/upgrade-self?branch=main
