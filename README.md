# zudo-design-token-panel-example-astro

A minimal Astro 6 + Preact app demonstrating `@takazudo/zudo-design-token-panel` — host-config-driven panel with live token tweaking and a full apply-pipeline round-trip via the bin sidecar (`design-token-panel-server`).

Live: https://zdtp-astro.zudolab.dev/

## Sibling layout

This repo expects the panel package to live as a sibling directory:

```
$HOME/repos/zdtp-ex/
  zudo-design-token-panel/                       # upstream panel package (sibling)
  zudo-design-token-panel-example-astro/         # this repo
```

The `package.json` references the panel via `file:../zudo-design-token-panel/packages/zudo-design-token-panel`, so that sibling must exist and have its `dist/` built before you can install or build this consumer.

## Bootstrap (fresh machine)

IMPORTANT: `pnpm install` alone WILL FAIL on a fresh checkout because the `file:../zudo-design-token-panel` sibling is not yet present. Always bootstrap with:

```bash
pnpm setup:upstream
```

This script (`scripts/setup-upstream.mjs`):

1. Reads `PANEL_PINNED_SHA` from `.github/workflows/deploy.yml`.
2. Clones `https://github.com/Takazudo/zudo-design-token-panel.git` into `../zudo-design-token-panel/` (or fetches + checks out the pin if the sibling already exists and is clean).
3. Builds the panel package (`pnpm install --frozen-lockfile && pnpm -F @takazudo/zudo-design-token-panel build` inside the sibling).
4. Runs `pnpm install` in this consumer.
5. Runs `pnpm build` once to verify.

If the sibling already exists but has uncommitted changes, the script exits with an error pointing you at `/dev-wip-package-upstream-wt-dev` for the upstream-dev workflow.

## Local dev commands

| Command | Description |
|---|---|
| `pnpm dev` | Start Astro (port 44324) + bin sidecar (port 24682) |
| `pnpm build` | Static build into `dist/` |
| `pnpm preview` | Preview the static build locally |
| `pnpm typecheck` | Run `astro check` |
| `pnpm test:apply-smoke` | Non-UI smoke test for the apply pipeline (requires `pnpm dev` running) |

`pnpm dev` runs two processes via `concurrently`:

| process | port  | role |
| ------- | ----- | ---- |
| Astro   | 44324 | the example site |
| bin     | 24682 | `design-token-panel-server` — receives `/apply` POSTs, rewrites `tokens.css` |

The Astro dev server proxies `/api/dev/apply` to the bin (see `astro.config.ts`), so the panel POSTs to a same-origin URL — no CORS preflight, no hardcoded port in the runtime config.

Open http://localhost:44324 and run `window.astro.toggleDesignPanel()` in the browser console to show the panel. Drag any slider — the page repaints before the next frame.

## Apply-pipeline smoke check

For a non-interactive smoke check that bypasses the panel UI and POSTs directly to the bin:

```bash
pnpm test:apply-smoke
```

Requires `pnpm dev` to be running first.

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
├── playwright.config.ts        # apply-roundtrip e2e config
├── scaffold.routing.json       # CSS-var prefix → file map (shared by panel + bin)
├── scripts/
│   ├── setup-upstream.mjs      # bootstrap: clone/update panel sibling + build
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
│       └── apply-roundtrip.spec.ts
└── tsconfig.json
```
