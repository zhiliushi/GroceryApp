/**
 * Preppers feature smoke test.
 *
 * Just confirms the page renders without runtime errors. Two valid
 * outcomes (both pass):
 *   - Global flag OFF / per-user toggle OFF → gated "Not available" page
 *   - Both ON → full page with sections
 *
 * Doesn't create any batches (no cleanup overhead). Auth via
 * Brave-profile-inheritance with --copy.
 */
export default {
  name: 'preppers-smoke',
  url: 'http://localhost:5173',
  objective:
    'Confirm /preppers page renders. Either gated or unlocked is fine; ' +
    'we just want to validate the route mounts and the page does not crash.',
  successCriteria: [
    'SPA loads logged-in',
    '/preppers renders some content (gated message OR real page)',
    'No console errors above usual Firebase noise',
    'Screenshot captured for visual review',
  ],
  allowConsoleErrors: true,

  run: async (page, expect, step) => {
    await step('open-spa-root', async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
    });

    await step('detect-auth', async () => {
      const url = page.url();
      const hasPwd = (await page.locator('input[type="password"]').count()) > 0;
      const onLogin = /\/login/i.test(url) || hasPwd;
      if (onLogin) throw new Error(`Not logged in — landed on ${url}`);
    });

    let pageText = '';
    let mode = 'unknown';
    await step('open-preppers', async () => {
      await page.goto('/preppers', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);

      // Wait for either the gated message OR the "Active batches" header
      const headerText = await page.locator('h1').first().innerText().catch(() => '');
      pageText = await page.locator('body').innerText();

      const isGated =
        pageText.toLowerCase().includes('not available') ||
        pageText.toLowerCase().includes('not enrolled') ||
        pageText.toLowerCase().includes('feature is currently off');
      const hasSections =
        pageText.toLowerCase().includes('active batches') ||
        pageText.toLowerCase().includes('common presets');

      mode = isGated ? 'gated' : hasSections ? 'unlocked' : 'unknown';

      page._testContext = {
        ...(page._testContext || {}),
        headerText: headerText.slice(0, 80),
        mode,
        snippet: pageText.slice(0, 600),
      };

      if (mode === 'unknown') {
        throw new Error(
          `/preppers rendered neither gated message nor sections.\n` +
          `Header: ${headerText}\nBody snippet: ${pageText.slice(0, 400)}`,
        );
      }
    });

    if (mode === 'unlocked') {
      await step('count-common-presets', async () => {
        const presetsToggle = page.locator('button:has-text("Common presets")').first();
        const presetsCount = await presetsToggle.count();
        if (presetsCount > 0) {
          await presetsToggle.click().catch(() => {});
          await page.waitForTimeout(500);
        }
        // Read the count from the parenthesized label after toggle
        const text = await page.locator('body').innerText();
        const match = text.match(/Common presets\s*\((\d+)\s*curated\)/i);
        page._testContext = {
          ...(page._testContext || {}),
          presetsCount: match ? parseInt(match[1]) : null,
        };
      });
    }

    // eslint-disable-next-line no-console
    console.info('[preppers-smoke]', JSON.stringify(page._testContext || {}, null, 2));
  },
};
