/**
 * Proves the suite talks to THIS repo's server + sidecar before any spec runs.
 *
 * Playwright's webServer only waits for the two ports to answer. That would
 * also pass against a foreign process holding a port (locally, where reuse is
 * allowed), so this checks identity:
 *   - the sidecar's /healthz reports this checkout as writeRoot and
 *     scaffold.routing.json as its routing file;
 *   - the Astro server serves this example's home page;
 *   - the Vite proxy forwards /api/dev/apply to the sidecar (a CORS preflight
 *     answered 204 can only come from zdtp-server — Astro alone returns 404).
 * Any mismatch throws, which fails the whole run.
 */

import { realpathSync } from 'node:fs';
import { basename } from 'node:path';
import { ASTRO_ORIGIN, HOME_TITLE, REPO_ROOT, SIDECAR_ORIGIN } from './support';

export default async function globalSetup(): Promise<void> {
  const health = await fetch(`${SIDECAR_ORIGIN}/healthz`);
  if (!health.ok) throw new Error(`sidecar /healthz answered ${health.status}`);
  const info = (await health.json()) as { ok?: boolean; writeRoot?: string; routing?: string };
  if (info.ok !== true) throw new Error(`sidecar /healthz not ok: ${JSON.stringify(info)}`);
  if (!info.writeRoot || realpathSync(info.writeRoot) !== realpathSync(REPO_ROOT)) {
    throw new Error(`sidecar writeRoot ${info.writeRoot} is not this checkout (${REPO_ROOT})`);
  }
  if (!info.routing || basename(info.routing) !== 'scaffold.routing.json') {
    throw new Error(`sidecar routing ${info.routing} is not scaffold.routing.json`);
  }

  const home = await fetch(`${ASTRO_ORIGIN}/`);
  const html = await home.text();
  if (!home.ok || !html.includes(`<title>${HOME_TITLE}</title>`)) {
    throw new Error(`Astro server at ${ASTRO_ORIGIN} is not serving this example (${home.status})`);
  }

  const preflight = await fetch(`${ASTRO_ORIGIN}/api/dev/apply`, {
    method: 'OPTIONS',
    headers: {
      Origin: ASTRO_ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  if (preflight.status !== 204) {
    throw new Error(`/api/dev/apply proxy did not reach the sidecar (preflight ${preflight.status})`);
  }
}
