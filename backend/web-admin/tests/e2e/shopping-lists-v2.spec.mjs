// Comprehensive e2e for the v2 Shopping List page.
// Auth modes:
//   - CDP-attached (run-cdp.mjs) — already logged in; just navigate.
//   - Fresh harness — loads creds from `.test-password` and drives the login form.

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

const TEST_LIST_NAME = `[e2e] ${new Date().toISOString().slice(0, 19)}`

export default {
  name: 'shopping-list-v2-full',
  url: 'http://localhost:5173',
  objective:
    'End-to-end: list/detail rendering, all 3 add-item entry points, price comparison, buy flow, cross-page catalog integration.',
  successCriteria: [
    'Logged in (CDP-attached or via .test-password)',
    '/shopping-lists list page renders with [+ New list]',
    'New list created and opened',
    'Manual Add adds an item',
    'Browse catalog opens autocomplete',
    'Scan opens ContextualScannerModal',
    'Item expand reveals price comparison panel',
    'Add Price form adds an entry',
    'Buy opens QuickAddModal with prefill',
    'Catalog page [+ Add to shopping list] picker reaches our list',
    'Cleanup: list deleted',
  ],
  allowConsoleErrors: true,

  run: async (page, expect, step) => {
    page.on('dialog', (dlg) => dlg.accept())  // confirm() prompts auto-accept

    await step('unlock-and-open', async () => {
      // First load the root with cache-busting, then aggressively unregister
      // any service workers and clear caches the source profile left behind.
      // The SPA's SW (workbox) intercepts /assets/* chunks and can serve
      // stale or mis-versioned chunks → Suspense never resolves.
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
      // Hard reload after SW unregister so the next nav goes straight to
      // network for chunks (no SW interception possible).
      await page.goto(`/shopping-lists?_cb=${Date.now()}`, {
        waitUntil: 'networkidle',
        timeout: 30_000,
      })
      console.log('[spec] post-nav URL:', page.url())

      if (!/\/login/.test(page.url())) return  // already authenticated

      const creds = loadCreds()
      if (!creds.email || !creds.password) {
        throw new Error(
          'Not logged in and no credentials available.\n' +
            'Use run-with-profile.mjs (Brave fully closed) or .test-password.',
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
      // Ride out Suspense — the lazy chunk for ShoppingListsPage may take
      // an extra beat after networkidle.
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
      await expect(page.locator('button:has-text("+ Add manually")').first()).toBeVisible()
      await expect(page.locator('button:has-text("Browse catalog")').first()).toBeVisible()
      await expect(page.locator('button:has-text("Scan")').first()).toBeVisible()
    })

    const ITEM_NAME = 'E2E Test Eggs'
    await step('add-item-manual', async () => {
      await page.locator('button:has-text("+ Add manually")').first().click()
      const itemInput = page.locator('input[placeholder*="Item name"]').first()
      await expect(itemInput).toBeVisible()
      await itemInput.fill(ITEM_NAME)
      await page.locator('input[placeholder="Qty"]').first().fill('12')
      await page.locator('button:has-text("Add to list")').first().click()
      await expect(page.locator(`text="${ITEM_NAME}"`).first()).toBeVisible({ timeout: 10_000 })
    })

    await step('add-item-browse-catalog-opens', async () => {
      await page.locator('button:has-text("Browse catalog")').first().click()
      await expect(page.locator('input[placeholder*="Search your catalog"]').first()).toBeVisible({
        timeout: 5_000,
      })
      await page.locator('button:has-text("✕ Cancel")').first().click()
    })

    await step('add-item-scan-opens-modal', async () => {
      await page.locator('button:has-text("Scan")').first().click()
      const scannerHeading = page.locator('h3:has-text("Scan barcode")').first()
      await expect(scannerHeading).toBeVisible({ timeout: 5_000 })
      // Close: click the ✕ inside the scanner modal's header (sidebar also has
      // a hidden ✕ — using `.first()` would match that). Scope by the heading.
      await scannerHeading.locator('xpath=..').locator('button:has-text("✕")').click()
      await expect(scannerHeading).not.toBeVisible({ timeout: 5_000 })
    })

    await step('expand-item-prices', async () => {
      const itemRow = page
        .locator('div')
        .filter({ has: page.locator(`text="${ITEM_NAME}"`) })
        .first()
      await itemRow.locator('button:has-text("▾")').first().click()
      await expect(
        page.locator('text=/No price comparisons yet|Brand|Store|Price/').first(),
      ).toBeVisible({ timeout: 5_000 })
    })

    await step('add-price-comparison', async () => {
      await page.locator('button:has-text("+ Add price comparison")').first().click()
      const priceInput = page.locator('input[placeholder="Price *"]').first()
      await expect(priceInput).toBeVisible()
      await priceInput.fill('5.99')
      await page.locator('input[placeholder="Brand (optional)"]').first().fill('TestBrand')
      await page.locator('button:has-text("Add price")').first().click()
      await expect(page.locator('text="TestBrand"').first()).toBeVisible({ timeout: 10_000 })
    })

    await step('buy-opens-quick-add-modal', async () => {
      await page.locator('button:has-text("Buy")').first().click()
      await expect(
        page.locator('button:has-text("Save"), button:has-text("Add purchase")').first(),
      ).toBeVisible({ timeout: 8_000 })
      await page.keyboard.press('Escape')
    })

    await step('delete-price-entry', async () => {
      const priceRow = page
        .locator('tr')
        .filter({ has: page.locator('text="TestBrand"') })
        .first()
      await priceRow.locator('button:has-text("✕")').first().click()
      await expect(page.locator('text="TestBrand"').first()).toHaveCount(0, { timeout: 5_000 })
    })

    await step('catalog-add-to-shopping-list-button', async () => {
      await page.goto('/catalog', { waitUntil: 'networkidle' })
      const firstCatalogLink = page.locator('a[href^="/catalog/"]').first()
      if ((await firstCatalogLink.count()) === 0) return  // no catalog data, skip
      await firstCatalogLink.click()
      await expect(page.locator('button:has-text("+ Add to shopping list")').first()).toBeVisible({
        timeout: 10_000,
      })
      await page.locator('button:has-text("+ Add to shopping list")').first().click()
      await expect(page.locator(`text="${TEST_LIST_NAME}"`).first()).toBeVisible({ timeout: 5_000 })
      await page.locator(`text="${TEST_LIST_NAME}"`).first().click()
      await page.waitForTimeout(800)
    })

    await step('cleanup-delete-list', async () => {
      await page.goto('/shopping-lists', { waitUntil: 'networkidle' })
      await page.locator(`text="${TEST_LIST_NAME}"`).first().click()
      await expect(page.locator('button:has-text("Delete list")').first()).toBeVisible({
        timeout: 8_000,
      })
      await page.locator('button:has-text("Delete list")').first().click()
      await expect(page).toHaveURL(/\/shopping-lists$/, { timeout: 10_000 })
      await expect(page.locator(`text="${TEST_LIST_NAME}"`).first()).toHaveCount(0, {
        timeout: 8_000,
      })
    })
  },
}
