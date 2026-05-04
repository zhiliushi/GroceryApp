/**
 * One-shot cleanup of the leftover "[GAP1 TEST] autocomplete" recipe
 * if the previous spec's cleanup hit a rate-limit.
 */
export default {
  name: 'cleanup-gap1-leftover',
  url: 'http://localhost:5173',
  objective: 'Delete leftover [GAP1 TEST] recipe via the meals list UI',
  successCriteria: ['No leftover [GAP1 TEST] recipe remains'],
  allowConsoleErrors: true,
  run: async (page, expect, step) => {
    await step('go-to-meals', async () => {
      await page.goto('/meals', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('a[href="/meals/new"]', { timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(800);
    });

    await step('find-and-delete', async () => {
      const links = await page.locator('a[href*="/meals/"][href$="/edit"]').all();
      let target = null;
      for (const l of links) {
        const text = await l.innerText().catch(() => '');
        if (text.toLowerCase().includes('autocomplete') || text.toLowerCase().includes('gap1')) {
          const href = await l.getAttribute('href');
          const m = href && href.match(/\/meals\/([^/]+)\/edit/);
          if (m) { target = m[1]; break; }
        }
      }
      page._testContext = { ...(page._testContext || {}), foundId: target };
      if (!target) {
        return; // nothing to clean — fine
      }
      // Retry with brief delays in case of rate limit
      for (let attempt = 1; attempt <= 5; attempt++) {
        const r = await page.request.delete(`http://localhost:8000/api/meals/recipes/${target}`);
        if (r.status() === 200 || r.status() === 204) {
          page._testContext = { ...(page._testContext || {}), deleted: true, attempts: attempt };
          return;
        }
        await page.waitForTimeout(2000 * attempt);
      }
      throw new Error(`Failed to delete after retries`);
    });
  },
};
