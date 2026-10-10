# zudo-design-token-panel-example-astro

A minimal Astro 6 + Preact app demonstrating `@takazudo/zdtp` — host-config-driven panel with live token tweaking and a full apply-pipeline round-trip via the bin sidecar (`zdtp-server`).

Live: https://zdtp-astro.zudolab.dev/

## Dependency on the panel package

The panel is consumed as a published npm package — `@takazudo/zdtp`, pinned to an exact version in `package.json`. There is no sibling checkout, no `file:` specifier, and no upstream build step, so a fresh clone needs nothing but:

```bash
pnpm install
```

That is what CI does too (`pnpm install --frozen-lockfile`), which is why the pin and `pnpm-lock.yaml` must always agree.

Upstream sources live at [Takazudo/zudo-design-token-panel](https://github.com/Takazudo/zudo-design-token-panel), but this repo never builds them — it only installs the published artifact.

## Local dev commands

| Command | Description |
|---|---|
| `pnpm dev` | Start Astro (port 44324) + bin sidecar (port 24682) |
| `pnpm build` | Static build into `dist/` |
| `pnpm preview` | Preview the static build locally |
| `pnpm typecheck` | Run `astro check` |
| `pnpm test:e2e` | Playwright browser suite (starts Astro + the bin sidecar itself; reuses them locally if already running) |
| `pnpm test:apply-smoke` | Non-UI smoke test for the apply pipeline (requires `pnpm dev` running) |

`pnpm dev` runs two processes via `concurrently`:

| process | port  | role |
| ------- | ----- | ---- |
| Astro   | 44324 | the example site |
| bin     | 24682 | `zdtp-server` — receives `/apply` POSTs, rewrites `tokens.css` |

The Astro dev server proxies `/api/dev/apply` to the bin (see `astro.config.ts`), so the panel POSTs to a same-origin URL — no CORS preflight, no hardcoded port in the runtime config.

Open http://localhost:44324 and click **Open Design Token Panel** in the topbar (or run `window.astro.toggleDesignPanel()` in the browser console). Drag any slider — the page repaints before the next frame.

## Apply-pipeline smoke check

For a non-interactive smoke check that bypasses the panel UI and POSTs directly to the bin:

```bash
pnpm test:apply-smoke
```

Requires `pnpm dev` to be running first.

## Browser suite and CI

`tests/e2e/` drives the panel through its real UI against the real dev topology: the Playwright `webServer` starts `_dev:astro` and `_dev:tokens-bin` (the two halves of `pnpm dev`), and `tests/e2e/global-setup.ts` checks that the sidecar is this checkout's before any spec runs. Coverage:

- **Apply round-trip** — edit `--astro-radius` in the panel, Apply, and assert `src/styles/tokens.css` changed by exactly that line; the original bytes are restored and verified byte-for-byte after the test, pass or fail.
- **ClientRouter navigation** — sidenav navigation and back/forward keep the same document (a `window.__marker` survives) and exactly one panel instance.
- **Panel lifecycle** — open/close via the topbar trigger; visibility and token edits persist across navigation and reload.
- **Token edits** — font, spacing and color edits change the computed style of visible elements.
- **Errors** — every test fails on any console error, page error, or failed request.

CI (`.github/workflows/deploy.yml`) runs a blocking `browser` job on every pull request and on pushes to `main`. A change-detection step runs the suite for anything but content-only changes (`*.md` / `*.mdx` and files outside the source, test, config and CI trees); content-only changes log `skipped: content-only` and pass. The `preview` job skips draft pull requests.

## What the example proves

- The panel package consumes ZERO project-specific defaults from its own bundle. Every identifier (`storagePrefix`, `consoleNamespace`, `paletteCssVarTemplate`, semantic CSS-var names, etc.) flows in from `src/config/panel-config.ts`.
- The apply pipeline routes by CSS-var prefix family: the `astro` prefix in `scaffold.routing.json` maps to `src/styles/tokens.css`, so any tweak to an `--astro-*` token rewrites that file.
- Astro view-transitions preserve panel state across soft navigations — the host adapter listens for `astro:before-swap` / `astro:page-load` and re-materialises the shell when persisted overrides or visibility intent demand it.

## Routes

| Route | File | Description |
|---|---|---|
| `/` | `pages/index.astro` | Home — cards, buttons, palette swatches |
| `/prose/` | `pages/prose.astro` | Prose demo — MDX content inside `.astro-prose` |
| `/about/` | `pages/about.astro` | About this example |
| `/components/forms/` | `pages/components/forms.astro` | Form controls |
| `/components/status/` | `pages/components/status.astro` | Status surfaces |
| `/components/widgets/` | `pages/components/widgets.astro` | Widgets (tabs, accordion, modal, avatar) |
| `/components/data/` | `pages/components/data.astro` | Data table |

All routes are wrapped in `AppLayout.astro`, which provides a topbar and sidenav with links to all pages above.

## Layout

```
zudo-design-token-panel-example-astro/
├── astro.config.ts             # Astro + preact + /api/dev/apply proxy
├── package.json                # dev = astro + bin sidecar
├── playwright.config.ts        # browser suite: Astro + sidecar webServers
├── scaffold.routing.json       # CSS-var prefix → file map (shared by panel + bin)
├── scripts/
│   ├── browser-relevant-changes.sh  # CI change detection for the browser job
│   └── smoke-apply.mjs         # non-UI smoke harness for the bin
├── src/
│   ├── components/
│   │   └── Sidenav.astro       # sidenav with links to all 7 routes
│   ├── config/
│   │   ├── default-cluster.ts  # --astro-* color cluster
│   │   ├── default-manifest.ts # --astro-* token rows
│   │   └── panel-config.ts     # PanelConfig assembly
│   ├── layouts/
│   │   ├── Layout.astro        # document shell: ClientRouter + DesignTokenPanelHost
│   │   └── AppLayout.astro     # app shell: topbar + sidenav + main slot
│   ├── pages/
│   │   ├── index.astro
│   │   ├── about.astro
│   │   ├── prose.astro
│   │   └── components/
│   │       ├── forms.astro
│   │       ├── status.astro
│   │       ├── widgets.astro
│   │       └── data.astro
│   └── styles/
│       ├── reset.css
│       ├── tokens.css          # --astro-* source of truth (apply target)
│       └── components.css      # frozen host-class vocabulary
├── tests/
│   └── e2e/
│       ├── global-setup.ts     # proves the right server + sidecar are up
│       ├── support.ts          # error-gated `test` fixture + panel helpers
│       ├── apply-roundtrip.spec.ts
│       ├── navigation-lifecycle.spec.ts
│       ├── token-tweak-style.spec.ts
│       ├── highlight.spec.ts
│       └── routes-smoke.spec.ts
└── tsconfig.json
```

<!-- proof: content-only change for the browser job skip path -->
