// End-to-end coverage of the v3 Shopping List flow:
//   list → compare (alternatives) → checkout (tick + confirm)
//
// v3 model: only ALTERNATIVES are tickable; checkout = ticked subset.
// This spec replaces the v2 per-item-Buy coverage (the [Buy] button was
// removed when checkout footer + tick model shipped).
//
// Auth: prefers Brave profile (run-with-profile.mjs --copy). Falls back
// to email/password from .test-password if a fresh harness is launched.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadCreds () {
  const candidates = [
    path.join(__dirname, '.test-password'),
    path.join(process.cwd(), 'tests/e2e/.test-password'),
    path.join(process.cwd(), 'backend/web-admin/tests/e2e/.test-password'),
  ]
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue
    const out = {}
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('='); if (eq <= 0) continue
      out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
    }
    return {
      email: out.GROCERY_TEST_EMAIL || out.TEST_EMAIL || '',
      password: out.GROCERY_TEST_PASSWORD || out.TEST_PASSWORD || '',
    }
  }
  return { email: '', password: '' }
}

const TEST_LIST_NAME = `[e2e v3] ${new Date().toISOString().slice(0, 19)}`
const PRIMARY_NAME = 'E2E v3 Eggs'
const ALT_BRAND = 'TestBrand v3'

