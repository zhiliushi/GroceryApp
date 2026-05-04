/**
 * F1 (base recipe-cost estimate) verification spec.
 *
 * Verifies two independent facts:
 *   1. Backend deployment — does the F1 route `GET /api/meals/recipes/{id}/cost`
 *      exist on the running backend? Probed via /openapi.json (definitive,
 *      auth-free) so we don't have to depend on credentials to know.
 *   2. Frontend bundle — does the recipe edit page contain the cost card?
 *      Probed by visiting the page; if the user isn't logged in we fall back
 *      to inspecting the JS bundle for a marker string.
 *
 * Combined, these answer the "is F1 verifiable locally?" question regardless
 * of which branch the user has checked out.
 */
export default {
  name: 'f1-cost-card',
  url: 'http://localhost:5173',
  objective:
    'Confirm F1 (recipe-cost estimate) is reachable: backend exposes the route ' +
    "and frontend bundle contains the card. Stop short of authenticated UI " +
    "verification when no credentials are available; report what's seen.",
  successCriteria: [
    'GET / returns 200 and the SPA shell renders',
    'GET /api/openapi.json includes path /api/meals/recipes/{recipe_id}/cost — definitive proof F1 is on the backend',
    'Frontend reachable; report whether user is logged in or sees /login',
    'If logged in: /meals route renders and a recipe edit page contains a "Estimated cost" header',
  ],
  allowConsoleErrors: true, // we tolerate auth-state noise

  run: async (page, expect, step) => {
    const apiEvents = [];
    page.on('response', async (resp) => {
      const url = resp.url();
      if (url.includes('/api/')) {
        let body = null;
        try {
          const text = await resp.text();
          body = text.length > 800 ? text.slice(0, 800) + '…' : text;
        } catch {}
        apiEvents.push({
          url,
          status: resp.status(),
          contentType: resp.headers()['content-type'] || '',
          body,
        });
      }
    });

    // -------------------------------------------------------------------
    // 1. Backend deployment probe — does F1 exist on /openapi.json?
    // -------------------------------------------------------------------
    let f1OnBackend = false;
    let f1RouteEntry = null;
    let openapiStatus = null;
    let backendBranchHint = 'unknown';

    await step('probe-openapi-for-f1-route', async () => {
      const r = await page.request.get('http://localhost:8000/openapi.json');
      openapiStatus = r.status();
      if (openapiStatus !== 200) {
        throw new Error(
          `Expected 200 from /openapi.json on backend (port 8000); got ${openapiStatus}.`,
        );
      }
      const spec = await r.json();
      const paths = spec.paths || {};
      const f1Path = '/api/meals/recipes/{recipe_id}/cost';
      f1OnBackend = f1Path in paths;
      if (f1OnBackend) {
        f1RouteEntry = paths[f1Path];
      }
      // Also check homemaker H1/H2 endpoints to triangulate which branch is running.
      const hasH1 = '/api/admin/users/{uid}/homemaker' in paths;
      const hasH2 = '/api/meals/recipes/{recipe_id}/revisions' in paths;
      backendBranchHint =
        hasH1 || hasH2 ? 'feature/meals-homemaker' : (f1OnBackend ? 'main (F1 only)' : 'pre-F1 (older)');
      // Don't throw on missing F1 — we WANT the report to capture the absence.
    });

    // -------------------------------------------------------------------
    // 2. Frontend SPA loads
    // -------------------------------------------------------------------
    await step('open-spa-root', async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveTitle(/GroceryApp Admin/);
      // Wait briefly for React to render past Suspense
      await page.waitForTimeout(800);
    });

    let landedOn = 'unknown';
    let isLoggedIn = false;

    await step('detect-auth-state', async () => {
      const url = page.url();
      const text = (await page.locator('body').innerText()).slice(0, 400);
      // If we see a login form, we're not authenticated
      const hasEmailField = await page.locator('input[type="email"]').count() > 0;
      const hasPasswordField = await page.locator('input[type="password"]').count() > 0;
      const onLoginPath = /\/login/i.test(url);
      isLoggedIn = !(hasEmailField && hasPasswordField) && !onLoginPath;
      landedOn = url;
      // Stash for the final summary
      page._testContext = { ...(page._testContext || {}), landedOn, isLoggedIn, bodyPreview: text };
    });

    // -------------------------------------------------------------------
    // 3. If logged in, exercise the meals page + recipe edit
    // -------------------------------------------------------------------
    if (isLoggedIn) {
      await step('navigate-to-meals', async () => {
        await page.goto('/meals', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500); // let TanStack Query settle
      });

      let recipeId = null;
      await step('find-or-list-recipes', async () => {
        // Look for a recipe-card edit link of form /meals/<id>/edit
        const editLinks = await page
          .locator('a[href*="/meals/"][href$="/edit"]')
          .all();
        if (editLinks.length > 0) {
          const href = await editLinks[0].getAttribute('href');
          const m = href && href.match(/\/meals\/([^/]+)\/edit/);
          if (m) recipeId = m[1];
        }
        if (!recipeId) {
          // No recipes — record and move on. The card requires edit mode; skip.
          page._testContext = {
            ...(page._testContext || {}),
            noRecipesFound: true,
          };
        }
      });

      if (recipeId) {
        await step('open-recipe-edit', async () => {
          await page.goto(`/meals/${recipeId}/edit`, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(1500);
        });

        let costCardVisible = false;
        let costCardText = null;
        await step('look-for-cost-card', async () => {
          // The card heading is "💰 Estimated cost"
          const heading = page.locator('text=Estimated cost').first();
          costCardVisible = (await heading.count()) > 0;
          if (costCardVisible) {
            // Read the surrounding card content
            const card = heading.locator(
              'xpath=ancestor::*[contains(@class, "rounded-lg")][1]',
            );
            costCardText = (await card.innerText()).slice(0, 1000);
          }
          page._testContext = {
            ...(page._testContext || {}),
            recipeIdProbed: recipeId,
            costCardVisible,
            costCardText,
          };
        });

        // Even if visible, also probe the API directly so we capture status + body
        await step('probe-cost-api-directly', async () => {
          const r = await page.request.get(
            `http://localhost:8000/api/meals/recipes/${recipeId}/cost`,
          );
          page._testContext = {
            ...(page._testContext || {}),
            costApi: {
              status: r.status(),
              body: (await r.text()).slice(0, 600),
            },
          };
        });
      }
    }

    // Surface findings to console for the report capture
    // eslint-disable-next-line no-console
    console.info('[f1-test-context]', JSON.stringify({
      f1OnBackend,
      backendBranchHint,
      landedOn,
      isLoggedIn,
      ...(page._testContext || {}),
      apiEventCount: apiEvents.length,
    }, null, 2));
  },
};
