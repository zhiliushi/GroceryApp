#!/usr/bin/env node
// CDP-attach runner — connects to a Chrome/Brave instance launched with
// --remote-debugging-port=9222 and runs a spec against the user's existing
// (logged-in) context, so no test credentials are needed.
//
// Usage:
//   node tests/e2e/run-cdp.mjs --spec <path-to-spec> [--cdp-port 9222] [--url http://localhost:5173]
//
// Pre-requisite: relaunch Brave with the debug flag. Windows example:
//   1. Quit ALL Brave windows.
//   2. Run in PowerShell:
//      & "$env:LocalAppData\BraveSoftware\Brave-Browser\Application\brave.exe" `
//        --remote-debugging-port=9222
//      (or use the system install path under "C:\Program Files\BraveSoftware\...")
//   3. Sign in once if needed; the session persists for subsequent runs.

import { chromium } from 'playwright'
import { expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

function parseArgs (argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const k = a.slice(2)
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true
      out[k] = v
    }
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
if (!args.spec) {
  console.error('Usage: run-cdp.mjs --spec <path> [--cdp-port 9222] [--url http://localhost:5173]')
  process.exit(2)
}

const specPath = path.resolve(args.spec)
const cdpPort = args['cdp-port'] || 9222
const projectRoot = path.resolve(args.project || process.cwd())

const spec = (await import(pathToFileURL(specPath).href)).default
if (!spec || typeof spec.run !== 'function') {
  console.error(`Spec at ${specPath} must export default { name, url, run, ... }`)
  process.exit(2)
}

const startedAt = new Date()
const runId = startedAt.toISOString().replace(/[:.]/g, '-')
const reportDir = path.join(
  projectRoot,
  '.claude',
  'artifacts',
  'test-reports',
  `${runId}-${spec.name}-cdp`,
)
const screenshotDir = path.join(reportDir, 'screenshots')
await fs.mkdir(screenshotDir, { recursive: true })

console.log(`[cdp-runner] connecting to http://localhost:${cdpPort}`)
let browser
try {
  browser = await chromium.connectOverCDP(`http://localhost:${cdpPort}`)
} catch (err) {
  console.error(`\n[cdp-runner] Could not connect to Brave/Chrome on port ${cdpPort}.`)
  console.error('  Did you relaunch with `--remote-debugging-port=9222`? See the comment')
  console.error('  at the top of this file for instructions.\n')
  console.error(`  Underlying error: ${err.message}`)
  process.exit(3)
}

// Reuse the FIRST existing context (the user's normal profile, with cookies).
// connectOverCDP exposes one BrowserContext per "default" profile.
const contexts = browser.contexts()
const context = contexts[0] || (await browser.newContext())
console.log(`[cdp-runner] using existing context (${(context.pages() || []).length} open pages)`)

if (spec.url) {
  // Set baseURL on a new page; can't easily mutate context after the fact,
  // so we manually prepend baseURL inside page.goto wrappers below.
}

// Open a NEW tab in that context so we don't disrupt the user's existing tabs.
const page = await context.newPage()

// Wrap goto to prepend spec.url as baseURL when the spec passes a relative path.
const originalGoto = page.goto.bind(page)
page.goto = (url, opts) => {
  if (typeof url === 'string' && url.startsWith('/') && spec.url) {
    return originalGoto(spec.url.replace(/\/$/, '') + url, opts)
  }
  return originalGoto(url, opts)
}

const consoleErrors = []
const pageErrors = []
const steps = []

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
page.on('pageerror', (err) => pageErrors.push(err.message))

const sanitize = (s) => s.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()

const step = async (name, fn) => {
  try {
    await fn()
    const shotPath = path.join(screenshotDir, `${sanitize(name)}.png`)
    await page.screenshot({ path: shotPath, fullPage: true }).catch(() => {})
    steps.push({ name, status: 'passed', screenshot: path.relative(reportDir, shotPath) })
    console.log(`  ✓ ${name}`)
  } catch (err) {
    const shotPath = path.join(screenshotDir, `${sanitize(name)}-FAIL.png`)
    await page.screenshot({ path: shotPath, fullPage: true }).catch(() => {})
    steps.push({
      name,
      status: 'failed',
      screenshot: path.relative(reportDir, shotPath),
      error: err.message,
    })
    console.log(`  ✗ ${name} — ${err.message.split('\n')[0]}`)
    throw err
  }
}

let passed = false
let failureReason = null
let failureCategory = null

try {
  await spec.run(page, expect, step)
  const successShot = path.join(screenshotDir, 'final-success.png')
  await page.screenshot({ path: successShot, fullPage: true })
  steps.push({ name: 'final', status: 'passed', screenshot: path.relative(reportDir, successShot) })

  const allErrors = [...consoleErrors, ...pageErrors]
  if (allErrors.length > 0 && !spec.allowConsoleErrors) {
    failureReason = `Console/page errors:\n${allErrors.join('\n')}`
    failureCategory = 'console-error'
  } else {
    passed = true
  }
} catch (err) {
  failureReason = err.message
  failureCategory = err.message.includes('Missing credentials') ? 'auth' : 'spec-failed'
}

const endedAt = new Date()
const durationMs = endedAt.getTime() - startedAt.getTime()

const report = {
  runId,
  spec: { name: spec.name, url: spec.url, objective: spec.objective, successCriteria: spec.successCriteria || [] },
  passed,
  failureReason,
  failureCategory,
  consoleErrors,
  pageErrors,
  steps,
  durationMs,
  startedAt: startedAt.toISOString(),
  endedAt: endedAt.toISOString(),
  reportDir,
  mode: 'cdp-attached',
}
await fs.writeFile(path.join(reportDir, 'report.json'), JSON.stringify(report, null, 2))

// Close OUR tab; leave the browser + user's other tabs alone.
await page.close().catch(() => {})

console.log(JSON.stringify({
  passed,
  reportDir,
  failureReason,
  failureCategory,
  consoleErrors: consoleErrors.length,
  pageErrors: pageErrors.length,
}, null, 2))

process.exit(passed ? 0 : 1)
