/**
 * Shared constants, the error-gated `test` fixture, and panel helpers for the
 * Astro example's browser suite.
 *
 * Every spec imports `test` / `expect` from here, not from `@playwright/test`,
 * so the auto `diagnostics` fixture runs on every page of every test: any
 * console error, uncaught page error, failed request, or HTTP >= 400 response
 * on any visited route fails that test.
 */

import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export { expect };

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const TOKENS_PATH = resolve(REPO_ROOT, 'src', 'styles', 'tokens.css');
export const ASTRO_ORIGIN = 'http://localhost:44324';
export const SIDECAR_ORIGIN = 'http://127.0.0.1:24682';
export const HOME_TITLE = 'Astro Example — Design Token Panel';

// The panel derives its root id from `storagePrefix` in src/config/panel-config.ts.
export const PANEL_ROOT_ID = 'astro-example-tokens-root';
export const STORAGE_PREFIX = 'astro-example-tokens';

export const test = base.extend<{ diagnostics: string[] }>({
  diagnostics: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') {
          problems.push(`console.error: ${message.text()} (${message.location().url})`);
        }
      });
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
      page.on('requestfailed', (request) => {
        // Astro's hover prefetch is speculative: when the click's ClientRouter
        // navigation overtakes it, Chromium cancels the pending prefetch
        // (ERR_ABORTED). That cancellation is not a failed asset; a prefetch
        // that fails any other way, or answers >= 400, is still reported.
        if (
          request.headers()['sec-purpose']?.startsWith('prefetch') &&
          request.failure()?.errorText === 'net::ERR_ABORTED'
        ) {
          return;
        }
        problems.push(
          `requestfailed: ${request.method()} ${request.url()} [${request.resourceType()}` +
            `${request.headers()['sec-purpose'] ? `, sec-purpose=${request.headers()['sec-purpose']}` : ''}]` +
            ` — ${request.failure()?.errorText}`,
        );
      });
      page.on('response', (response) => {
        if (response.status() >= 400) {
          problems.push(`HTTP ${response.status()}: ${response.request().method()} ${response.url()}`);
        }
      });
      await use(problems);
      expect(problems, 'console errors, page errors and failed requests').toEqual([]);
    },
    { auto: true },
  ],
});

export function panelShell(page: Page): Locator {
  return page.locator('.tokenpanel-shell');
}

/** The host's own header trigger (AppLayout topbar), not the console API. */
export async function toggleViaHeader(page: Page): Promise<void> {
  await page.getByRole('banner').getByRole('button', { name: 'Open Design Token Panel' }).click();
}

export async function openViaHeader(page: Page): Promise<void> {
  await expect(panelShell(page)).toHaveCount(0);
  await toggleViaHeader(page);
  await expect(panelShell(page)).toBeVisible();
}

export async function closeViaHeader(page: Page): Promise<void> {
  await expect(panelShell(page)).toBeVisible();
  await toggleViaHeader(page);
  await expect(panelShell(page)).toHaveCount(0);
}

/** Client-router navigation through the sidenav (never `page.goto`). */
export async function navigateViaSidenav(page: Page, label: string, path: RegExp): Promise<void> {
  await page.getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: label, exact: true })
    .click();
  await expect(page).toHaveURL(path);
  await expect(page.locator('.astro-sidenav-link.is-active')).toHaveText(label);
}

/**
 * Exactly one panel instance: one panel root, one set of the panel's
 * document-level mounts, and at most one shell.
 */
export async function expectSinglePanelInstance(page: Page, shellCount: 0 | 1): Promise<void> {
  await expect(page.locator(`[id="${PANEL_ROOT_ID}"]`)).toHaveCount(1);
  await expect(page.locator('script#tokenpanel-config')).toHaveCount(1);
  for (const mount of ['highlight', 'elpath', 'element-inspect', 'domtweaker']) {
    await expect(page.locator(`[id="tokenpanel-${mount}-mount"]`)).toHaveCount(1);
  }
  await expect(panelShell(page)).toHaveCount(shellCount);
}

/**
 * Header actions collapse behind the "Panel actions" kebab when the shell is
 * narrower than the header's container query (zdtp recipe "Reaching a header
 * action in any layout", pattern B).
 */
export async function clickHeaderAction(
  page: Page,
  id: 'export' | 'import' | 'apply' | 'reset',
): Promise<void> {
  const shell = panelShell(page);
  const action = shell.locator(`[data-zdtp-action="${id}"]:visible`);
  if ((await action.count()) === 0) {
    await shell.getByRole('button', { name: 'Panel actions', exact: true }).click();
  }
  await action.click();
}

/** Opens a panel tab and fills a length token's numeric input. */
export async function setLengthToken(
  page: Page,
  tab: RegExp,
  cssVar: string,
  numericValue: string,
): Promise<void> {
  await panelShell(page).getByRole('tab', { name: tab }).click();
  const input = panelShell(page).getByRole('textbox', { name: `${cssVar} value`, exact: true });
  await input.fill(numericValue);
  await input.press('Tab');
}

export function rootTokenValue(page: Page, cssVar: string): Promise<string> {
  return page.evaluate(
    (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    cssVar,
  );
}
