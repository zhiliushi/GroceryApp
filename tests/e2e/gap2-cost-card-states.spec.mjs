/**
 * Gap 2 verification — RecipeCostCard renders the four-state copy correctly.
 *
 * Confirms the 2026-05-04 copy/state fix:
 *   priced       — show "RM 0.50 · 2d ago"
 *   no_history   — show "no purchase yet"  (was "no history")
 *   common_only  — show "common: <name>"   (was "no link" — the bug)
 *   unlinked     — show "free text"        (was "no link")
 *
 * Auth: profile-inheritance from Brave (--copy). Brave must be closed.
 *
 * If the user has no recipes (empty /meals), this spec creates a labeled
 * test recipe with 3 ingredients designed to hit common_only + unlinked
 * states (no purchase history → priced state isn't reachable in a fresh
 * test recipe), verifies, then deletes the test recipe via the DELETE
 * endpoint so the account isn't left polluted.
 */
const TEST_RECIPE_NAME = '[GAP2 TEST] cost-card states';

export default {
  name: 'gap2-cost-card-states',
  url: 'http://localhost:5173',
  objective:
    'Visually confirm RecipeCostCard.tsx now renders 4 distinct states ' +
    '(priced / no purchase yet / common: <name> / free text) and the old ' +
    '"no link" / "no history" copy is gone.',
  successCriteria: [
    'SPA loads logged-in (Brave profile inherited)',
    'Reach a recipe edit page that has the 💰 Estimated cost card',
    'No line in the cost card shows "no link" or "no history"',
    'At least one of the new state strings appears',
    'Test recipe (if created) is deleted at the end',
  ],
  allowConsoleErrors: true,

  run: async (page, expect, step) => {
    let createdRecipeId = null;

    await step('open-spa-root', async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
    });

    await step('detect-auth-state', async () => {
      const url = page.url();
      const onLogin = /\/login/i.test(url) || (await page.locator('input[type="password"]').count()) > 0;
      if (onLogin) {
        throw new Error(`Not logged in — landed on ${url}.`);
      }
    });

    await step('go-to-meals', async () => {
      await page.goto('/meals', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('a[href="/meals/new"]', { timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(800);
    });

    let recipeId = null;
    await step('pick-or-create-recipe', async () => {
      const editLinks = await page.locator('a[href*="/meals/"][href$="/edit"]').all();
      if (editLinks.length > 0) {
        const href = await editLinks[0].getAttribute('href');
        const m = href && href.match(/\/meals\/([^/]+)\/edit/);
        if (m) recipeId = m[1];
        return;
      }
      // Empty — create a labeled test recipe
      await page.goto('/meals/new', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('input[placeholder="e.g. French Toast"]', { timeout: 30000 });

      // Fill title
      await page.locator('input[placeholder="e.g. French Toast"]').fill(TEST_RECIPE_NAME);

      // The form starts with ZERO ingredient rows — click + Add ingredient
      // for each row before filling.
      const addIngBtn = page.locator('button:has-text("+ Add ingredient")');
      const ingNameInputs = () => page.locator('input[placeholder="Ingredient name"]');

      // Row 1: santan (Malaysian common-ingredient) → expects "common: santan"
      await addIngBtn.click();
      await page.waitForTimeout(200);
      await ingNameInputs().nth(0).fill('santan');

      // Row 2: free text
      await addIngBtn.click();
      await page.waitForTimeout(200);
      await ingNameInputs().nth(1).fill('asdfgxyz123');

      // Row 3: egg (common-ingredient seed)
      await addIngBtn.click();
      await page.waitForTimeout(200);
      await ingNameInputs().nth(2).fill('egg');

      // Submit (button text is "Save Recipe")
      await page.locator('button:has-text("Save Recipe")').first().click();
      // Wait for redirect to /meals
      await page.waitForURL('**/meals', { timeout: 15000 });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1200);

      // Find the newly-created recipe by name
      const newLink = page
        .locator('a[href*="/meals/"][href$="/edit"]')
        .filter({ hasText: 'cost-card states' })
        .first();
      // Fallback: just take the first edit link
      const newCount = await newLink.count();
      const link = newCount > 0 ? newLink : page.locator('a[href*="/meals/"][href$="/edit"]').first();
      const href = await link.getAttribute('href');
      const m = href && href.match(/\/meals\/([^/]+)\/edit/);
      if (!m) throw new Error(`Could not parse recipe id after create. href=${href}`);
      recipeId = m[1];
      createdRecipeId = recipeId;
    });

    await step('open-recipe-edit', async () => {
      await page.goto(`/meals/${recipeId}/edit`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('input[placeholder="Ingredient name"]', { timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);
    });

    let cardText = null;
    await step('locate-cost-card', async () => {
      await page.waitForSelector('text=Estimated cost', { timeout: 15000 });
      const heading = page.locator('text=Estimated cost').first();
      const card = heading.locator('xpath=ancestor::*[contains(@class, "rounded-lg")][1]');
      cardText = await card.innerText();
      page._testContext = { ...(page._testContext || {}), cardText };
      await card.screenshot({ path: 'cost-card.png' }).catch(() => {});
    });

    await step('assert-state-strings', async () => {
      const text = (cardText || '').toLowerCase();
      const oldStrings = {
        'no link': text.includes('no link'),
        'no history': text.includes('no history'),
      };
      const newStrings = {
        'no purchase yet': text.includes('no purchase yet'),
        'common:': text.includes('common:'),
        'free text': text.includes('free text'),
      };
      page._testContext = {
        ...(page._testContext || {}),
        oldStringsPresent: oldStrings,
        newStringsPresent: newStrings,
      };
      if (oldStrings['no link'] || oldStrings['no history']) {
        throw new Error(
          `Old copy still present. Found: ${JSON.stringify(oldStrings)}\nText:\n${cardText}`,
        );
      }
      const anyNew = Object.values(newStrings).some(Boolean);
      const looksPriced = /\b\d+\.\d{2}\b/.test(text);
      if (!anyNew && !looksPriced) {
        throw new Error(`No new state-string and no priced amount. Text:\n${cardText}`);
      }
    });

    // Cleanup — only delete recipes WE created in this run
    if (createdRecipeId) {
      await step('cleanup-delete-test-recipe', async () => {
        const r = await page.request.delete(
          `http://localhost:8000/api/meals/recipes/${createdRecipeId}`,
        );
        page._testContext = {
          ...(page._testContext || {}),
          cleanupStatus: r.status(),
        };
        if (r.status() !== 204 && r.status() !== 200) {
          // Don't fail the test on cleanup — just log
          console.warn(`[gap2] cleanup delete returned ${r.status()}`);
        }
      });
    }

    // eslint-disable-next-line no-console
    console.info('[gap2-test-context]', JSON.stringify(page._testContext || {}, null, 2));
  },
};
