import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface StubNpmOptions {
  latestVersion: string
  installExitCode?: number
  installStdout?: string
  installStderr?: string
  npmVersion?: string
}

export interface StubNpmCall {
  args: string[]
  cwd: string
  timestamp: string
}

export interface StubNpmFixture {
  binDir: string
  callsPath: string
  readCalls(): Promise<StubNpmCall[]>
}

export async function createStubNpm(baseDir: string, options: StubNpmOptions): Promise<StubNpmFixture> {
  const binDir = join(baseDir, 'stub-npm')
  const callsPath = join(binDir, 'calls.jsonl')
  const shellNodePath = process.execPath.replace(/'/g, `'"'"'`)
  const windowsNodePath = process.execPath.replace(/"/g, '""')

  await mkdir(binDir, { recursive: true })
  await writeFile(join(binDir, 'config.json'), `${JSON.stringify(options, null, 2)}\n`, 'utf8')
  await writeFile(callsPath, '', 'utf8')
  await writeFile(join(binDir, 'stub-npm.mjs'), buildStubScript(), 'utf8')
  await writeFile(join(binDir, 'npm'), [
    '#!/bin/sh',
    'SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)',
    `'${shellNodePath}' "$SCRIPT_DIR/stub-npm.mjs" "$@"`,
    '',
  ].join('\n'), 'utf8')
  await writeFile(join(binDir, 'npm.cmd'), [
    '@echo off',
    `"${windowsNodePath}" "%~dp0stub-npm.mjs" %*`,
    '',
  ].join('\r\n'), 'utf8')
  await chmod(join(binDir, 'npm'), 0o755)

  return {
    binDir,
    callsPath,
    async readCalls(): Promise<StubNpmCall[]> {
      const content = await readFile(callsPath, 'utf8')
      return content
        .split(/\r?\n/u)
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as StubNpmCall)
    },
  }
}

function buildStubScript(): string {
  return [
    "import { appendFile, readFile } from 'node:fs/promises'",
    "import { dirname, join } from 'node:path'",
    "import { fileURLToPath } from 'node:url'",
    '',
    'const scriptDir = dirname(fileURLToPath(import.meta.url))',
    "const config = JSON.parse(await readFile(join(scriptDir, 'config.json'), 'utf8'))",
    "const callsPath = join(scriptDir, 'calls.jsonl')",
    'const args = process.argv.slice(2)',
    '',
    'await appendFile(callsPath, JSON.stringify({',
    '  args,',
    '  cwd: process.cwd(),',
    '  timestamp: new Date().toISOString(),',
    "}) + '\\n', 'utf8')",
    '',
    "if (args.length === 1 && args[0] === '--version') {",
    "  process.stdout.write(String(config.npmVersion ?? '10.9.0') + '\\n')",
    '  process.exit(0)',
    '}',
    '',
    "if (args[0] === 'info') {",
    "  process.stdout.write(JSON.stringify(config.latestVersion ?? '1.2.0'))",
    '  process.exit(0)',
    '}',
    '',
    "if (args[0] === 'install') {",
    '  if (config.installStdout) {',
    '    process.stdout.write(String(config.installStdout))',
    '  }',
    '  if (config.installStderr) {',
    '    process.stderr.write(String(config.installStderr))',
    '  }',
    '  process.exit(Number(config.installExitCode ?? 0))',
    '}',
    '',
    "process.stderr.write('Unexpected npm args: ' + args.join(' '))",
    'process.exit(2)',
    '',
  ].join('\n')
}
