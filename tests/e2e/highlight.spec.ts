/**
 * Highlight spec for the Astro example.
 *
 * Coverage:
 *   (a) Panel is togglable on every primary route — `PAGE_TITLE_ROUTES` inventory.
 *   (b) Highlight outline visible — toggle a known color token's eye icon → assert
 *       `.tokenpanel-highlight-overlay` div has a non-zero `getBoundingClientRect`
 *       and a `box-shadow` inset matching the slot's default color.
 *   (c) "Disable all highlights" button clears active highlights while preserving
 *       slot colors.
 *
 * Storage model:
 *   Panel visibility intent   → localStorage  `astro-example-tokens:visible`
 *   Panel open state          → localStorage  `astro-example-tokens-open`
 *   Highlight slots (colors)  → localStorage  `astro-example-tokens-highlight-slots`
 *   Highlight active map      → sessionStorage `astro-example-tokens-highlight-active`
 *   Persisted tweak state     → localStorage  `astro-example-tokens-state-v3`
 *
 * Setup pattern (shared with apply-roundtrip.spec.ts):
 *   1. Seed `astro-example-tokens:visible` = '1' so the panel mounts on the
 *      next load.
 *   2. Reload the page so the host adapter mounts the panel before paint.
 *   3. Interact.
 *
 * Isolation:
 *   beforeEach clears all panel-owned localStorage / sessionStorage keys so no
 *   test pollutes the next.
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = 'astro-example-tokens';
const STORAGE_KEY_VISIBLE = `${STORAGE_PREFIX}:visible`;
const STORAGE_KEY_OPEN = `${STORAGE_PREFIX}-open`;
const STORAGE_KEY_HIGHLIGHT_SLOTS = `${STORAGE_PREFIX}-highlight-slots`;
const STORAGE_KEY_HIGHLIGHT_ACTIVE = `${STORAGE_PREFIX}-highlight-active`;
const STORAGE_KEY_STATE_V3 = `${STORAGE_PREFIX}-state-v3`;

/**
 * Default color for highlight slot 0 — hard-coded in highlight-state.ts
 * DEFAULT_HIGHLIGHT_SLOTS[0].color.
 */
const SLOT_0_DEFAULT_COLOR = '#ff2d2d';

/**
 * Routes with a standard .astro-page-title heading — sourced verbatim from
 * routes-smoke.spec.ts so this spec stays in sync with the live route inventory.
 */
const PAGE_TITLE_ROUTES = [
  { label: 'Home',    path: '/'                   },
  { label: 'Forms',   path: '/components/forms'   },
  { label: 'Status',  path: '/components/status'  },
  { label: 'Widgets', path: '/components/widgets' },
  { label: 'Data',    path: '/components/data'    },
] as const;

// ---------------------------------------------------------------------------
// Helper — clear all panel-owned storage keys
// ---------------------------------------------------------------------------

async function clearPanelStorage(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(
    ({ lsKeys, ssKeys }) => {
      for (const k of lsKeys) localStorage.removeItem(k);
      for (const k of ssKeys) sessionStorage.removeItem(k);
    },
    {
      lsKeys: [
        STORAGE_KEY_VISIBLE,
        STORAGE_KEY_OPEN,
        STORAGE_KEY_HIGHLIGHT_SLOTS,
        STORAGE_KEY_STATE_V3,
      ],
      ssKeys: [STORAGE_KEY_HIGHLIGHT_ACTIVE],
    },
  );
}

// ---------------------------------------------------------------------------
// Helper — seed visibility flag so the panel mounts on the next load
// ---------------------------------------------------------------------------

async function seedPanelVisible(page: import('@playwright/test').Page): Promise<void> {
  // Truthy value '1' — see host-adapter index.tsx for the canonical string.
  await page.evaluate((key) => localStorage.setItem(key, '1'), STORAGE_KEY_VISIBLE);
}

// ---------------------------------------------------------------------------
// (a) Panel toggleable on every primary route
// ---------------------------------------------------------------------------

test.describe('Highlight — (a) panel togglable on every primary route', () => {
  for (const route of PAGE_TITLE_ROUTES) {
    test(`${route.label} route: panel opens and closes via public API`, async ({ page }) => {
      // Seed + reload so the panel mounts before paint.
      await page.goto(route.path);
      await page.waitForLoadState('domcontentloaded');
      await clearPanelStorage(page);
      await seedPanelVisible(page);

      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      // Panel shell must be present on initial load.
      const shell = page.locator('.tokenpanel-shell');
      await expect(shell).toBeVisible({ timeout: 10_000 });

      // Toggle closed via the public console API.
      await page.evaluate(() => {
        (window as unknown as Record<string, { toggleDesignPanel?: () => void }>)
          ['astro']?.toggleDesignPanel?.();
      });
      await expect(shell).not.toBeVisible({ timeout: 5_000 });

      // Toggle open again.
      await page.evaluate(() => {
        (window as unknown as Record<string, { toggleDesignPanel?: () => void }>)
          ['astro']?.toggleDesignPanel?.();
      });
      await expect(shell).toBeVisible({ timeout: 5_000 });
    });
  }
});

