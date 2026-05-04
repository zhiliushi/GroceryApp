/**
 * Gap 1 verification — IngredientAutocomplete renders sectioned dropdown
 * (Your catalog / Common ingredients / Use as free text) plus inline
 * match-status hint below each ingredient input.
 *
 * Flow:
 *   1. Navigate to /meals/new
 *   2. Fill recipe name
 *   3. Add 3 ingredient rows
 *   4. Type "egg" in row 1 — expect dropdown with "Common ingredients" section
 *      AND inline hint "◉ common: egg" or similar
 *   5. Type "asdfgxyz" in row 2 — expect "Use as free text" suggestion AND
 *      inline hint "⊘ free text"
 *   6. Save and delete cleanup
 *
 * Auth: profile-inheritance from Brave (--copy). Brave must be closed.
 */
const TEST_RECIPE_NAME = '[GAP1 TEST] autocomplete';

export default {
  name: 'gap1-ingredient-autocomplete',
  url: 'http://localhost:5173',
  objective:
    'Visually confirm IngredientAutocomplete renders combobox + sectioned ' +
    'dropdown + inline match-status hint on the recipe form.',
  successCriteria: [
    'SPA loads logged-in',
    'Recipe form opens at /meals/new',
    'Dropdown renders with at least one suggestion when typing a real common-ingredient name',
    'Inline match-status hint shows "common:" or "catalog:" or "free text" beneath the row',
    'Free-text fallback ("Use as free text:") appears when no exact match',
    'Test recipe is deleted at the end',
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
      if (onLogin) throw new Error(`Not logged in — landed on ${url}`);
    });

    await step('open-recipe-form-new', async () => {
      await page.goto('/meals/new', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('input[placeholder="e.g. French Toast"]', { timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    });

    await step('probe-common-ingredients-api', async () => {
      // Just reports — doesn't fail spec.
      const r = await page.request.get('http://localhost:8000/api/meals/common-ingredients');
      page._testContext = {
        ...(page._testContext || {}),
        commonIngredientsApi: {
          status: r.status(),
          ok: r.ok(),
        },
      };
    });

    await step('fill-name-add-rows', async () => {
      await page.locator('input[placeholder="e.g. French Toast"]').fill(TEST_RECIPE_NAME);
      const addIngBtn = page.locator('button:has-text("+ Add ingredient")');
      // Add 3 rows
      await addIngBtn.click();
      await page.waitForTimeout(150);
      await addIngBtn.click();
      await page.waitForTimeout(150);
      await addIngBtn.click();
      await page.waitForTimeout(200);
    });

    let commonHintText = null;
    let commonDropdownText = null;
    await step('row-1-egg-common-match', async () => {
      const ingInputs = page.locator('input[placeholder="Ingredient name"]');
      // Slow per-character typing to let debounce settle
      await ingInputs.nth(0).click();
      await ingInputs.nth(0).pressSequentially('egg', { delay: 80 });
      await page.waitForTimeout(500); // debounce + suggestion fetch

      // Capture the dropdown text (listbox role)
      const listbox = page.locator('[role="listbox"]').first();
      if (await listbox.count() > 0) {
        commonDropdownText = await listbox.innerText();
      }

      // Capture the inline hint — looks for the row's container and reads any
      // text node starting with "✓" / "◉" / "⊘"
      // The hint sits inside the autocomplete wrapper; easiest is to find it
      // by the icon prefix in the page DOM, near the typed input.
      const hintCandidates = await page.locator('text=/common:|catalog:|free text/').allInnerTexts();
      commonHintText = hintCandidates.join(' | ');

      page._testContext = {
        ...(page._testContext || {}),
        commonDropdownText: (commonDropdownText || '').slice(0, 600),
        commonHintText: (commonHintText || '').slice(0, 200),
      };

      // Screenshot for human review
      await page.screenshot({ path: 'row1-egg-dropdown.png', fullPage: false }).catch(() => {});
    });

    let freeTextDropdown = null;
    await step('row-2-free-text-fallback', async () => {
      const ingInputs = page.locator('input[placeholder="Ingredient name"]');
      // Click row 2 to dismiss row 1's dropdown
      await page.keyboard.press('Escape'); // close row-1 dropdown
      await page.waitForTimeout(150);
      await ingInputs.nth(1).focus();
      await ingInputs.nth(1).pressSequentially('asdfgxyz', { delay: 60 });
      await page.waitForTimeout(400);
      const listbox = page.locator('[role="listbox"]').first();
      if (await listbox.count() > 0) {
        freeTextDropdown = await listbox.innerText();
      }
      page._testContext = {
        ...(page._testContext || {}),
        freeTextDropdown: (freeTextDropdown || '').slice(0, 400),
      };
      await page.screenshot({ path: 'row2-freetext.png', fullPage: false }).catch(() => {});
    });

    await step('row-3-santan', async () => {
      const ingInputs = page.locator('input[placeholder="Ingredient name"]');
      await page.keyboard.press('Escape'); // close previous dropdown
      await page.waitForTimeout(150);
      await ingInputs.nth(2).focus();
      await ingInputs.nth(2).pressSequentially('santan', { delay: 60 });
      await page.waitForTimeout(400);
      // Press Enter to commit the highlighted suggestion (or use the typed value)
      await ingInputs.nth(2).press('Escape');
    });

    await step('save-recipe', async () => {
      // Close any open dropdown before clicking Save
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      await page.locator('button:has-text("Save Recipe")').first().click({ force: true });
      await page.waitForURL('**/meals', { timeout: 15000 });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(800);

      const link = page
        .locator('a[href*="/meals/"][href$="/edit"]')
        .filter({ hasText: 'autocomplete' })
        .first();
      const fallback = page.locator('a[href*="/meals/"][href$="/edit"]').first();
      const target = (await link.count()) > 0 ? link : fallback;
      const href = await target.getAttribute('href');
      const m = href && href.match(/\/meals\/([^/]+)\/edit/);
      if (m) createdRecipeId = m[1];
    });

    await step('assert-results', async () => {
      const ctx = page._testContext || {};
      const dd1 = (ctx.commonDropdownText || '').toLowerCase();
      const dd2 = (ctx.freeTextDropdown || '').toLowerCase();
      const hint = (ctx.commonHintText || '').toLowerCase();

      // Row-1 dropdown should contain at least one suggestion or the "Use as
      // free text" entry. If the common-ingredients API didn't load, we'll
      // still have user-catalog matches OR the free-text fallback.
      const row1HasSomething = dd1.length > 0;
      if (!row1HasSomething) {
        throw new Error(
          `Row 1 dropdown was empty after typing "egg". Common-ingredients API: ${
            JSON.stringify(ctx.commonIngredientsApi)
          }`,
        );
      }

      // Row-2 dropdown MUST include the free-text fallback line.
      if (!dd2.includes('free text') && !dd2.includes('use as free text')) {
        throw new Error(
          `Row 2 dropdown for "asdfgxyz" missing free-text fallback. Got:\n${ctx.freeTextDropdown}`,
        );
      }

      // The inline hint should contain at least one of the new states.
      if (
        !hint.includes('common:') &&
        !hint.includes('catalog:') &&
        !hint.includes('free text')
      ) {
        throw new Error(
          `Inline match hint missing recognized state. Got: "${ctx.commonHintText}"`,
        );
      }
    });

    if (createdRecipeId) {
      await step('cleanup-delete-test-recipe', async () => {
        const r = await page.request.delete(
          `http://localhost:8000/api/meals/recipes/${createdRecipeId}`,
        );
        page._testContext = {
          ...(page._testContext || {}),
          cleanupStatus: r.status(),
        };
      });
    }

    // eslint-disable-next-line no-console
    console.info('[gap1-test-context]', JSON.stringify(page._testContext || {}, null, 2));
  },
};
