/**
 * "Change a token in the panel → a visible element's computed style updates."
 *
 * One representative consumer per token category, all on `/`:
 *   - font scale   `--astro-scale-xl` → `.astro-page-title` font-size
 *                  (via `--astro-text-page-title: var(--astro-scale-xl)`)
 *   - spacing      `--astro-vsp-md`   → `.astro-card` padding-top
 *   - color        `--astro-palette-1` → palette swatch #1 background
 *
 * Each test gets a fresh browser context, so no panel state leaks between
 * tests; nothing here touches the apply sidecar or the file on disk.
 */

import { expect, openViaHeader, panelShell, setLengthToken, test } from './support';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openViaHeader(page);
});

test('font scale: --astro-scale-xl resizes the page title', async ({ page }) => {
  const title = page.locator('.astro-page-title');
  await expect(title).toHaveCSS('font-size', '28px');

  await setLengthToken(page, /^font$/i, '--astro-scale-xl', '2.5');

  await expect(title).toHaveCSS('font-size', '40px');
});

test('spacing: --astro-vsp-md changes card padding', async ({ page }) => {
  const card = page.locator('.astro-card').first();
  await expect(card).toHaveCSS('padding-top', '16px');

  await setLengthToken(page, /^spacing$/i, '--astro-vsp-md', '2');

  await expect(card).toHaveCSS('padding-top', '32px');
});

test('color: --astro-palette-1 repaints palette swatch #1', async ({ page }) => {
  const swatch = page.locator('.astro-swatch').nth(1);
  await expect(swatch).toHaveCSS('background-color', 'rgb(45, 108, 223)');

  const shell = panelShell(page);
  await shell.getByRole('tab', { name: /^color$/i }).click();
  await shell.locator('[aria-label^="--astro-palette-1:"]').click();
  const hexInput = page.locator('.tokenpanel-color-picker-hex-input');
  await hexInput.fill('#ff0000');
  await hexInput.press('Enter');

  await expect(swatch).toHaveCSS('background-color', 'rgb(255, 0, 0)');
});
