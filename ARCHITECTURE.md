# Architecture

Orientation for a human or agent landing in this repository. It describes what the code
actually does today, not the intended end state. Normative documents stay authoritative:
[`plan.md`](plan.md) (execution + decisions D1–D13), [`DESIGN.md`](DESIGN.md) (design system),
[`PROMPT.md`](PROMPT.md) (requirements/voice), [`README.md`](README.md) (commands + env).

## Overview

A personal CV/portfolio site: **Astro 7 static output**, Tailwind 4 tokens, Svelte islands,
MDX case studies, and a Ghost-shaped content layer running in **seed mode** (D13). There is no
server at runtime and no database. Every route is pre-rendered; a deploy is a directory of HTML,
CSS, JS and static files served by Vercel.

- `astro.config.mjs` — `output: 'static'`, `trailingSlash: 'never'`, `build.format: 'directory'`,
  integrations `svelte()` + `mdx()` + `sitemap()`, Tailwind via `@tailwindcss/vite`. It also owns
  the `SITE_URL` deploy-origin guard, the build-id `define`s, and the `three` → `node_modules`
  alias (D6).
- `vercel.json` — the deploy contract: `framework: astro`, `buildCommand: pnpm build`,
  `outputDirectory: dist`, `NODE_VERSION`, and the **only** redirect (`/projects → /work`, 301).
- Node **22.23.4** is pinned in `.nvmrc`, `package.json#engines`, `.github/workflows/ci.yml`, and
  `vercel.json`. pnpm is the package manager (`pnpm-lock.yaml` is committed).

```sh
pnpm dev        # astro dev on http://localhost:4321
pnpm build      # astro check + svelte-check + astro build + pagefind --site dist
pnpm test       # vitest run (unit + vendor projects)
pnpm test:e2e   # playwright: chromium, wormhole, no-js, axe projects
pnpm preview    # serve dist/ (Playwright's webServer)
pnpm check:g1 | check:g3 | check:g4   # gate bundles, see the gate table below
```

The CV PDF is deliberately **not** part of `pnpm build`: rendering it needs Chromium, which the
Vercel build image lacks. CI runs `pnpm pdf` after the build.

## Request lifecycle

Astro resolves each page module at build time; every page renders once and ships as HTML.

1. **Layout.** `src/layouts/BaseLayout.astro` imports `src/styles/global.css`, renders
   `<html class="dark">` (dark is the server-rendered default, D2), and loads the vendored
   wormhole element. A guarded inline pre-paint script (lines ~142–156) removes `dark` only when
   `localStorage.theme === 'light'`; storage errors keep the canonical dark experience. The OS
   color-scheme no longer forces light (owner amendment 2026-11-15).
2. **Metadata.** `canonicalUrl(Astro.url.pathname)`, `buildOpenGraph()`, `buildTwitter()` and the
   JSON-LD builders all live in `src/lib/seo.ts`. Pages that omit `ogImage` get
   `public/brand/og-default.jpg`. JSON-LD is serialized only through `serializeJsonLd()`
   (`src/lib/seo.ts`) and injected with `set:html` (BaseLayout ~line 110) — never string-built by
   hand. `@vercel/analytics` renders only under `import.meta.env.PROD` (BaseLayout ~line 118), so
   `astro dev` stays a no-op. Feeds are linked via `feedLinkTags()` in `src/lib/series.ts`.
   `SITE_URL` is read from the environment; `astro.config.mjs` throws if a CI/Vercel build
   resolves a localhost origin, and CI falls back to `https://ci.invalid` (never deployed).
