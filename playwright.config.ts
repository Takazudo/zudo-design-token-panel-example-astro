/**
 * Playwright config for the Astro example's browser suite.
 *
 * The suite always runs against the repo's real dev topology: the Astro dev
 * server (`_dev:astro`, port 44324) and the `zdtp-server` apply sidecar
 * (`_dev:tokens-bin`, port 24682) — the same two scripts `pnpm dev` composes.
 * Each is its own webServer entry so Playwright waits on both and fails the
 * run if either one does not come up. `global-setup.ts` then proves the
 * listeners are the right ones (sidecar writeRoot/routing, proxy wiring).
 *
 * On CI `reuseExistingServer` is off, so a stray listener on either port is a
 * hard failure instead of a silently reused foreign server.
 *
 * `workers: 1` + no parallelism: the apply spec rewrites
 * `src/styles/tokens.css` on disk, and every spec shares one dev server.
 */

import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

// Mirrors the ports in package.json `_dev:astro` / `_dev:tokens-bin`.
const ASTRO_ORIGIN = 'http://localhost:44324';
const SIDECAR_ORIGIN = 'http://127.0.0.1:24682';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: 0,
  workers: 1,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'html',
  timeout: isCI ? 60 * 1000 : 30 * 1000,
  use: {
    baseURL: ASTRO_ORIGIN,
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm run _dev:astro',
      url: `${ASTRO_ORIGIN}/`,
      reuseExistingServer: !isCI,
      timeout: 120 * 1000,
    },
    {
      command: 'pnpm run _dev:tokens-bin',
      url: `${SIDECAR_ORIGIN}/healthz`,
      reuseExistingServer: !isCI,
      timeout: 60 * 1000,
    },
  ],
});
