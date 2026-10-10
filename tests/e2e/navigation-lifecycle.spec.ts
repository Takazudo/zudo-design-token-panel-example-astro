/**
 * Astro ClientRouter navigation + panel ownership/lifecycle.
 *
 * Client-side swap proof: a `window.__marker` set before navigating survives
 * every sidenav click and browser back/forward. A full document load would
 * drop it, so `page.goto` is never used between routes here.
 *
 * Lifecycle: the panel is opened/closed only through the host's topbar
 * trigger, and after every navigation and toggle the page holds exactly one
 * panel root (plus one set of the panel's document-level mounts).
 */

import {
  closeViaHeader,
  expect,
  expectSinglePanelInstance,
  navigateViaSidenav,
  openViaHeader,
  panelShell,
  setLengthToken,
  test,
  toggleViaHeader,
} from './support';
import type { Page } from '@playwright/test';

const ROUTES = [
  { label: 'About', path: /\/about\/?$/ },
  { label: 'Forms', path: /\/components\/forms\/?$/ },
  { label: 'Widgets', path: /\/components\/widgets\/?$/ },
  { label: 'Data', path: /\/components\/data\/?$/ },
  { label: 'Home', path: /:44324\/$/ },
] as const;

type MarkedWindow = Window & { __marker?: number };

async function setMarker(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as MarkedWindow).__marker = 1;
  });
}

async function expectSameDocument(page: Page): Promise<void> {
  expect(await page.evaluate(() => (window as MarkedWindow).__marker)).toBe(1);
}

test('sidenav navigation and back/forward are client-side swaps that keep one open panel', async ({
  page,
}) => {
  await page.goto('/');
  await openViaHeader(page);
  await setMarker(page);

  await navigateViaSidenav(page, 'About', /\/about\/?$/);
  await expect(page.locator('.astro-page-title')).toHaveText('About this example');
  await expectSameDocument(page);
  await expectSinglePanelInstance(page, 1);
  await expect(panelShell(page)).toBeVisible();

  await navigateViaSidenav(page, 'Forms', /\/components\/forms\/?$/);
  await expect(page.locator('.astro-page-title')).toHaveText('Form controls demo');
  await expectSameDocument(page);
  await expectSinglePanelInstance(page, 1);

  await page.goBack();
  await expect(page).toHaveURL(/\/about\/?$/);
  await expect(page.locator('.astro-page-title')).toHaveText('About this example');
  await expectSameDocument(page);
  await expectSinglePanelInstance(page, 1);

  await page.goBack();
  await expect(page).toHaveURL(/:44324\/$/);
  await expect(page.locator('.astro-page-title')).toHaveText('Live token tweaking, in plain Astro');
  await expectSameDocument(page);
  await expectSinglePanelInstance(page, 1);

  await page.goForward();
  await expect(page).toHaveURL(/\/about\/?$/);
  await expect(page.locator('.astro-page-title')).toHaveText('About this example');
  await expectSameDocument(page);
  await expectSinglePanelInstance(page, 1);
  await expect(panelShell(page)).toBeVisible();
});

test('repeated open/close across navigation never duplicates the panel', async ({ page }) => {
  await page.goto('/');
  await openViaHeader(page);
  await setMarker(page);

  for (let round = 0; round < 2; round += 1) {
    for (const route of ROUTES) {
      await navigateViaSidenav(page, route.label, route.path);
      await expectSinglePanelInstance(page, 1);
      await closeViaHeader(page);
      await expectSinglePanelInstance(page, 0);
      await openViaHeader(page);
      await expectSinglePanelInstance(page, 1);
    }
  }
  await expectSameDocument(page);
});

test('panel visibility persists across navigation and reload', async ({ page }) => {
  await page.goto('/');
  await openViaHeader(page);

  await page.reload();
  await expect(panelShell(page)).toBeVisible();
  await expectSinglePanelInstance(page, 1);

  await closeViaHeader(page);
  await navigateViaSidenav(page, 'About', /\/about\/?$/);
  await expectSinglePanelInstance(page, 0);

  await page.reload();
  await expect(page.locator('.astro-page-title')).toHaveText('About this example');
  await expectSinglePanelInstance(page, 0);

  await toggleViaHeader(page);
  await expect(panelShell(page)).toBeVisible();
  await navigateViaSidenav(page, 'Home', /:44324\/$/);
  await expect(panelShell(page)).toBeVisible();
  await expectSinglePanelInstance(page, 1);
});

test('a token edit persists across client navigation and reload', async ({ page }) => {
  await page.goto('/');
  await openViaHeader(page);
  const card = page.locator('.astro-card').first();
  await expect(card).toHaveCSS('padding-top', '16px');

  await setLengthToken(page, /^spacing$/i, '--astro-vsp-md', '2');
  await expect(card).toHaveCSS('padding-top', '32px');

  await setMarker(page);
  await navigateViaSidenav(page, 'About', /\/about\/?$/);
  await expect(page.locator('.astro-card').first()).toHaveCSS('padding-top', '32px');
  await navigateViaSidenav(page, 'Home', /:44324\/$/);
  await expect(page.locator('.astro-card').first()).toHaveCSS('padding-top', '32px');
  await expectSameDocument(page);

  await page.reload();
  await expect(page.locator('.astro-card').first()).toHaveCSS('padding-top', '32px');
  await expectSinglePanelInstance(page, 1);
});
