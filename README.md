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
| `pnpm build` | `astro check` + `svelte-check` + `astro build` + `pagefind --site dist` |
| `pnpm preview` | Serve `dist/` (Playwright's `webServer`) |
| `pnpm lint` | ESLint (flat config) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest (unit) |
| `pnpm test:e2e` | Playwright: chromium, `no-js`, `axe` projects |
| `pnpm check:tokens` | DESIGN.md ↔ `src/styles/global.css` computed token parity |

## Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `SITE_URL` | from Phase 0 (Lane 0B) | Canonical origin; `astro.config.mjs` falls back to `http://localhost:4321` for dev/CI |
| `CONTACT_ENDPOINT` | when the contact function is provisioned (Lane 0B) | First-party endpoint (D12); no form ships before it exists |
| `GHOST_URL`, `GHOST_CONTENT_API_KEY` | **dormant until Phase G** | Seed mode (D13) is the v1 content source |
| `VERCEL_DEPLOY_HOOK_URL` | **dormant until Phase G** | Vercel-side secret only; never committed |

## Redirects

`vercel.json` is the only redirect source of truth. The single legacy move is
`/projects → /work` (301). `/`, `/about`, `/contact` are retained at the same paths. The
pre-deletion inventory lives in `redirects.csv`.

## Structure notes

- Dark is canonical and server-rendered: `<html class="dark">`; the guarded inline script
  in `src/layouts/BaseLayout.astro` resolves the tri-state preference (D2).
- Design tokens live in `src/styles/global.css` (`@theme` + `:root`/`.dark` bindings);
  `scripts/check-tokens.mjs` resolves computed values in Chromium and compares them to
  `DESIGN.md`.
