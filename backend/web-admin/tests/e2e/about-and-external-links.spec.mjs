// Smoke test for the new About page + External Links admin tab end-to-end.
//
// Flow:
//   1. Visit /about as a logged-in user (or fall through if not).
//      The page may show "no links yet" OR a seeded Ko-fi card depending
//      on prior state.
//   2. Open /admin-settings → External Links tab.
//   3. Click "Seed defaults" to insert the Ko-fi default if missing.
//   4. Verify the Ko-fi entry surfaces in the admin list.
//   5. Click "+ Add link" and create an additional reference link.
//   6. Verify the new link appears in the admin list.
//   7. Visit /about again and verify both links render in the right
//      categories.
//   8. Edit the new link's description, save, verify the change.
//   9. Disable the new link, verify it's hidden on /about.
//  10. Re-enable, then delete it. Cleanup.
//
// Auth: prefers Brave profile via run-with-profile.mjs --copy.

const TEST_LABEL = `[smoke] Reference link ${new Date().toISOString().slice(0, 19)}`
const TEST_URL = 'https://example.com/grocery-smoke'
const EDITED_DESCRIPTION = `Edited at ${new Date().toISOString().slice(0, 19)}`

export default {
  name: 'about-and-external-links',
  url: 'http://localhost:5173',
  objective:
    'Verify AboutPage + ExternalLinksTab admin end-to-end: seed default Ko-fi link, add a new reference link, verify on /about, edit description, disable/re-enable, delete.',
  successCriteria: [
    'Logged in (Brave profile carry-over)',
    '/about page renders without crash',
    'Admin Settings page loads',
    'External Links tab is clickable',
    'Seed defaults inserts Ko-fi link (or reports already seeded)',
    'Ko-fi link visible in admin list',
    'New reference link can be created',
    'New link appears in /about under Further reading',
    'Edit description persists',
    'Disable hides link from /about',
    'Re-enable shows link again',
    'Delete removes the test link',
  ],
  allowConsoleErrors: true,

  run: async (page, expect, step) => {
    page.on('dialog', (dlg) => dlg.accept()) // confirm() prompts auto-accept
    page.on('response', async (resp) => {
      const url = resp.url()
      const status = resp.status()
      if (/\/api\//.test(url) && status >= 400 && status !== 429) {
        let body = ''
        try { body = (await resp.text()).slice(0, 800) } catch {}
        const reqBody = resp.request().postData() || ''
        console.log(`[net] ${status} ${resp.request().method()} ${url}`)
        if (reqBody) console.log(`[net]   request: ${reqBody.slice(0, 300)}`)
        console.log(`[net]   response: ${body}`)
      }
    })

    // ─── Auth ─────────────────────────────────────────────────
    await step('unlock-and-open', async () => {
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
      await page.goto(`/?_cb=${Date.now()}`, { waitUntil: 'networkidle', timeout: 30_000 })
      if (/\/login/.test(page.url())) {
        throw new Error(
          'Not logged in. Use run-with-profile.mjs --copy against the logged-in Brave profile.',
        )
      }
    })

    // ─── 1. /about basic render ───────────────────────────────
    await step('about-page-loads', async () => {
      await page.goto('/about', { waitUntil: 'networkidle', timeout: 20_000 })
      await expect(page.locator('h1:has-text("About GroceryApp")').first()).toBeVisible({
        timeout: 10_000,
      })
    })

    // ─── 2. Open Admin Settings ───────────────────────────────
    await step('open-admin-settings', async () => {
      await page.goto('/admin-settings', { waitUntil: 'networkidle', timeout: 30_000 })
      await expect(page.locator('h1:has-text("Admin Settings")').first()).toBeVisible({
        timeout: 10_000,
      })
    })

    // ─── 3. Click External Links tab ──────────────────────────
    await step('click-external-links-tab', async () => {
      await page.locator('button:has-text("External Links")').first().click()
      await expect(page.locator('text=/External Links/').first()).toBeVisible({
        timeout: 5_000,
      })
      // The tab body has a heading "External Links" inside the description card
      await expect(
        page.locator('text=/Donation \\/ reference \\/ social URLs/').first(),
      ).toBeVisible({ timeout: 5_000 })
    })

    // ─── 4. Seed defaults (idempotent) ────────────────────────
    await step('seed-defaults', async () => {
      await page.locator('button:has-text("Seed defaults")').first().click()
      // Either toast "Seeded N default link(s)" or "already has links"
      await expect(
        page
          .locator(
            'text=/Seeded.*default link|already has links|nothing seeded/i',
          )
          .first(),
      ).toBeVisible({ timeout: 10_000 })
      // Ko-fi label should now appear
      await expect(page.locator('text=/Support on Ko-fi/').first()).toBeVisible({
        timeout: 10_000,
      })
    })

    // ─── 5. Add a new reference link ──────────────────────────
    await step('add-reference-link', async () => {
      await page.locator('button:has-text("+ Add link")').first().click()
      // Form fields render
      await expect(page.locator('input[placeholder*="Support on Ko-fi"]').first()).toBeVisible({
        timeout: 5_000,
      })
      await page.locator('input[placeholder*="Support on Ko-fi"]').first().fill(TEST_LABEL)
      await page.locator('input[placeholder*="ko-fi.com"]').first().fill(TEST_URL)
      // Category dropdown — switch to "reference"
      await page
        .locator('select')
        .filter({ hasText: 'donation' })
        .first()
        .selectOption('reference')
      // Description (optional)
      await page
        .locator('input[placeholder*="GroceryApp helps you"]')
        .first()
        .fill('Initial description for smoke test')
      // Submit
      await page.locator('button:has-text("Create link")').first().click()
      // Toast + entry visible
      await expect(page.locator('text=/Link added/').first()).toBeVisible({ timeout: 10_000 })
      await expect(page.locator(`text="${TEST_LABEL}"`).first()).toBeVisible({ timeout: 10_000 })
    })

    // ─── 6. /about shows new link ─────────────────────────────
    await step('about-shows-new-link', async () => {
      await page.goto(`/about?_cb=${Date.now()}`, { waitUntil: 'networkidle', timeout: 20_000 })
      await expect(page.locator('h1:has-text("About GroceryApp")').first()).toBeVisible({
        timeout: 10_000,
      })
      // Ko-fi (donation section)
      await expect(page.locator('text=/Support on Ko-fi/').first()).toBeVisible({
        timeout: 5_000,
      })
      // Our test link (reference section)
      await expect(page.locator(`text="${TEST_LABEL}"`).first()).toBeVisible({
        timeout: 5_000,
      })
      // Section heading "Further reading" visible
      await expect(page.locator('text=/Further reading/').first()).toBeVisible({
        timeout: 5_000,
      })
    })

    // ─── 7. Edit description ──────────────────────────────────
    await step('edit-description', async () => {
      await page.goto('/admin-settings', { waitUntil: 'networkidle', timeout: 20_000 })
      await page.locator('button:has-text("External Links")').first().click()
      // Find the row for our test label and click Edit
      const row = page
        .locator('li')
        .filter({ has: page.locator(`text="${TEST_LABEL}"`) })
        .first()
      await row.locator('button:has-text("Edit")').first().click()
      // Description input — replace
      const descInput = page.locator('input[placeholder*="GroceryApp helps you"]').first()
      await expect(descInput).toBeVisible({ timeout: 5_000 })
      await descInput.fill(EDITED_DESCRIPTION)
      await page.locator('button:has-text("Save changes")').first().click()
      await expect(page.locator('text=/Link updated/').first()).toBeVisible({ timeout: 10_000 })
      // The new description is now in the list
      await expect(page.locator(`text="${EDITED_DESCRIPTION}"`).first()).toBeVisible({
        timeout: 10_000,
      })
    })

    // ─── 8. Disable, verify hidden on /about ──────────────────
    await step('disable-link', async () => {
      const row = page
        .locator('li')
        .filter({ has: page.locator(`text="${TEST_LABEL}"`) })
        .first()
      await row.locator('button:has-text("Disable")').first().click()
      // Strikethrough / "disabled" badge in admin
      await expect(
        page
          .locator('li')
          .filter({ has: page.locator(`text="${TEST_LABEL}"`) })
          .first()
          .locator('text=/disabled/i'),
      ).toBeVisible({ timeout: 5_000 })
    })

    await step('about-hides-disabled', async () => {
      await page.goto(`/about?_cb=${Date.now()}`, { waitUntil: 'networkidle', timeout: 20_000 })
      // Test label should NOT be visible now
      await expect(page.locator(`text="${TEST_LABEL}"`).first()).toHaveCount(0, {
        timeout: 5_000,
      })
      // Ko-fi (still enabled) should still show
      await expect(page.locator('text=/Support on Ko-fi/').first()).toBeVisible({
        timeout: 5_000,
      })
    })

    // ─── 9. Re-enable ─────────────────────────────────────────
    await step('reenable-link', async () => {
      await page.goto('/admin-settings', { waitUntil: 'networkidle', timeout: 20_000 })
      await page.locator('button:has-text("External Links")').first().click()
      const row = page
        .locator('li')
        .filter({ has: page.locator(`text="${TEST_LABEL}"`) })
        .first()
      await row.locator('button:has-text("Enable")').first().click()
      // The disabled badge should disappear within the row
      await expect(
        page
          .locator('li')
          .filter({ has: page.locator(`text="${TEST_LABEL}"`) })
          .first()
          .locator('text=/disabled/i'),
      ).toHaveCount(0, { timeout: 5_000 })
    })

    // ─── 10. Delete (cleanup) ─────────────────────────────────
    await step('delete-link', async () => {
      const row = page
        .locator('li')
        .filter({ has: page.locator(`text="${TEST_LABEL}"`) })
        .first()
      await row.locator('button:has-text("Delete")').first().click()
      // confirm() handler at the top accepts
      await expect(page.locator('text=/Link deleted/').first()).toBeVisible({ timeout: 10_000 })
      await expect(page.locator(`text="${TEST_LABEL}"`).first()).toHaveCount(0, {
        timeout: 5_000,
      })
    })
  },
}
