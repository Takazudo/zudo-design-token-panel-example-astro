/**
 * Routes-smoke spec for the Astro example.
 *
 * Visits every route (full loads via `page.goto`) and asserts:
 *   1. The page-level heading (.astro-page-title) is visible.
 *   2. (widgets only) Each of the three tabs can be clicked and the active
 *      tab class moves to the clicked tab.
 *   3. (data only) All 5 data-component class selectors are present on the page.
 *
 * The `diagnostics` fixture from ./support additionally fails a route on any
 * console error, page error, or failed request.
 *
 * Route inventory (all 7 routes):
 *   /                   → Home
 *   /about              → About
 *   /prose              → Prose typography demo
 *   /components/forms   → Form controls demo
 *   /components/status  → Status badges / indicators
 *   /components/widgets → Interactive widgets (tabs assertion)
 *   /components/data    → Data components (data-component assertion)
 */

import { expect, test } from './support';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Routes with a standard .astro-page-title heading.
 * Prose is handled separately because the prose layout uses .astro-prose, not
 * .astro-page-title (MDX content is wrapped without an extra heading div).
 */
const PAGE_TITLE_ROUTES = [
  { label: 'Home',    path: '/',                      heading: /live token tweaking/i        },
  { label: 'About',   path: '/about',                 heading: /about this example/i         },
  { label: 'Forms',   path: '/components/forms',      heading: /form controls/i              },
  { label: 'Status',  path: '/components/status',     heading: /status/i                     },
  { label: 'Widgets', path: '/components/widgets',    heading: /widgets/i                    },
  { label: 'Data',    path: '/components/data',       heading: /data.*demo|data components/i },
] as const;

// ---------------------------------------------------------------------------
// Route navigation + heading assertions
// ---------------------------------------------------------------------------

test.describe('Astro example — routes smoke', () => {
  for (const route of PAGE_TITLE_ROUTES) {
    test(`${route.label} route: page heading is visible`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('domcontentloaded');

      // .astro-page-title is the framework-prefixed heading class used on all
      // standard Astro example pages (div with class astro-page-title).
      const heading = page.locator('.astro-page-title').first();
      await expect(heading).toBeVisible({ timeout: 10_000 });
      await expect(heading).toHaveText(route.heading);
    });
  }

  // Prose page uses .astro-prose layout wrapper — no .astro-page-title.
  // The MDX content renders inside .astro-prose; assert the wrapper is present.
  test('Prose route: .astro-prose container is visible', async ({ page }) => {
    await page.goto('/prose');
    await page.waitForLoadState('domcontentloaded');
    const proseContainer = page.locator('.astro-prose').first();
    await expect(proseContainer).toBeVisible({ timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // Widgets page — tab-switching assertion
  // -------------------------------------------------------------------------

  test('Widgets route: clicking each tab moves the active class', async ({ page }) => {
    await page.goto('/components/widgets');
    await page.waitForLoadState('domcontentloaded');

    // The Astro tabs component renders .astro-tabs__tab elements with the
    // .is-active modifier on the currently-active tab.  Wait for the tabs
    // container to appear before interacting.
    const tabsContainer = page.locator('.astro-tabs').first();
    await tabsContainer.waitFor({ state: 'visible', timeout: 10_000 });

    const tabs = tabsContainer.locator('.astro-tabs__tab');
    await expect(tabs).toHaveCount(3, { timeout: 5_000 });

    // Tab 0 is active by default.
    await expect(tabs.nth(0)).toHaveClass(/is-active/);

    // Click tab 1 (Details) and assert active class moves.
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveClass(/is-active/);
    await expect(tabs.nth(0)).not.toHaveClass(/is-active/);

    // Click tab 2 (Settings) and assert active class moves.
    await tabs.nth(2).click();
    await expect(tabs.nth(2)).toHaveClass(/is-active/);
    await expect(tabs.nth(1)).not.toHaveClass(/is-active/);
  });

  // -------------------------------------------------------------------------
  // Data page — 5-component presence assertion
  //
  // The Astro data components don't all have unique BEM root classes; instead
  // we assert the distinct vocabulary classes that each component introduces:
  //   StatCard    → .astro-stat-value  (unique — not used elsewhere on the page)
  //   AvatarRow   → .astro-avatar.is-sm
  //   ProfileCard → .astro-avatar.is-md
  //   .astro-card is the shared root of StatCard (x3), ProfileCard (x2) and
  //   MediaCard (x1), so the page renders exactly 6 of them.
  //   DataTable   → .astro-table       (unique — only used for DataTable)
  // -------------------------------------------------------------------------

  test('Data route: all 5 data-component selectors are present', async ({ page }) => {
    await page.goto('/components/data');
    await page.waitForLoadState('domcontentloaded');

    // StatCard: uses .astro-stat-value for the metric number
    await expect(page.locator('.astro-stat-value').first()).toBeVisible({ timeout: 10_000 });

    // AvatarRow: small avatars with .is-sm modifier
    await expect(page.locator('.astro-avatar.is-sm').first()).toBeAttached({ timeout: 5_000 });

    // ProfileCard: medium avatars with .is-md modifier
    await expect(page.locator('.astro-avatar.is-md').first()).toBeAttached({ timeout: 5_000 });

    // 3 StatCards + 2 ProfileCards + 1 MediaCard
    await expect(page.locator('.astro-card')).toHaveCount(6);

    // DataTable: wraps the table in .astro-table
    await expect(page.locator('.astro-table').first()).toBeVisible({ timeout: 5_000 });
  });
});
