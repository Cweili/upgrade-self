export function buildRunnerScript(): string {
  return `'use strict'

const { spawn } = require('node:child_process')
const { mkdir, readFile, rm, writeFile, appendFile } = require('node:fs/promises')
const { dirname } = require('node:path')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return fallback
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(value, null, 2) + '\\n', 'utf8')
}

async function patchState(path, patch) {
  const current = await readJson(path, {})
  const next = { ...current, ...patch }
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) {
      delete next[key]
    }
  }
  await writeJson(path, next)
}

async function appendLog(path, message) {
  await mkdir(dirname(path), { recursive: true })
  await appendFile(path, '[' + new Date().toISOString() + '] ' + message + '\\n', 'utf8')
}

function isAlive(pid) {
  if (!pid) {
    return false
  }

  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function main() {
  const contextPath = process.argv[2]
  const context = await readJson(contextPath, null)
  if (!context) {
    return
  }

  await mkdir(dirname(context.logPath), { recursive: true })
  await writeFile(context.logPath, '', 'utf8')
  await appendLog(context.logPath, 'upgrade runner started')

  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (!isAlive(context.parentPid)) {
      break
    }
    await sleep(1000)
  }

  await appendLog(context.logPath, 'starting install command: ' + context.command + ' ' + context.args.join(' '))

  const exitCode = await new Promise((resolve) => {
    const child = spawn(context.command, context.args, {
      shell: Boolean(context.shell),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    child.stdout && child.stdout.on('data', (chunk) => {
      appendLog(context.logPath, String(chunk).trimEnd()).catch(() => undefined)
    })
    child.stderr && child.stderr.on('data', (chunk) => {
      appendLog(context.logPath, String(chunk).trimEnd()).catch(() => undefined)
    })
    child.on('error', async (error) => {
      await appendLog(context.logPath, 'spawn error: ' + error.message).catch(() => undefined)
      resolve(1)
    })
    child.on('close', (code) => resolve(code ?? 1))
  })

  if (exitCode === 0) {
    await appendLog(context.logPath, 'upgrade completed successfully')
    await patchState(context.statePath, {
      lastStatus: 'success',
      lastVersion: context.targetVersion,
      lastError: undefined,
      lastLogPath: context.logPath,
      retryAfter: undefined,
    })
  } else {
    await appendLog(context.logPath, 'upgrade failed with non-zero exit code')
    await patchState(context.statePath, {
      lastStatus: 'failed',
      lastVersion: context.targetVersion,
      lastError: 'Upgrade process failed',
      lastLogPath: context.logPath,
      retryAfter: new Date(Date.now() + Number(context.retryDelayMs || 0)).toISOString(),
    })
  }

  await rm(context.contextPath, { force: true })
}

main().catch(async (error) => {
  const context = await readJson(process.argv[2], null)
  if (context && context.statePath) {
    await patchState(context.statePath, {
      lastStatus: 'failed',
      lastError: error instanceof Error ? error.message : String(error),
      lastLogPath: context.logPath,
      retryAfter: new Date(Date.now() + Number(context.retryDelayMs || 0)).toISOString(),
    }).catch(() => undefined)
  }
  process.exit(1)
})
`
}