3. **The wormhole effect.** `src/vendor/wormhole/` is a bundled custom element; BaseLayout renders
   `<wormhole-bg fixed intro="once" look="storm" lightning="on" ambient-opacity="0.4"
   ambient-fps="30" no-font-link logo-text="CHRISTOPHER TAPIA">`. The site-side lifecycle is
   `src/lib/wormhole-bridge.ts`, imported by an island script at the end of `<body>`:
   - listeners for `wormhole:introstart` / `introend` / `ready` are attached **before** the
     element module is dynamically imported, because `introstart` can fire before hydration;
   - `introstart` moves the sound cluster out of `#site-shell` (`[data-wormhole-shell]`) and sets
     the shell `inert`; every end path — natural, skip, the 12 s site watchdog, no-event/module
     import failure, reduced motion — funnels through one idempotent `#finish()` that releases
     `inert` and returns the sound control to the header;
   - the effect loads in both themes; reduced motion skips the intro entirely; a runtime
     preference change never starts an intro late. Failures set
     `documentElement.dataset.wormholeFallback`.
   - `?measure=1` (or `sessionStorage['wormhole:measure'] === '1'`) flips the element to the
     vendor's documented `intro="off"` **before** import, so Lighthouse never measures the intro
     overlay as LCP. It is a site-side attribute change; the vendored copy is untouched.
   - Sound lives in `src/lib/sound.ts` (`createIntroSound`): one `<audio preload="none">` attached
     only at intro start, loudness via a `GainNode` only (0 → 0.4 over 2.5 s, 0.4 → 0 over 2 s),
     and a rejected `play()` is reported so the UI can persist `sound=off` and say so.
     `src/components/features/SoundToggle.astro` owns the control (`data-sound-cluster`,
     `data-wormhole-control`) and the visible music credit.
4. **Case studies.** `src/pages/work/[slug].astro` builds `getStaticPaths()` from the `work`
   collection, filtering `draft`. `src/layouts/CaseStudyLayout.astro` renders brand chip, logo,
   role/period, chapters and the visible stack (`hidden: true` entries never render), plus
   Article + Breadcrumb JSON-LD. `/work` lists the same collection with `ProjectCard`.
5. **Content data.** Two sources, one shape:
   - `src/data/cv.ts` is the canonical CV data. `/cv` renders it and CI renders the PDF from it;
     neither may hard-code a second copy.
   - `src/content.config.ts` defines three collections: `seed` (Glob over
     `src/content/seed/<series-slug>/*.md`, requiring an explicit kebab-case `slug` and a
     `draft` flag), `work` (MDX under `src/content/work/`), and `ghost` (registered only when
     both Ghost env vars exist — dormant in seed mode).
   - `src/lib/ghost/index.ts` exposes `fetchFeed()`, the only content entry point for pages. It
     normalizes seed Markdown and Ghost posts into the same `GhostPost` DTO via
     `src/lib/ghost/mapper.ts` (which also sanitizes HTML).
   - `src/lib/series.ts` defines the series, their tag slugs and feeds, and the D11 gate
     `validateSeriesCoverage()`: an unknown `series-*` tag warns and the post stays standalone, a
     **required** series with zero posts fails the build, an optional empty series warns.

## Directory map

