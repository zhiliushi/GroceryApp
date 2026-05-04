/**
 * Homemaker H1-H5 visual verification.
 *
 * Run via the profile-inheriting harness:
 *   node F:/ClaudeProjects/.claude/skills/browser-test-agent/run-with-profile.mjs \
 *     --spec F:/ClaudeProjects/GroceryApp/tests/e2e/homemaker-h1-h5.spec.mjs \
 *     --profile "C:/Users/Shahir/AppData/Local/BraveSoftware/Brave-Browser/User Data" \
 *     --project F:/ClaudeProjects/GroceryApp
 *
 * Pre-req: ALL brave.exe processes closed (profile dir lock).
 *
 * The spec navigates the user-visible homemaker surfaces in order. It
 * does NOT toggle any flags or per-user homemaker_enabled — purely
 * observational. Sections that require homemaker access (H2 History
 * button, H3 ★/📌/💬 strip) will be reported as "absent" if the
 * caller's homemaker access is OFF; that's diagnostic, not failure.
 */
export default {
  name: 'homemaker-h1-h5',
  url: 'http://localhost:5173',
  objective:
    'Verify all 5 homemaker phases are reachable in the UI: H1 admin ' +
    "controls visible, H2 history modal renders, H3 social row renders, " +
    'H4 cost-per-version captured, H5 manual section published.',
  successCriteria: [
    'SPA loads logged-in (no /login redirect)',
    'User manual section 10 (Meals: Homemaker add-on) is reachable',
    'Admin Settings → Feature Flags shows the Homemaker module group',
    '/meals route renders a recipe list',
    'Recipe edit page renders the F1 cost card (visible to all users)',
    'When homemaker.versioning is enabled: History button visible on recipe edit',
    'When homemaker.social is enabled: ★/📌/💬 strip visible per ingredient',
  ],
  allowConsoleErrors: true,

  run: async (page, expect, step) => {
    const findings = {
      sections: {},
      screenshots: [],
    };

    // -------------------------------------------------------------------
    // 1. Boot — confirm we're logged in via the Brave profile.
    //    Vite cold-start can take 20-40s on first request as it scans + bundles
    //    deps. We poll for ANY substantive body content (not just URL).
    // -------------------------------------------------------------------
    await step('boot-spa', async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      // Poll for ANY non-spinner content. The Suspense fallback is the only
      // thing on the page during cold-start; once the Sidebar or Dashboard
      // renders, body text crosses ~50 chars.
      await expect
        .poll(
          async () => (await page.locator('body').innerText()).trim().length,
          { timeout: 45_000, intervals: [500, 1000, 2000] },
        )
        .toBeGreaterThan(50);
      const url = page.url();
      const onLogin = /\/login/i.test(url);
      findings.sections.boot = {
        landed_on: url,
        logged_in: !onLogin,
        body_chars: (await page.locator('body').innerText()).length,
      };
      if (onLogin) {
        throw new Error(
          'Landed on /login — Brave profile auth not inherited. ' +
            'Confirm all brave.exe processes were closed before running.',
        );
      }
    });

    // -------------------------------------------------------------------
    // 2. H5 — User Manual section 10
    // -------------------------------------------------------------------
    await step('h5-user-manual-section-10', async () => {
      await page.goto('/help#meals-homemaker', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      // UserManualPage is lazy()-loaded — wait for the Suspense fallback to clear.
      // Vite cold-bundles the chunk on first hit; can take 15-30s.
      await expect
        .poll(
          async () => (await page.locator('h1').first().textContent())?.trim() || '',
          { timeout: 30_000, intervals: [500, 1000, 2000] },
        )
        .toMatch(/User manual/i);
      await page.waitForTimeout(500); // settle scroll-to-hash
      const heading = page.locator('text=Meals: Homemaker add-on').first();
      const visible = (await heading.count()) > 0;
      findings.sections.h5_user_manual = { section_10_visible: visible };
      if (!visible) {
        throw new Error('Section 10 (Meals: Homemaker add-on) not found in user manual');
      }
    });

    // -------------------------------------------------------------------
    // 3. H1 — Feature Flags tab shows Homemaker module group
    // -------------------------------------------------------------------
    let flagVersioning = false;
    let flagSocial = false;
    await step('h1-admin-feature-flags', async () => {
      await page.goto('/admin-settings', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      // Click Feature Flags tab (text-match — defensive)
      const tab = page.locator('button:has-text("Feature Flags"), a:has-text("Feature Flags")').first();
      if ((await tab.count()) > 0) {
        await tab.click();
        await page.waitForTimeout(600);
      }
      const homeGroup = page.locator('text=Homemaker module').first();
      const visible = (await homeGroup.count()) > 0;
      // Probe live flag values via the public-config or admin endpoint
      try {
        const r = await page.request.get('http://localhost:8000/api/admin/features');
        if (r.ok()) {
          const data = await r.json();
          const flags = data.flags || data;
          flagVersioning = !!flags.homemaker_versioning;
          flagSocial = !!flags.homemaker_social;
        }
      } catch {}
      findings.sections.h1_admin = {
        homemaker_module_group_visible: visible,
        flag_homemaker_versioning: flagVersioning,
        flag_homemaker_social: flagSocial,
      };
    });

    // -------------------------------------------------------------------
    // 4. /meals — list view
    // -------------------------------------------------------------------
    let firstRecipeEditHref = null;
    await step('meals-list', async () => {
      await page.goto('/meals', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      const editLinks = await page
        .locator('a[href*="/meals/"][href$="/edit"]')
        .all();
      if (editLinks.length > 0) {
        firstRecipeEditHref = await editLinks[0].getAttribute('href');
      }
      findings.sections.meals_list = {
        recipe_count: editLinks.length,
        first_edit_href: firstRecipeEditHref,
      };
    });

    if (!firstRecipeEditHref) {
      // No recipes — skip the rest. Still PASS the spec; it's diagnostic.
      // eslint-disable-next-line no-console
      console.info('[homemaker] No recipes; skipping recipe-edit checks.');
      // eslint-disable-next-line no-console
      console.info('[homemaker-findings]', JSON.stringify(findings, null, 2));
      return;
    }

    // -------------------------------------------------------------------
    // 5. Recipe edit — F1 cost card + H2 History button + H3 social row
    // -------------------------------------------------------------------
    await step('recipe-edit-page', async () => {
      await page.goto(firstRecipeEditHref, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      const costCard = page.locator('text=Estimated cost').first();
      const f1Visible = (await costCard.count()) > 0;

      const historyBtn = page.locator('button:has-text("History")').first();
      const h2Visible = (await historyBtn.count()) > 0;

      // H3 strip detection — look for a star icon ☆ or ★ inline near ingredients.
      // Both characters render; using regex via :has-text.
      const socialBtns = await page
        .locator('button[title*="star" i], button[title*="pin" i]')
        .count();
      const h3Visible = socialBtns > 0;

      findings.sections.recipe_edit = {
        f1_cost_card_visible: f1Visible,
        h2_history_btn_visible: h2Visible,
        h3_social_row_count: socialBtns,
        h3_social_visible: h3Visible,
      };
    });

    // -------------------------------------------------------------------
    // 6. H2 — open history modal (if button visible)
    // -------------------------------------------------------------------
    if (findings.sections.recipe_edit?.h2_history_btn_visible) {
      await step('h2-history-modal', async () => {
        const btn = page.locator('button:has-text("History")').first();
        await btn.click();
        await page.waitForTimeout(1200);
        // Modal heading "History — <recipe name>"
        const modalHeading = page.locator('text=/History\\s*[—-]/').first();
        const open = (await modalHeading.count()) > 0;
        // Look for any cost amount in the rev-header pattern: "v1 · N ingredients · RM 1.23"
        const versionLine = page.locator('text=/v\\d+\\s*·.*ingredients/').first();
        const hasVersionRow = (await versionLine.count()) > 0;
        const versionTextSample = hasVersionRow
          ? (await versionLine.textContent())?.slice(0, 200)
          : null;
        findings.sections.h2_modal = {
          modal_opened: open,
          revision_row_visible: hasVersionRow,
          first_row_text: versionTextSample,
        };
        // Close the modal so subsequent steps see a clean page
        const closeBtn = page.locator('button:has-text("Close")').first();
        if ((await closeBtn.count()) > 0) await closeBtn.click();
        await page.waitForTimeout(400);
      });
    }

    // -------------------------------------------------------------------
    // 7. H3 — try clicking the first star (if visible)
    // -------------------------------------------------------------------
    if (findings.sections.recipe_edit?.h3_social_visible) {
      await step('h3-star-click', async () => {
        const starBtn = page
          .locator('button[title*="star" i]')
          .first();
        const before = (await starBtn.textContent()) || '';
        await starBtn.click();
        await page.waitForTimeout(800);
        const after = (await starBtn.textContent()) || '';
        findings.sections.h3_star_click = {
          before_text: before.trim(),
          after_text: after.trim(),
          changed: before !== after,
        };
        // Click again to revert (idempotent — leave state clean)
        await starBtn.click();
        await page.waitForTimeout(400);
      });
    }

    // eslint-disable-next-line no-console
    console.info('[homemaker-findings]', JSON.stringify(findings, null, 2));
  },
};