export default {
  name: 'shopping-list-v3-full',
  url: 'http://localhost:5173',
  objective:
    'v3 e2e: create list, add primary, add alternative (manual), tick alt, verify checkout footer shows it, confirm checkout, verify cascade-delete, cleanup.',
  successCriteria: [
    'Logged in',
    'List page renders with [+ New list]',
    'New list created and opened',
    'Primary added (intent row)',
    'Alternative added under primary (price comparison entry)',
    'Tick checkbox on alternative shows it in checkout footer',
    'Checkout footer shows ticked count + spent total',
    'Confirm checkout deletes primary + alts; toast confirms',
    'After checkout, list is empty (cascade worked)',
    'Cleanup: list deleted',
  ],
  allowConsoleErrors: true,

  run: async (page, expect, step) => {
    page.on('dialog', (dlg) => dlg.accept())  // confirm() prompts auto-accept

    // Network tracing: surface 4xx/5xx responses on shopping-lists API so a
    // failing tick / checkout shows up in the test log instead of just a UI
    // toast.
    page.on('response', async (resp) => {
      const url = resp.url()
      const status = resp.status()
      if (/\/api\//.test(url) && status >= 400) {
        let body = ''
        try { body = (await resp.text()).slice(0, 1500) } catch {}
        const reqBody = resp.request().postData() || ''
        console.log(`[net] ${status} ${resp.request().method()} ${url}`)
        if (reqBody) console.log(`[net]   request: ${reqBody.slice(0, 400)}`)
        console.log(`[net]   response: ${body}`)
      }
    })

    // ─── Auth ─────────────────────────────────────────────────
    await step('unlock-and-open', async () => {
      // Cache-bust + SW unregister to survive Brave-profile carry-over
      // (matches the pattern from the v2 spec).
      await page.goto(`/?_cb=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
      await page.evaluate(async () => {
        try {
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations()
            await Promise.all(regs.map((r) => r.unregister()))
          }
          if (typeof caches !== 'undefined') {
            const keys = await caches.keys()
            await Promise.all(keys.map((k) => caches.delete(k)))
          }
        } catch (_) { /* best-effort */ }
      })
      await page.goto(`/shopping-lists?_cb=${Date.now()}`, {
        waitUntil: 'networkidle',
        timeout: 30_000,
      })
      if (!/\/login/.test(page.url())) return  // already authenticated

      const creds = loadCreds()
      if (!creds.email || !creds.password) {
        throw new Error(
          'Not logged in and no credentials. Use run-with-profile.mjs (Brave fully closed) or drop creds at tests/e2e/.test-password.',
        )
      }
      await expect(page.locator('h1:has-text("GroceryApp")').first()).toBeVisible({ timeout: 15_000 })
      await page.locator('input[type="email"]').fill(creds.email)
      await page.locator('input[type="password"]').fill(creds.password)
      await page.locator('button:has-text("Sign In")').first().click()
      await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 })
      await page.goto('/shopping-lists', { waitUntil: 'networkidle' })
    })

    await step('list-page-loads', async () => {
      await expect(page.locator('h1:has-text("Shopping Lists")').first()).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.locator('button:has-text("+ New list")').first()).toBeVisible()
    })

    await step('create-new-list', async () => {
      await page.locator('button:has-text("+ New list")').first().click()
      const nameInput = page.locator('input[placeholder*="List name"]').first()
      await expect(nameInput).toBeVisible()
      await nameInput.fill(TEST_LIST_NAME)
      await page.locator('button:has-text("Create")').first().click()
      await expect(page.locator(`text="${TEST_LIST_NAME}"`).first()).toBeVisible({ timeout: 10_000 })
    })

    await step('open-list-detail', async () => {
      await page.locator(`text="${TEST_LIST_NAME}"`).first().click()
      await expect(page.locator('a:has-text("← Shopping Lists")').first()).toBeVisible({
        timeout: 10_000,
      })
      // v3 markers: caps badge, scan-to-buy button, three add entry points
      await expect(page.locator('button:has-text("+ Add manually")').first()).toBeVisible()
      await expect(page.locator('button:has-text("Browse catalog")').first()).toBeVisible()
      await expect(page.locator('button:has-text("Scan to buy")').first()).toBeVisible()
    })

    // ─── Step 1 of v3: list (add primary) ──────────────────────
    await step('add-primary-manually', async () => {
      await page.locator('button:has-text("+ Add manually")').first().click()
      const itemInput = page.locator('input[placeholder*="Item name"]').first()
      await expect(itemInput).toBeVisible()
      await itemInput.fill(PRIMARY_NAME)
      // Optional qty for unit-mismatch testing later
      await page.locator('input[placeholder="Qty"]').first().fill('12')
      await page.locator('button:has-text("Add to list")').first().click()
      await expect(page.locator(`text="${PRIMARY_NAME}"`).first()).toBeVisible({ timeout: 10_000 })
      // v3: primary shows "no alt" tag because no alternatives yet
      await expect(page.locator('text=no alt').first()).toBeVisible()
    })

    // ─── Step 2 of v3: compare (add alternative) ───────────────
    await step('add-alternative-manually', async () => {
      // Click "+ Alt" on the primary row (first one with that label)
      await page.locator('button:has-text("+ Alt")').first().click()
      // The first input ("Brand / variant" / candidate_name) has autoFocus,
      // which races with Playwright's fill/type and leaves the React state
      // unset. Side-step by using the second-row "Brand" input (no autoFocus)
      // — altDisplayLabel falls back to brand when candidate_name is empty,
      // so the displayed text is still ALT_BRAND.
      const brandFieldRow2 = page.locator('input[placeholder="Brand"]').first()
      await expect(brandFieldRow2).toBeVisible()
      await brandFieldRow2.fill(ALT_BRAND)
      await page.locator('input[placeholder*="Price"]').first().fill('5.99')
      await page.locator('button:has-text("Add alternative")').first().click()
      // The alt should now appear in the expanded panel
      await expect(page.locator(`text="${ALT_BRAND}"`).first()).toBeVisible({ timeout: 10_000 })
      // "no alt" tag should be gone now that we have one
      await expect(page.locator('text=no alt').first()).toHaveCount(0, { timeout: 5_000 })
    })

    // ─── Step 3 of v3: checkout (tick the alt) ─────────────────
    await step('tick-alternative', async () => {
      // Find the alt row by brand name and tick its checkbox.
      // Using click() (not check()) — check() auto-retries on state mismatch
      // and races with React Query's invalidate→refetch cycle that updates
      // the controlled checkbox. The next assertion (footer "1 ticked")
      // gates on the actual state change.
      const altRow = page
        .locator('li')
        .filter({ has: page.locator(`text="${ALT_BRAND}"`) })
        .first()
      await altRow.locator('input[type="checkbox"]').click()
      // Footer should now show "1 ticked"
      await expect(page.locator('text=/1 ticked/').first()).toBeVisible({ timeout: 10_000 })
    })

    await step('checkout-footer-shows-totals', async () => {
      // Footer expands when 1+ ticked: shows spent total + Confirm button
      await expect(page.locator('text=/spent/').first()).toBeVisible({ timeout: 5_000 })
      await expect(page.locator('button:has-text("Confirm checkout")').first()).toBeVisible()
    })

    await step('confirm-checkout', async () => {
      await page.locator('button:has-text("Confirm checkout")').first().click()
      // Success toast: "Checkout done — 1 item added."
      await expect(
        page.locator('text=/Checkout done|item added|added\\./').first(),
      ).toBeVisible({ timeout: 15_000 })
    })

    await step('verify-cascade-deleted', async () => {
      // Primary should be gone (cascade-deleted with its sole alt)
      await expect(page.locator(`text="${PRIMARY_NAME}"`).first()).toHaveCount(0, {
        timeout: 10_000,
      })
      // Empty state visible
      await expect(
        page.locator('text=/Nothing on the list yet|no items/i').first(),
      ).toBeVisible({ timeout: 5_000 })
    })

    // ─── Bonus: Use-as-alt helper path ─────────────────────────
    await step('use-as-alt-helper', async () => {
      // Add a quick primary
      await page.locator('button:has-text("+ Add manually")').first().click()
      await page.locator('input[placeholder*="Item name"]').first().fill('E2E v3 Milk')
      await page.locator('button:has-text("Add to list")').first().click()
      await expect(page.locator('text="E2E v3 Milk"').first()).toBeVisible({ timeout: 10_000 })
      // Click "Use as alt" — auto-creates an alternative
      await page.locator('button:has-text("Use as alt")').first().click()
      // The auto alt should appear with "(auto)" label
      await expect(page.locator('text=/\\(auto\\)/').first()).toBeVisible({ timeout: 10_000 })
    })

    // ─── Cleanup ───────────────────────────────────────────────
    await step('cleanup-delete-list', async () => {
      await page.locator('button:has-text("Delete list")').first().click()
      // confirm() handler at the top auto-accepts
      await expect(page).toHaveURL(/\/shopping-lists$/, { timeout: 10_000 })
      await expect(page.locator(`text="${TEST_LIST_NAME}"`).first()).toHaveCount(0, {
        timeout: 8_000,
      })
    })
  },
}