| Path | What it is |
| --- | --- |
| `src/assets/` | Source images processed by `astro:assets` (`figures/` headshots, SAHA group photo). |
| `src/components/ui/` | Design-system primitives (`Button`, `Card`, `Chip`, `Input`, `Avatar`, `Badge`, `Alert`, `Toggle`, `SectionHeading`) + `vendor-logos.ts`. |
| `src/components/features/` | Composed site pieces (`PostCard`, `ProjectCard`, `CaseStudy` chips, `TestimonialCard`, `SoundToggle`, `ThemeToggle`, `GhostAlert`, `SeriesCard`, `PressCard`, `ValuePropAnchor`). |
| `src/components/dev/` | `PrimitivesShowcase.astro`, used only by the gated `/dev/design` review route. |
| `src/layouts/` | `BaseLayout.astro` (shell, head, wormhole) and `CaseStudyLayout.astro`. |
| `src/lib/` | `seo.ts`, `series.ts`, `sound.ts`, `wormhole-bridge.ts`, `seed.ts`, `build-id.ts`, `client-storage.ts`, `cn.ts`, and the `ghost/` facade (`index`, `client`, `loader`, `mapper`, `media`, `pagination`, `snapshot-store`, `validation`, `env`, `types`). |
| `src/pages/` | Routes: `/`, `/work[/slug]`, `/blog[/slug]`, `/series[/slug]`, `/search`, `/about`, `/contact`, `/cv`, `/404`, plus `rss.xml.ts`, `series/[slug]/rss.xml.ts`, `robots.txt.ts`, `build-id.json.ts`, and the `VITE_DEV_ROUTES=1`-gated `dev/[...design].astro`. |
| `src/styles/global.css` | Tailwind 4 `@theme` tokens and the `:root`/`.dark` semantic bindings; `check-tokens` reads computed values from it. |
| `src/vendor/wormhole/` | The built copy of the effect (verbatim upstream + exactly three documented patches). |
| `src/vendor/wormhole.upstream/` | Pristine baseline (`wormhole/`, `SPEC*.md`, `BASELINE.md`, tests) for reviewable diffs. Never edited. |
| `src/vendor/wormhole/VENDOR_PATCHES.md` | The three-patch contract and the diff commands that verify it. |
| `src/data/cv.ts` | Canonical CV data (route + PDF source). |
| `src/content/` | `seed/` Markdown posts (one directory per series) and `work/` MDX case studies. |
| `src/content.config.ts` | Content Layer schemas and loaders (seed/work/Ghost). |
| `scripts/` | Gates, generators and dormant resilience tooling (below). |
| `tests/unit/` | Vitest: Ghost facade state machine, mapper/sanitizer, pagination, series gate, sound. |
| `tests/vendor/` | Vitest `vendor` project with the `three` stub alias; asserts the vendored element contract and all three patches. |
| `tests/e2e/` | Playwright: `smoke` (also runs with JS disabled), `wormhole`, `axe`. |
| `docs/` | `asset-manifest.md` (images/audio decisions), `credentials.md` (credential wording rules), `backups.md` (restore + rollback runbooks). |
| `public/` | Untouched static files: `brand/` (logos, OG card), `fonts/` (self-hosted woff2 + OFL), `audio/intro-8bit.mp3` (trimmed derivative; credit + non-ownership note in `SoundToggle.astro`), `favicon.svg`. |
| `scripts/lib/` | `cv-pdf.ts` (shared CV HTML + hash) and `harness.mjs` (shared check harness). |
| `.github/workflows/ci.yml` | The single verify job (order below). |
| `.vercel/` | Local Vercel link metadata; gitignored, never deployed from git. |
| `redirects.csv` | Pre-deletion inventory of the retired Next.js app. **Not read by the build or CI**; `vercel.json` is the redirect source of truth. |
| `pnpm-workspace.yaml` | Not a monorepo: only pnpm 12's `allowBuilds` allowlist for `esbuild` and `sharp`. |
| `svelte.config.js` | `vitePreprocess()` for the Svelte islands. |
| `playwright.config.ts` | One browser, four projects: `chromium`, `wormhole` (dark, autoplay allowed), `no-js` (`javaScriptEnabled: false`), `axe`; preview server on `127.0.0.1:4321`. |
| `vitest.config.ts` | Two projects: `unit` (Node) and `vendor` (same, with `three` aliased to `tests/vendor/three-stub.js`). |
| `lighthouserc.json` | Fixed mobile profile (412×823, simulated 1.5 Mbps/150 ms, 4× CPU), `/`, `/work`, `/blog` ×3, median LCP/CLS/TBT budgets. |

### `scripts/`

Gates (`node scripts/*.mjs`, one assertion each):

