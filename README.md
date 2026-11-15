# Christopher Tapia — Portfolio

Personal CV/portfolio site: Astro 7 (static), Tailwind 4 tokens, Svelte islands, MDX case
studies, Ghost-shaped content facade running in seed mode. Normative docs: `plan.md`
(execution), `DESIGN.md` (design system), `PROMPT.md` (requirements/voice).

## Requirements

- Node **>= 22.23.4** (Astro 7 floor). Pinned in `.nvmrc`, `package.json#engines`, CI, and
  Vercel (`NODE_VERSION`).
- pnpm (committed `pnpm-lock.yaml`); TypeScript 6 pinned.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Astro dev server |
| `pnpm build` | `astro check` + `svelte-check` + `astro build` + `pagefind --site dist` (no Chromium: the CV PDF is a separate CI step) |
| `pnpm pdf` | Render `dist/cv/tapia-resume.pdf` with Chromium — CI-only after `pnpm build` (Vercel has no browsers) |
| `pnpm preview` | Serve `dist/` (Playwright's `webServer`) |
| `pnpm lint` | ESLint (flat config) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest (unit) |
| `pnpm test:e2e` | Playwright: chromium, `no-js`, `axe` projects |
| `pnpm check:tokens` | DESIGN.md ↔ `src/styles/global.css` computed token parity |
| `pnpm check:js-budget` | G6 artifact JS budgets against `dist/` (gzip) |
| `pnpm check:links` | DOM link + anchor check over `dist/` |
| `pnpm lhci` | Lighthouse CI mobile budgets (needs `CHROME_PATH`, see below) |
| `pnpm drill:rollback` | Read-only rollback drill preflight (`docs/backups.md` §2.6) |

Restore and rollback runbook: [`docs/backups.md`](docs/backups.md) — §1.1 seed-period restore
(git is the backup), §2 launch rollback drill, §3.4 post-cutover monthly restore drill.

### Performance measurement (G6)

`lighthouserc.json` fixes the mobile profile (412×823, simulated 1.5 Mbps / 150 ms RTT, 4× CPU),
runs `/`, `/work`, `/blog` three times each, and asserts the **median** run against
**LCP ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 200 ms**. Every measured URL carries `?measure=1`: the inline
script in `src/layouts/BaseLayout.astro` switches the vendored element to its documented
`intro="off"` mode before the bridge imports it, so the intro overlay never becomes the measured
LCP. Visitors without the parameter (and without `sessionStorage.wormhole:measure=1`) still get
the pinned `intro="once"`. The vendored files are untouched.

```bash
pnpm build
CHROME_PATH="$(node --input-type=module -e "import { chromium } from 'playwright'; console.log(chromium.executablePath())")" pnpm lhci
pnpm check:js-budget -- --verbose   # per-asset gzip table, initial/effect/total budgets
```

Artifact budgets (plan §4.6): initial route JS ≤ 60 KB gzip excluding the lazy effect, effect +
three.js ≤ 220 KB gzip, total ≤ 300 KB gzip (1 KB = 1024 B; Pagefind's runtime measured
separately and excluded).

## Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `SITE_URL` | from Phase 0 (Lane 0B) | Canonical origin. `astro.config.mjs` falls back to `http://localhost:4321` for local `dev` only: a CI/Vercel build that resolves a local origin **throws** (CI falls back to `https://ci.invalid` for artifacts it never deploys)
| `CONTACT_ENDPOINT` | when the contact function is provisioned (Lane 0B) | First-party endpoint (D12); no form ships before it exists |
| `GHOST_URL`, `GHOST_CONTENT_API_KEY` | **dormant until Phase G** | Seed mode (D13) is the v1 content source |
| `VERCEL_DEPLOY_HOOK_URL` | **dormant until Phase G** | Vercel-side secret only; never committed |

## Redirects

`vercel.json` is the only redirect source of truth. The single legacy move is
`/projects → /work` (301). `/`, `/about`, `/contact` are retained at the same paths. The
pre-deletion inventory lives in `redirects.csv`.

## Repository layout

Request lifecycle, directory map and the G0–G6 gate table: [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Structure notes

- Dark is canonical and server-rendered: `<html class="dark">`; the guarded inline script
  in `src/layouts/BaseLayout.astro` resolves the tri-state preference (D2).
- Design tokens live in `src/styles/global.css` (`@theme` + `:root`/`.dark` bindings);
  `scripts/check-tokens.mjs` resolves computed values in Chromium and compares them to
  `DESIGN.md`.
