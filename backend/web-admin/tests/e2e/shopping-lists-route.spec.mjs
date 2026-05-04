// Verify the Shopping Lists pages route correctly and the auth gate fires.
//
// Without real Firebase credentials we can verify:
//   - /shopping-lists is a valid route (no 404)
//   - Auth-gated pages bounce unauthenticated users to /login
//   - Deep-link to /shopping-lists/:uid/:listId also gates correctly
//   - LoginPage renders its form fields
//
// What this CAN'T verify (needs real Firebase creds):
//   - The DataTable renders rows from /api/shopping-lists
//   - "View" link drills into ShoppingListDetailPage
//   - Item rows render with strikethrough on isPurchased

export default {
  name: 'shopping-lists-route',
  url: 'http://localhost:5173',
  objective: 'Verify /shopping-lists routes exist + auth gate fires (no creds available).',
  successCriteria: [
    'Hitting /shopping-lists redirects to /login (auth gate)',
    'Deep-link /shopping-lists/uid/listId also redirects to /login',
    'LoginPage renders email + password fields + Google button',
  ],
  allowConsoleErrors: true,

  run: async (page, expect, step) => {
    await step('hit-shopping-lists-unauth', async () => {
      await page.goto('/shopping-lists', { waitUntil: 'networkidle' })
      // Either the LoginPage rendered (auth gate) or the actual page loaded.
      // We expect the gate.
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
    })

    await step('login-page-renders', async () => {
      await expect(page.locator('h1:has-text("GroceryApp")').first()).toBeVisible()
      await expect(page.locator('input[type="email"]')).toBeVisible()
      await expect(page.locator('input[type="password"]')).toBeVisible()
      await expect(page.locator('button:has-text("Sign In")').first()).toBeVisible()
      await expect(page.locator('button:has-text("Sign in with Google")')).toBeVisible()
    })

    await step('hit-shopping-list-detail-deeplink', async () => {
      await page.goto('/shopping-lists/somefakeuid/somefakelistid', { waitUntil: 'networkidle' })
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
    })

    await step('login-form-interactive', async () => {
      // Type into the email field to confirm the form is interactive
      // (catches the case where LoginPage rendered but inputs are disabled/broken).
      const emailInput = page.locator('input[type="email"]')
      await emailInput.fill('test@example.com')
      await expect(emailInput).toHaveValue('test@example.com')
    })
  },
}