| Script | Asserts |
| --- | --- |
| `check-tokens.mjs` | Computed semantic CSS variables for both themes match `DESIGN.md` tables. |
| `check-contrast.mjs` | Recomputed WCAG ratios match both `DESIGN.md` contrast tables (±0.05). |
| `check-primitives.mjs` | Review build (`VITE_DEV_ROUTES=1`): every primitive present, ≥ 44 px interactive height, visible focus ring. |
| `check-audio.mjs` | Real Chromium audio graph: autoplay rejection persists `off` and says so, the toggle never lies, tabbing to it does not end the intro (patch #1), gain fades on all four end paths, `inert` released, no bare `three`/external requests. |
| `check-paint.mjs` | `html` background resolves to `rgb(5, 8, 13)`, `body`/shell transparent, hero pixel diff proves the canvas paints (exits 2 without WebGL 2). |
| `check-claims.mjs` | Every case study carries `claim_source` per quantitative claim, ≥ 3 attributed stack chips, and banned unsupportable phrases. |
| `check-seo.mjs` | Per route: title, description, canonical matching the emitted path, OG/Twitter, applicable JSON-LD; `/404` is `noindex, nofollow`. |
| `check-cv-pdf.ts` | `dist/cv/tapia-resume.pdf` exists and its recorded hash matches `src/data/cv.ts`. |
| `check-pagefind.mjs` | The post-build Pagefind index is non-empty and has its entry file (no dead `/search`). |
| `check-links.mjs` | Every internal `href`/`src` resolves in `dist/`, and every fragment resolves to a real `id`/`name`. |
| `check-js-budget.mjs` | Gzip budgets: initial route JS ≤ 60 KB, effect + three ≤ 220 KB, total ≤ 300 KB (1 KB = 1024 B). |
| `check-heartbeat.mjs` | Deployed `/build-id.json` SHA matches branch HEAD; skips (exit 0) when no URL is configured. |
| `check-contact.mjs` | Posts a honeypot payload to `CONTACT_ENDPOINT` and requires a non-2xx rejection; skips when unset. |
| `drill-rollback-check.sh` | Read-only G6 preflight: deployed build-id SHA vs branch HEAD; never promotes or reverts. |

Generation and shared helpers: `generate-cv-pdf.ts` renders the CV with Chromium and writes
`dist/cv/tapia-resume.pdf` + `.hash` (CI-only; writes to `dist/` only), `lib/cv-pdf.ts` holds the
shared HTML/hash logic, `lib/harness.mjs` is the check harness.

Resilience (written, reviewed, **dormant until Ghost + `CONTACT_ENDPOINT` exist**):
`snapshot-ghost.ts` (only writer of `src/content/ghost-snapshot/`), `backup-ghost.ts`,
`notify.ts`, plus the heartbeat/contact checks above. See `docs/backups.md`.

### CI order (`.github/workflows/ci.yml`)

`SITE_URL: ${{ vars.SITE_URL || 'https://ci.invalid' }}`; then: install (`--frozen-lockfile`) →
Playwright Chromium → `astro check` → `svelte-check` → `tsc --noEmit` → ESLint → `pnpm build` →
**builds-never-write** (`git diff --exit-code && test -z "$(git status --porcelain)"`) →
`test ! -f dist/dev/design/index.html` → Pagefind index → generate CV PDF → upload PDF →
claims → SEO → CV hash → JS budgets → links → tokens → contrast → primitives → `pnpm check:g3`
(audio + paint) → heartbeat and contact (each skipped unless its repo variable is set) →
`vitest run` → Lighthouse CI → Playwright.

## Gate system

Gates are binary and map to the build phases (plan §4). `pnpm build` must be green first; the
Chromium-dependent harnesses read `dist/`.

| Gate | Question it answers | Commands | Local | CI |
| --- | --- | --- | --- | --- |
| **G0** Foundation | Does a clean build produce the dark shell, no `/dev` route, and a pristine tree? | `astro check`, `svelte-check`, `build`, builds-never-write, `test ! -f dist/dev/design/index.html`, axe | ✅ | ✅ |
| **G1** Design system | Do tokens, contrast and primitives match `DESIGN.md` in both themes? | `check:tokens`, `check:contrast`, `check:primitives` (`check:g1`) | ✅ | ✅ |
| **G2** Content | Does the Ghost-shaped facade serve seed content, paginate, and neutralize hostile HTML? + required series non-empty | `vitest run` (`tests/unit`, `tests/vendor`), seed E2E | ✅ | ✅ |
| **G3** Wormhole | Does the intro run once, clean up on every path, sound honestly, and paint the canvas? | `tests/e2e/wormhole.spec.ts`, `check-audio`, `check-paint` (`check:g3`) | ✅ | ✅ |
| **G4** Pages & SEO | Do routes render with JS off, carry correct metadata, resolve every link and claim, and ship a matching CV PDF? | `check:claims`, `check:seo`, `check:cv-pdf`, `check:links`, `smoke`/`no-js` E2E (`check:g4`) | ✅ | ✅ |
| **G5** Resilience | Is the deployed build fresh and is the contact endpoint alive? | `check:heartbeat`, `check:contact`, backup scripts `--dry-run` | optional (needs URL) | conditional |
| **G6** Launch | Are JS/Lighthouse budgets, rollback drill and the full suite green? | `check:js-budget`, `lhci`, `drill:rollback`, all of the above | partial | ✅ |
| **G-CUT** Cutover | Does Ghost live mode pass the same contracts plus kill-Ghost and cold-start drills? | Phase G drills (see plan §4) | at cutover | at cutover |

## Ghost migration (Phase G)

`src/lib/ghost/index.ts` is a four-state machine, and every page imports only `fetchFeed()`:

1. **No `GHOST_URL`** → **seed**: the Content Layer renders `src/content/seed/**/*.md`, mapped
   through the same `buildGhostPost` DTO builder as Ghost. This is v1.
2. **`GHOST_URL` set and reachable** → **live**: paginated Content API through
   `src/lib/ghost/client.ts`.
3. **Live fetch fails** → **snapshot**: `src/lib/ghost/snapshot-store.ts` reads the last committed
   `src/content/ghost-snapshot/current.json` and the build warns. That directory does not exist
   yet; the scheduled snapshot job creates it at cutover.
4. **Neither** → the build **throws** with a three-way fix (repair envs, unset to seed, or
   regenerate a snapshot).

Every result is finalized with unique-slug validation and the D11 series gate before pages see it.
`src/content.config.ts` also registers a dormant `ghost` collection (via `ghostLoader()`), so the
same schema can serve Content Layer consumers after cutover.

**At cutover** nothing in `src/pages/**` changes: set `GHOST_URL` + `GHOST_CONTENT_API_KEY` in
Vercel, activate the scheduled `snapshot-ghost.ts` job (first run mirrors media under `/media/`),
wire Ghost webhooks to the Vercel deploy hook, and run the G-CUT drills (kill-Ghost, cold start,
media mirror, embed, backup restore). Seed content stays in git as the migration source of record;
reverting = delete the Ghost envs and seed mode resumes until G-CUT completes. See `plan.md`
Phase G and `docs/backups.md`.

## Conventions worth knowing

- **Claim ledgers.** Every quantitative claim in `src/content/work/**/*.mdx` carries a
  `claim_source` entry (`claim`, `source`, optional `source_type`, `checked`); stack entries carry
  `artifact` and may set `hidden: true` for ledger-only technologies that must never render
  (D-C). `check-claims.mjs` enforces this — do not soften a claim to dodge a missing source.
- **Vendor patches are exactly three.** `src/vendor/wormhole.upstream/` is pristine; the built copy
  differs only by the a11y focus exemption, the unconditional intro release, and the Michroma 400
  fix, documented in `src/vendor/wormhole/VENDOR_PATCHES.md`. Verify with
  `git diff --no-index src/vendor/wormhole.upstream/wormhole src/vendor/wormhole`; a fourth
  runtime change needs a D6 amendment. `src/vendor/wormhole.upstream/wormhole/` is the baseline
  extracted from `temporal-drift-v2.zip` (never committed).
- **Builds never write.** `pnpm build` writes only to `dist/` (and ignored paths); CI fails on any
  tracked diff or untracked stray. Scripts that generate artifacts write to `dist/` only. If a
  build mutates `src/`, that is a bug, not a workflow.
- **Dark is canonical (D2).** Server-rendered `<html class="dark">`; only an explicit stored
  `light` choice unthemes it, and the pre-paint script must stay fail-safe.
- **Intro and sound must be truthful (D10).** `intro="once"` is pinned; replay goes through the
  vendor controller; the sound toggle only reports "on" when the element is actually producing
  audio; a blocked autoplay persists `off` and tells the visitor. Do not add a second audio path.
- **`redirects.csv` is an inventory, not config.** `vercel.json` is the only redirect source of
  truth; the CSV records what the retired Next.js app served.
- **Do not commit personal/source artifacts.** The certificate PDF, the original Doctor Who MP3
  and `temporal-drift-v2.zip` are untracked and gitignored; the only committed audio is the
  encoded derivative `public/audio/intro-8bit.mp3` (licence noted in
  `docs/asset-manifest.md` §4 and rendered by `SoundToggle`).

## Where to read next

- Commands, env table and performance procedure: [`README.md`](README.md).
- Tokens, type scale, primitives and motion: [`DESIGN.md`](DESIGN.md).
- Decisions (D1–D13), gates and Phase G: [`plan.md`](plan.md).
- Restore/rollback runbooks: [`docs/backups.md`](docs/backups.md).