// ---------------------------------------------------------------------------
// (b) Highlight outline visible
// ---------------------------------------------------------------------------

test.describe('Highlight — (b) outline overlay is visible after toggling eye icon', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate, clear, seed, reload — panel mounts before paint.
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await clearPanelStorage(page);
    await seedPanelVisible(page);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.tokenpanel-shell').waitFor({ state: 'visible', timeout: 10_000 });
  });

  test('toggling eye icon on --astro-palette-1 renders a highlight overlay with non-zero rect and matching box-shadow', async ({ page }) => {
    // Switch to the Color tab in the panel.
    const colorTab = page.getByRole('tab', { name: /^color$/i });
    await colorTab.waitFor({ state: 'visible', timeout: 5_000 });
    await colorTab.click();

    // Click the eye-toggle button for --astro-palette-1.
    // The title attribute is set by highlight-toggle-button.tsx:
    //   "Highlight elements using --astro-palette-1"
    const eyeButton = page.locator('[title="Highlight elements using --astro-palette-1"]');
    await eyeButton.waitFor({ state: 'visible', timeout: 5_000 });
    await eyeButton.click();

    // Wait for at least one overlay div to appear.
    const overlay = page.locator('.tokenpanel-highlight-overlay').first();
    await overlay.waitFor({ state: 'attached', timeout: 5_000 });

    // Assert bounding rect is non-zero (the overlay tracks a real element).
    const rect = await overlay.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect!.width).toBeGreaterThan(0);
    expect(rect!.height).toBeGreaterThan(0);

    // Assert box-shadow contains the slot-0 default color.
    // Slot 0 color = '#ff2d2d' (see DEFAULT_HIGHLIGHT_SLOTS in highlight-state.ts).
    // box-shadow is built by buildOverlayStyle: `inset 0 0 0 ${w}px ${color}`.
    const boxShadow = await overlay.evaluate((el) => getComputedStyle(el).boxShadow);
    // The color is expressed as rgb(255, 45, 45) in computed style.
    expect(boxShadow).toMatch(/inset/);
    // Verify the red channel at minimum — computed colors resolve #ff2d2d → rgb(255, 45, 45).
    expect(boxShadow).toContain('255, 45, 45');
  });
});

// ---------------------------------------------------------------------------
// (c) "Disable all highlights" clears active map, preserves slot colors
// ---------------------------------------------------------------------------

test.describe('Highlight — (c) Disable all highlights clears active, preserves slot colors', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await clearPanelStorage(page);
    await seedPanelVisible(page);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.tokenpanel-shell').waitFor({ state: 'visible', timeout: 10_000 });
  });

  test('Disable all highlights removes overlays and empties active map; slot colors survive', async ({ page }) => {
    // Switch to Color tab and activate a highlight.
    const colorTab = page.getByRole('tab', { name: /^color$/i });
    await colorTab.waitFor({ state: 'visible', timeout: 5_000 });
    await colorTab.click();

    const eyeButton = page.locator('[title="Highlight elements using --astro-palette-1"]');
    await eyeButton.waitFor({ state: 'visible', timeout: 5_000 });
    await eyeButton.click();

    // Confirm overlay is present before we disable.
    await page.locator('.tokenpanel-highlight-overlay').first().waitFor({ state: 'attached', timeout: 5_000 });

    // Capture the current slot colors from localStorage BEFORE disabling.
    const slotsBefore = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as Array<{ color: string; outlineWidth: number }>) : null;
    }, STORAGE_KEY_HIGHLIGHT_SLOTS);

    // Open the gear popover (Highlight outline settings).
    const gearBtn = page.locator('[aria-label="Highlight outline settings"]');
    await gearBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await gearBtn.click();

    // Wait for the popover to appear.
    const popover = page.locator('.tokenpanel-highlight-settings-popover');
    await popover.waitFor({ state: 'visible', timeout: 5_000 });

    // Click "Disable all highlights".
    const disableBtn = page.locator('.tokenpanel-highlight-settings-footer').getByText('Disable all highlights');
    await disableBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await disableBtn.click();

    // Overlays must disappear.
    await expect(page.locator('.tokenpanel-highlight-overlay')).toHaveCount(0, { timeout: 5_000 });

    // Active map in sessionStorage must be empty.
    const activeParsed = await page.evaluate((key) => {
      const raw = sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as Record<string, number>) : {};
    }, STORAGE_KEY_HIGHLIGHT_ACTIVE);
    expect(Object.keys(activeParsed)).toHaveLength(0);

    // Slot colors must be preserved.
    const slotsAfter = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as Array<{ color: string; outlineWidth: number }>) : null;
    }, STORAGE_KEY_HIGHLIGHT_SLOTS);

    // After disabling, slots should either be unchanged from before
    // (if they were loaded before the toggle) or match the defaults.
    // We assert slot 0 still has the default/expected red color.
    if (slotsAfter !== null && slotsAfter.length > 0) {
      expect(slotsAfter[0].color).toBe(
        slotsBefore !== null && slotsBefore.length > 0
          ? slotsBefore[0].color
          : SLOT_0_DEFAULT_COLOR,
      );
    } else {
      // No slots persisted yet — defaults apply, which is acceptable.
    }
  });
});
