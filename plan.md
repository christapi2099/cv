# Portfolio Revamp — Execution Plan (rev 3.1, final; dephased Ghost)

Companion documents: **`PROMPT.md`** (requirements & positioning), **`DESIGN.md`** (normative design system). Rev 3 incorporates two independent review passes (GLM + Opus, findings verified against the wormhole source, Ghost docs, npm, and Astro docs) plus a pass-2 delta review by Opus. **[rev3.1]** amends the plan per the owner's call: v1 ships **seed-mode** (local Markdown content) and Ghost cuts over in Phase G once the droplet is ready. Sections marked **[rev3]** resolve pass-2 findings; **[rev2]** marks pass-1 resolutions retained. Gates are numbered sequentially (G0–G6, one per phase; G-CUT for the Ghost cutover).

---

## 0. Decision log

| # | Decision | Why |
|---|---|---|
| D1 | **Fresh Astro scaffold; astro-sphere is a visual/structural reference, not a fork.** | Verified: astro-sphere is Astro 4 + Tailwind 3 + SolidJS, last commit Jun 2025. Forking = 3 migrations before day one. (PROMPT.md updated to match.) |
| D2 **[rev2]** | **Dark is canonical and server-rendered; theme resolution tri-state.** Server HTML always `class="dark"` (the no-JS path). Head script (guarded `try/catch`, pre-paint): stored choice (`localStorage.theme` = `light`\|`dark`) wins → else `prefers-color-scheme: light` → light → else dark. After an explicit choice, OS changes are ignored (matches DESIGN.md). Storage contract in one module `lib/client-storage.ts`: keys `theme`, `sound` only. | First pass honored only an explicit "light" — contradicted DESIGN.md. Documented divergence: JS-off visitors always get dark. |
| D3 **[rev3]** | **Ghost content fetched at build time; a pinned webhook event set rebuilds.** **Dormant until cutover (D13)** — the adapter and webhook wiring are written and unit-tested in seed mode, activated at Phase G. Events: `post.published`, `post.published.edited`, `post.unpublished`, `post.deleted`, `post.tag.attached`, `post.tag.detached`. `post.updated` does not exist (verified twice) and silently-configured hooks are a trap. **No `site.changed` subscription by default** — with a direct deploy hook it double-triggers normal changes; tag *renames* are instead caught by the daily snapshot job's content-hash comparison (D4) which opens a PR → rebuild. `site.changed` is documented as an opt-in escape hatch only. Delivery: Ghost → Vercel deploy-hook URL directly; that URL is a rotatable **bearer credential** stored only in Ghost + Vercel (never git, logs, or `astro.config`). Ghost's optional HMAC signature cannot be verified by a deploy hook; a verifying receiver (one Vercel function + `GHOST_WEBHOOK_SECRET`) is the documented upgrade path. | Closes the deleted-post-forever and double-build failures; keeps one dedupe-free event set. |
| D4 **[rev3]** | **Publish contract is live-first, three-state, single snapshot writer — extended with seed mode by D13 [rev3.1].** `fetchFeed()` → **live** Ghost fetch (paginated) → on failure **snapshot** (`source: 'snapshot'`) → unreachable Ghost with no snapshot → `source: 'unavailable'`, and **the build fails** with actionable setup instructions. **Seed mode (no `GHOST_URL` configured): `source: 'seed'`**, content from the `glob()` loader — the build can never fail on CMS unreachability because it does not depend on one. Builds never write: the **only** snapshot writer is `scripts/snapshot-ghost.ts` (scheduled CI workflow, **activated at cutover**): fetch → validate → write `current.json` + rotating `versions/<ISO>.json` (last 10) → open PR. Gate `git diff --exit-code && git status --porcelain` proves builds touch nothing — in seed mode as well, since media and content are committed by hand, never by the build. Webhook rebuilds fetch **live** content (hooks are triggers, never transport). | A webhook rebuild rendering "snapshot-cached HTML" contradicted freshness; a hosted build cannot commit; `fetchFeed: never throws` contradicted the cold-start rule. All three resolved as one contract; D13 re-arms the edge cases as planned modes. |
| D5 **[rev2]** | **Pagefind in the build command** (`"build": "astro check && svelte-check && astro build && pagefind --site dist"`). Island loads the runtime lazily on the search route (`await import(/* @vite-ignore */ '/pagefind/pagefind.js')`). `data-pagefind-body` on article content; `data-pagefind-ignore` on nav/footer/search page/fallback lists; `/search/`, `/dev/**`, feeds, 404 excluded. CI indexes non-empty builds (the assertion activates with the first real post, not on an empty shell). No-JS path: server-rendered "Browse all articles" list, dead input hidden. | Fixed the G0 empty-shell/Pagefind contradiction. |
| D6 **[rev3]** | **The wormhole vendors into `src/vendor/wormhole/` (Vite-bundled) plus a pristine upstream baseline and one unified, checked-in patch.** `public/` would silently kill it (verified: bare `'three'` imports; `public/` leaves the module graph). Layout: `src/vendor/wormhole.upstream/` = pristine verbatim copy (+README, SPEC, tests) for reviewable diffs; `src/vendor/wormhole/` = the patched copy actually built. `three@0.170.0` pinned. **Vendor patches (all documented in one `VENDOR_PATCHES.md`) — exactly three:** (1) *a11y control exemption:* elements marked `data-wormhole-control` are skipped by the `focusout` skip handler (otherwise tabbing to our toggle ends the intro); (2) *unconditional release:* `releaseIntro()` cleanup + event emission never early-returns on a missing intro owner (upstream early-returns; overlay/`inert`/focus could otherwise leak when no intro ever started); (3) *font weight:* the two `900` Michroma font-load/canvas calls request `400` (Michroma ships one weight; a 400-family drawn at 900 would be synthetic-bolded). A plain client event bridge attaches `introstart`/`introend` **at element insertion, before the dynamic import** (the event can fire before any island hydrates); `wormhole:ready` gates *controller* access only — not listening. No import maps, no CDN. `no-font-link` set; Michroma self-hosted and preloaded. | Pass-1 verified the resolution target; pass-2 closed the raciness and the non-executable harness (see Phase 3, gate G3). |
| D7 | **SAHA is one case study with three chapters; RollTrack is one case study.** Deep dives live in the *Project Breakdowns* series. | Two flagship narratives > four cards. |
| D8 | **Deploy: Vercel**, static output + webhook rebuilds, `site` origin in `astro.config.mjs`. Runtime scope (contact endpoint) is the only mixed function — see D12. | Free tier, familiar. |
| D9 **[rev3]** | **Target Astro 7** (`astro@^7.4`), **Node 22 pinned (`>=22.23.4`** — verified floor for `astro@7.4`/`@astrojs/mdx@8`; enforced in `engines`, `.nvmrc`, CI, and Vercel `NODE_VERSION`), **TypeScript 6 pinned** (current `@astrojs/check` supports TS 5/6), `tsx` added for the TS scripts. Verified matrix below. If a needed adapter lacks an astro-7 peer: fall back only with a written PR note; Astro-5 line documented as fallback. | A fresh scaffold two majors back inherits an upgrade treadmill; an unpin'd Node/TS combo fails before check even runs. |
| D10 **[rev3]** | **Intro sound control: one truthful component; one atomic lifecycle.** During the intro it renders fixed at `z-index: 2147483001` (above the verified `2147483000` overlay), afterwards in the sticky header; post-intro it becomes "Replay intro with sound" (`controller.replayIntro()`); it shows "Sound on" **only while actually playing** (a rejected `play()` flips the persisted preference to `off` and announces "Sound was blocked by your browser — tap to enable"). During any intro the app shell carries `inert`; **cleanup is atomic and unconditional** (vendor patch #2): on any intro end — natural, skip, watchdog, or no-event — the patch removes shell `inert`, *then* restores focus, *then* emits `introend`; the site watchdog (12 s) calls the same path via `controller.skipIntro()` and fades the audio; a module-import failure releases the shell too. | Pass-1 verified overlay z-order; pass-2 verified the race (focus restored by upstream *before* `introend` — so `inert` removal must precede it, inside the patch, not in a site listener). |
| D11 **[rev3]** | **Series resolve by internal tag slug, explicit and *required* in the registry.** `lib/series.ts` maps `'series-developer-horror-stories': { slug, title, blurb, required: true }`. URLs come from the registry. A post tagged with an **unknown** `series-*` tag → build WARN + standalone treatment. A **required** series with zero live posts → **build failure** (a vanished series may not ride a green CI); a non-required empty series → page not generated + WARN. | Warning-only drift left a deleted series navigable-but-green; failure makes disappearance loud. |
| D12 **[rev3]** | **Contact: v1 ships the `mailto:` path as the always-works route; the progressive form posts to one first-party Vercel function** (provisioned in Lane 0B; spam honeypot + rate limit; server-rendered success/failure HTML pages; `CONTACT_ENDPOINT` env). No form exists in the build until the endpoint is provisioned — a form with no `action` and no JS is forbidden. | "Provider failure falls back to the link" is unimplementable in a native POST; the endpoint choice must be a decision, not prose. |
| D13 **[rev3.1]** | **Ghost is phased in; v1 ships seed-mode.** Content is authored as local Markdown under `src/content/seed/` (two series directories) with a `glob()` loader mapped to the **exact `GhostPost` DTO** — routes, layouts, SEO, RSS, and search are Ghost-shaped from day one. Publishing in seed mode = commit a Markdown file → Vercel redeploys on push (the developer workflow stays one step). At cutover (Phase G, when the droplet is ready): install Ghost + MySQL 8 → create the Content API key + series tags → one-time migration (`scripts/seed-to-ghost.ts` renders seed MD → Ghost import JSON, feature images referenced by absolute site URLs so Ghost ingests them) → verify counts → flip env vars → adapter switches from `glob()` to the Ghost loader + snapshot writer activates → webhooks point at the deploy hook. The `GHOST_URL`-less state is the existing `source: 'unavailable'` cold-start logic re-armed as a **planned** mode: no Ghost env vars ⇒ build never fails on CMS unreachability; it renders seed content. Ghost-dependent ops (snapshot PR job, webhooks, backup drills, content-hash monitoring) activate at cutover, not before. | Owner's droplet isn't ready yet; nothing in the Ghost-free shell should block on external lead time. Seed mode reuses the resilience architecture instead of forking it — cutover risks are confined to one migration script and one env flip. |

---

## 1. Target stack (verified matrix)

| Package | Version | Notes |
|---|---|---|
| `astro` | `^7.4` | Static output, Content Layer |
| `@astrojs/svelte` + `svelte` | `^9` / `^5.43` | Astro-7 peer line |
| `@astrojs/mdx` | `^8` | Case studies are MDX (chapters embed evidence components) |
| `@astrojs/sitemap`, `@astrojs/rss` | `^3` / `^4` | `site` origin mandatory |
| `tailwindcss` + `@tailwindcss/vite` | `^4.3` | No config file; tokens in CSS `@theme` |
| `@tryghost/content-api` + `@types/tryghost__content-api` | `^1.12.15` / `^1.3.17` | SDK ships no types; key is public-read (kept out of client bundles anyway) |
| `sanitize-html` + `@types/sanitize-html` **[rev3]** | pinned | Ghost HTML is allowlist-sanitized in the mapper *before* any `set:html` (Phase 2) |
| `three` | `0.170.0` exact | Pinned to the wormhole's tested r170 |
| `pagefind` | `^1.6` (exact) | Post-build indexing |
| `sharp` | `^0.35` (exact) | Local asset pipeline |
| `tsx` **[rev3]** | latest pinned | Runs the TS scripts (`snapshot-ghost.ts`, `backup-ghost.ts`, `notify.ts`) |
| Fonts | Michroma **400**, Space Grotesk **500/600/700**, Inter **400/500**, JetBrains Mono **400** | Self-hosted `woff2` + OFL licence files in `public/fonts/`; exact files enumerated per weight (no synthetic bold anywhere); display faces preloaded; `font-display: swap` |
| Runtimes **[rev3]** | Node `>=22.23.4` (pin exact in `engines`/`.nvmrc`/Vercel), TypeScript `6.x` pinned | Astro 7 + MDX 8 floors |
| Dev toolchain | `@astrojs/check`, `svelte-check`, ESLint + `eslint-plugin-astro` + `@typescript-eslint` (`no-explicit-any`, `no-floating-promises`), Playwright + `@axe-core/playwright`, `@lhci/cli`, Vitest, `schema-dts`, `tailwind-merge`, `clsx`, `class-variance-authority` | Several already carried from the Next.js era |

One package manager (pnpm, committed lockfile). Ghost requires **MySQL 8** when self-hosted.

---

## 2. Target repository structure

```
cv/
├── DESIGN.md / PROMPT.md / plan.md / README.md / docs/backups.md
├── astro.config.mjs / package.json / .nvmrc / lighthouserc.json / playwright.config.ts
├── vercel.json           # host-level redirects: the ONLY source of redirect truth [rev3]
├── .github/workflows/ci.yml
├── public/
│   ├── brand/            # rolltrackapp_logo, SahaLogo, favicon, og-default
│   ├── fonts/            # woff2 per weight + OFL licences
│   ├── audio/intro-8bit.*  # committed ONLY with the licence decision recorded (D6/R1) [rev3]
│   ├── media/            # Ghost images mirrored by the snapshot writer, checksum-addressed [rev3]
│   └── cv/tapia-resume.pdf # generated in CI from src/data/cv.ts — never hand-edited [rev3]
├── src/
│   ├── vendor/
│   │   ├── wormhole.upstream/  # pristine verbatim copy (+tests/README/SPEC) — diff baseline [rev3]
│   │   └── wormhole/           # built copy + VENDOR_PATCHES.md (exactly 3 patches) [rev3]
│   ├── assets/figures/   # approved photos (asset manifest)
│   ├── components/ui/    # Button, Card, Chip, Badge, SectionHeading, Toggle, Alert, Input, Avatar
│   ├── components/features/ # ProjectCard, PostCard, SeriesCard, StackGrid, PressCard,
│   │                     #   SoundToggle, ThemeToggle, SearchIsland, GhostAlert, ValuePropAnchor
│   ├── layouts/          # BaseLayout, ArticleLayout, CaseStudyLayout
│   ├── content.config.ts # collections + facade wiring (seed loader active; Ghost loader dormant)
│   ├── content/seed/    # launch content: <series-slug>/*.md (migrated at Phase G)
│   ├── content/work/     # case studies as .mdx
│   ├── data/cv.ts        # THE canonical CV source — /cv and the PDF both render from it [rev3]
│   ├── lib/
│   │   ├── ghost/        # client.ts, pagination.ts, snapshot-store.ts, mapper.ts (+sanitizer), media.ts
│   │   ├── seo.ts / series.ts / client-storage.ts
│   ├── pages/            # index, about, work/, work/[slug], blog/, blog/[slug],
│   │                     #   series/index, series/[slug], series/[slug]/rss.xml.ts, search,
│   │                     #   contact, cv, rss.xml.ts, robots.txt.ts, 404, /api/contact (function)
│   └── styles/global.css # @theme tokens + scoped .prose stylesheet
└── scripts/              # snapshot-ghost.ts, backup-ghost.ts, notify.ts (tsx);
                           #   check-contrast.mjs, check-primitives.mjs, check-claims.mjs, check-seo.mjs
```

Nav = Home, Work, Blog (+ series nested), About, CV, Contact. **Enforced clean-code rules:** `no-explicit-any`, `no-floating-promises`; `astro check` strict; no component imports another component's internals; error handling at `lib/` boundaries; intentional names; no dead code. Phase 0 deletes the Next.js app **in the same commit** as the redirect map (inventory before deletion; see Phase 0A.2).

---

## 3. Cross-cutting contracts

**Data contracts** (`src/lib/ghost/`, one typed facade):

```ts
interface GhostPost {
  id: string; slug: string; title: string;
  html: string;                       // sanitizer output (allowlist) — safe for set:html
  excerpt: string;                    // Ghost null unless set → fallback: first 160 chars of plaintext
  featureImage: string | null;        // mirrored /media/ URL or null (designed no-image card)
  featureImageAlt: string | null; featureImageCaption: string | null;   // [rev3]
  publishedAt: string; updatedAt: string;
  seriesSlugs: string[]; tagSlugs: string[];
  author: { name: string; url: string | null };
  readingMinutes: number;
}
interface GhostSnapshot {
  schemaVersion: 1; fetchedAt: string; contentHash: string;   // [rev3] canonical content hash
  posts: GhostPost[]; tags: GhostTag[]; authors: GhostAuthor[];
  site: { title: string; description: string };
}
type FeedSource = 'live' | 'snapshot' | 'unavailable';         // [rev3] three-state
async function fetchFeed(): Promise<{ source: FeedSource; fetchedAt: string; posts: GhostPost[]; }>;
```

- **Pagination (verified, Ghost 6):** `limit: 'all'` removed (silently caps at 100). Always page: `limit=100` → follow `meta.pagination.next`, ~250 ms inter-page delay, bounded page count; CI fixture with **101 posts**; assert `posts.length === meta.pagination.total`. `/settings/` accepts no query params.
- **Sanitizer boundary [rev3]:** the mapper sanitizes Ghost HTML (maintained allowlist, `safeUrlSchemes: http(s), mailto`; `javascript:`/SVG/dangerous-attribute payloads rejected) **and** transforms `embed`/`bookmark`/`video` cards into static link cards **before** sanitization. Hostile-HTML fixtures are gate assets (G2). Only the owner's Ghost account publishes (documented boundary).
- **Media pipeline [rev3]:** the **snapshot writer is the sole downloader** — it mirrors Ghost-hosted images (feature + in-article) to checksum-addressed paths under `public/media/`, records the manifest + checksums in the snapshot, and rewrites every URL-bearing attribute (`src`, `srcset`, gallery `img`s) at the same time the mapper consumes the manifest. External images pass through untouched. A Ghost/CDN outage then cannot break either the build or the article images. DTO alt/caption preserved. Builds never download.
- **URL policy:** one `canonicalUrl(path)` helper; `site` set once; `trailingSlash: 'never'` + `build.format: 'directory'`; sitemap excludes `/404`, `/dev/**`, feeds; `robots.txt` references the absolute sitemap URL. A post is canonical at `/blog/<slug>`; series pages **list** posts, never re-render bodies. RSS links/guids use the site origin, never Ghost URLs.
- **Background paint contract (verified):** element at `z-index: -1`; `html { background: var(--color-surface) }` (root bg paints beneath negative z-index); `body` and page shells transparent; only content surfaces carry backgrounds. Gate: controlled **pixel diff** of the hero region between the effect-enabled page and the same page with `ambient-opacity="0"` — a real difference proves the canvas (not text/UI) is visible.
- **Wormhole attribute pins:** `fixed intro="once" look="storm" lightning="on" ambient-opacity="0.4" ambient-fps="30" no-font-link logo-text="CHRISTOPHER TAPIA"` (≤ 32 chars asserted; portrait wraps automatically). The Vite test fixture loads the **bundled** element with `three` stubbed via test alias — CI catches upstream attribute/API drift against the pinned copy (D6), replacing the obsolete CDN-failure case with a failed-local-chunk case.
- **Light mode:** switching stops the controller and disables intro/ambient/audio (a hidden element still does WebGL work — verified); returning to dark resumes ambient only. Theme switch during an intro ends it and fades the audio.
- **No-JS contract (enforced from Phase 1):** nav is a native `<details>/<summary>` disclosure below 768px (labelled "Menu", keyboard-operable, no JS); contact is the visible pre-filled `mailto:` link (D12); search degrades to the browse-all list; `/cv` fully server-rendered. Playwright `javaScriptEnabled: false` project runs the route matrix in CI.

**Env table:** `SITE_URL` (canonical origin), `CONTACT_ENDPOINT` (D12) — required from Phase 0; `GHOST_URL`, `GHOST_CONTENT_API_KEY` — **required from cutover (Phase G), dormant before it** [rev3.1]; `VERCEL_DEPLOY_HOOK_URL` (Vercel-side secret, rotatable bearer, activated at cutover), backup credentials + `BACKUP_BUCKET` (Lane E). All documented in README; only Ghost-side/Vercel-side storage of the hook URL.

---

## 4. Phases

### Phase 0 — Foundation (two parallel lanes)

**Lane 0A — code scaffold/toolchain**
1. Branch `revamp/astro`; keep git history.
2. **Inventory before deletion:** current routes are `/`, `/about`, `/contact`, `/projects`. Classification **[rev3]:** `/about`, `/contact`, `/` are **retained** at the same paths (no redirects — self-redirects create loops; verified against the current `src/app/*` tree). Only `/projects → /work` is **moved**. Write `redirects.csv` (documentation) + `vercel.json` (host-level 301s with `statusCode: 301` — an adapterless static Astro redirect emits meta-refresh/200, so the host is the redirect truth). Deleting `src/` and adding `vercel.json` are the same commit.
3. Scaffold Astro 7 (D9) + `astro add svelte tailwind sitemap mdx`; pin the §1 matrix (Node 22, TS 6, `tsx`, sanitizer, exact Pagefind/Sharp); carry over still-relevant deps; declare pnpm + lockfile.
4. **Asset manifest** (source, licence, credit, alt, dimensions, approved use): brand logos, Alenka headshot + credit, SAHA group photo; decide Christopher's headshot (`Person` image + hero) or remove; delete unapproved template assets (`public/images/headshot-*` derivatives unless adopted). `git mv` everything kept. Audio: **prepare** (trim intro window ~13 s, re-encode ~96 kbps mono → gate ≤ 160 KB by measured bytes) but **do not commit** until the licence decision is recorded (R1); the original-named MP3 and the zip never enter git.
5. Extract the effect → `src/vendor/wormhole.upstream/` (pristine) + patch it → `src/vendor/wormhole/` with `VENDOR_PATCHES.md` (patches #1–#3, D6); `pnpm i three@0.170.0`; Vite test fixture + stub alias configured now (used by G3).
6. Dark default (D2) wired; token parity test (semantic CSS variables themed at `:root`/`.dark` == DESIGN.md tables, **[rev3]**: the gate resolves computed variable values, not raw hex — see G1).
7. **CI scaffold [rev3]**: `.github/workflows/ci.yml` on **Node 22** — `astro check`, `svelte-check`, `tsc --noEmit`, ESLint, build (+Pagefind), LHCI vs `dist/` (fixed browser/network profile), Playwright (+ `no-js` project with `javaScriptEnabled: false`, + axe project), the `check-*.mjs` scripts, the vendored Vite fixture, `lighthouserc.json`.

**Lane 0B — infra provisioning (split [rev3.1])**
1. **Now (blocks Phase 4):** Vercel project + deploy hooks + env vars (`SITE_URL`; Ghost envs only at cutover); `NODE_VERSION` pinned; **contact function provisioned** (D12: endpoint + spam + success/failure pages) so the form ships with the site instead of dangling; encrypted backup bucket + credentials provisioned (its consumers — backup scripts, monthly drills — activate at cutover; the bucket exists now so Lane E never invents infrastructure later).
2. **Deferred to Phase G (droplet-ready gate):** Ghost hosting decision and install (self-hosted on the existing DO infra + **MySQL 8** + SMTP + TLS vs Ghost(Pro); other branch survives as runbook text in `docs/backups.md`), Ghost admin + **Content API key** (read-only), the two internal series tags at exact slugs, webhook integrations → deploy-hook URL (secret, never in git), backup scheduling + monthly restore drills, monitoring jobs.

**Gate G0 (binary):** `astro check && svelte-check && astro build` exit 0; `grep -q 'class="dark"' dist/index.html`; `test ! -f dist/dev/design/index.html`; token-parity test green; `git diff --exit-code && git status --porcelain | wc -l | grep -qx 0`; CI green; axe: zero serious violations on the shell; **every legacy URL checked against the deployed Vercel preview: retained routes return 200 at the same path; `/projects` returns a single 301 to `/work` [rev3]**.

### Phase 1 — Design system + cross-cutting contracts
1. `components/ui/*` exactly from DESIGN.md tokens (Button primary/secondary/ghost + hover, Card + elevated, Chip + RollTrack/SAHA brand variants, Toggle, Alert ×3, Input, SectionHeading, Avatar, Badge). Interactives ≥ 44px; visible, tested focus rings.
2. `lib/seo.ts` **now**: title/description/canonical/OG/Twitter + JSON-LD builders (`Person` with stable `@id`; `WebSite`+`SearchAction`; `Article`/`BlogPosting` authors referencing `Person`; `BreadcrumbList`; series as `CollectionPage` via `isPartOf`; `sameAs` personal-only, companies in `worksFor/affiliation`; JSON-LD serialized safely, not string-interpolated).
3. Scoped `.prose` stylesheet (68ch, `body-lg` Inter, Space Grotesk in-article headings, `pre` on `surface-container` + `code-md`, `blockquote` 3px `primary` left rule).
4. Review route `/dev/design` gated on `import.meta.env.VITE_DEV_ROUTES === '1'` **[rev3]** — reachable in `astro dev` and in a review build run with the flag; absent from the plain prod build (G0 proves the negative). (Pass-1's `import.meta.env.DEV` never flips in a build — both reviewers caught it.)
5. `GhostAlert` + `ValuePropAnchor` built here; pages consume.

**Gate G1 (binary):** `node scripts/check-primitives.mjs` (all primitives present in both themes; computed height ≥ 44px on interactives; focus ring visible) and `node scripts/check-contrast.mjs` — **resolves the actual computed values of the semantic tokens for both `:root` (light) and `.dark`**, computes WCAG ratios including case normalization, and asserts **both** the DESIGN.md dark and light contrast tables within ±0.05 tolerance, exact-pair list from the spec; non-zero exit names the failing pair **[rev3]**.

### Phase 2 — Content layer (seed mode — Ghost-shaped from day one) **[rev3.1]**
1. `lib/ghost/` boundary + typed facade (`fetchFeed` with the `live | snapshot | unavailable` states, D4) — **plus the seed state** (D13): with no `GHOST_URL` configured, `fetchFeed()` returns `source: 'seed'` from the glob loader. The Ghost client is written and unit-tested against fixtures now; its live integration activates at Phase G.
2. Content Layer loaders in `src/content.config.ts` (Content Layer collections key on `id`; `slug` is an explicit schema field and drives routes): **seed loader** (`glob()` over `src/content/seed/<series>/*.md`) is active in v1; the Ghost loader ships wired but only activates at cutover. Mapping logic is shared — one mapper, two sources, identical `GhostPost` output. No second code path for pages.
3. Sanitizer + embed transform in the mapper (§3) — **before anything renders with `set:html`** **[rev3]**, with hostile-HTML fixtures (seed content is trusted-local but runs the same pipeline; at cutover the Ghost path inherits it zero-cost). In seed mode, embeds are authored as static link cards directly and media are repo-local.
4. Snapshot pipeline (D4): code written, scheduled job **dormant until cutover** (Phase G activates it).
5. Publishing E2E in seed mode: write a seed post → push → Vercel auto-redeploy → post live on `/blog/<slug>` + sitemap + RSS + `Article` JSON-LD. The webhook E2E moves to Phase G's gate.

**Gate G2 (binary):** seed-mode E2E slice green (author → push → route live); pagination loop **unit-tested with the 101-fixture against the Ghost client fixtures** (live-Ghost drill moves to G-CUT); `git diff --exit-code && git status --porcelain` clean; hostile-HTML fixture renders inert (no script/iframe/javascript:-scheme survives) **[rev3]**; **if a required series (D11) has zero seed posts at this gate, the gate fails** (forces launch content to exist before pages are declared done).

### Phase 3 — Wormhole intro + audio + a11y controls
1. Vendor integration per D6: bridge attaches pre-import; pinned attributes; `three` lazy chunk via the effect's own `await import('./App.js')`; `no-font-link`; `VENDOR_PATCHES.md` reviewed as a diff of `wormhole.upstream` → `wormhole`.
2. Sound control per D10 (fixed z-index above the overlay during intro; header after; "Replay intro with sound" post-intro; truthful state machine; shell `inert` with the atomic cleanup inside vendor patch #2).
3. Audio per D6/R1 + measured-size gate (≤ 160 KB by actual encoded bytes; 96 kbps mono fits the ~13 s window ≈ 156 KB); `<audio preload="none" loop>`; source attached only when the intro starts; WebAudio `GainNode` ramps (0→0.4 @0.5 s; 0.4→0 @2 s).
4. Reduced motion → no intro, no music; no WebGL → no intro + **site-level** CSS storm-gradient fallback (the element's Shadow-DOM fallback requires JS by definition — the site layer is the real one); light mode stops the controller (not CSS-only).
5. Paint contract (§3) implemented; hero pixel-diff gate below.

**Gate G3 (binary):** Vite fixture smoke suite (three stubbed, bundled element): intro-once, skip, Esc, live toggles, replay, reduced motion, **failed-local-chunk case** (replaces CDN-failure), import-failure shell release; `node scripts/check-audio.mjs` (Playwright): fade on all four end paths (natural / skip / watchdog / no-event watchdog), autoplay rejection flips the persisted preference, toggle never displays a lying state, keyboard tab to the toggle does NOT end the intro (patch #1 verified); bundling proven in-browser: no unresolved bare import and no external `three` request + dist contains no remaining `from'three'` bare specifiers ([rev3] — rev2's grep was directionally wrong); hero pixel-diff (effect-on vs `ambient-opacity=0`) exceeds threshold.

### Phase 4 — Pages (SEO per page; Ghost-consuming routes after G2)
1. **Home:** Michroma hero; positioning: full-stack · Stripe Connect · LiveKit · performance; case-study + series teasers (teaser data comes from the Ghost facade — this page is **gated on G2**); "As featured by UC Irvine" press chip (quote briefly, link generously, never reproduce the body); CTA.
2. **Work hub `/work`**: four anchored value props (`#full-stack`, `#stripe-connect`, `#livekit`, `#performance`), each with one proof line + a link into its case study; fragments verified in the browser (a DOM/link checker — curl cannot resolve fragments **[rev3]**).
3. **Case studies** (MDX): RollTrackApp (Co-founder & CTO; Next.js + Django + PostgreSQL; attendance/payments/gamification/retention analytics; **AWS → DigitalOcean migration** chapter); SAHA Collective with three chapters (Provider Portal; Scheduler — the ~$4,000/month save phrased to facts, no vendor-bashing; SAHA Meet — self-hosted LiveKit, HIPAA-*appropriate* posture, reskinned, zero per-seat API costs). Photos credited. Brand chips per DESIGN.md.
4. **Ledgers [rev3]:** every MDX case study carries `claim_source` (URL + date checked) per quantitative claim; a tech→project attribution table maps every listed technology to one real artifact or drops it (currently: **NestJS, Payload CMS, MySQL — map or drop**); `node scripts/check-claims.mjs` asserts ≥ 1 verified numeric claim + ≥ 3 attributed stack chips per case study and bans exact unsupportable phrases ("HIPAA certified", "HIPAA compliant" without the qualifier, unsupported "production scale"); tone (vendor-bashing) is human-reviewed, not grepped.
5. **Blog + series** (`/blog`, `/series/index`, `/series/[slug]`, series RSS `/series/[slug]/rss.xml` + site `/rss.xml`; both linked from `<head>`; feeds list summaries only) — running on seed content at launch: the first *Developer Horror Story* and *Project Breakdown* are authored as Markdown under the seed directories during this phase (the route layer doesn't know or care about the source).
6. **Contact** (visible pre-filled `mailto:`; progressive form → first-party function, D12); **Search** (D5); **`/cv`** — renders from the canonical `src/data/cv.ts`; **CI renders the PDF from the same structured source** into `dist/cv/tapia-resume.pdf` (verified by a source-content hash; the route renders the same data so the two cannot diverge — [rev3]: no PDF-generation circularity); **404**.

**Gate G4 (binary):** `check-claims` green; every case-study page contains a number with a resolvable source; JS-off route matrix (every route 200, `<main>` text > 200 chars, nav disclosure operable); anchors present in the DOM (link checker); CV route renders and `dist/cv/tapia-resume.pdf` exists with a matching content hash.

### Phase 5 — Resilience hardening (ops) **[rev3.1: seed-mode scope]**
1. Seed-period resilience: repo = content-of-record (seed posts, media, CV data all in git — git *is* the backup with 1:1 restore); build-id heartbeat active from first deploy; contact function monitored.
2. Media pipeline: code complete, **dormant until cutover** (drills move to G-CUT).
3. Backups/monitoring (Ghost-dependent): scheduled backups, monthly restore drills, content-hash job, snapshot PRs, staleness alerts — **all activate at cutover**; the scripts and the runbook are written and reviewed now so cutover is a schedule change, not a build.

**Gate G5 (binary):** seed-mode rebuild heartbeat verified against the deployed build-id; contact endpoint failure drill; backup/restore scripts pass `--dry-run` + lint review (live drills at G-CUT).

### Phase 6 — Verification & launch
1. Full suite: every `check-*.mjs`, vendored fixture smoke, contrast harness (`tests/run-harness.py`, headless Chrome; body copy constrained to opaque surfaces so the `#05080d`-measured results transfer; artifacts archived), LHCI budgets, axe, link + DOM checker, `astro check`/`svelte-check`/`tsc`/ESLint.
2. **Performance budget (artifact-level):** initial route JS ≤ 60 KB gzip excluding the lazy effect chunk; effect + three lazy chunk ≤ 220 KB gzip (downloads only when the effect starts, after WebGL detection); total JS ≤ 300 KB gzip; LCP ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 200 ms (mobile, fixed CI profile). Lighthouse runs with the intro deterministically skipped; the real intro is tested separately (an animated overlay must not become the measured LCP).
3. Content review against PROMPT authenticity rules (read the $4k/month and HIPAA-appropriate phrasing aloud).
4. **Launch (v1 = seed mode [rev3.1]):** ≥ 1 genuinely published seed post per required series; publish-to-production latency **measured** over test publishes (SLA written down, not asserted); legacy redirect gate executed against production (retained routes 200; `/projects` a single 301 → `/work` 200); sitemap submitted; Rich Results checked; **rollback runbook** (trigger, Vercel rollback action, git revert, named owner) and a rollback drill executed once; **music licence decision recorded** (ship the trimmed 8-bit asset with a decision note, or the replacement chiptune). Ghost status at launch: dormant by design (D13).

**Gate G6 (binary):** all gates green in CI on the deploy branch; rollback drill verified; launch checklist signed off.

### Phase G — Ghost cutover (executes when the droplet is ready) **[rev3.1]**
1. **Provisioning (Lane 0B.2 activates):** install Ghost (+ MySQL 8, SMTP, TLS) on the droplet or provision Ghost(Pro); Content API key + internal series tags; webhooks (D3 set) → Vercel deploy-hook URL.
2. **One-time migration:** `scripts/seed-to-ghost.ts` renders every seed post → Ghost import payload (HTML via the same mapper; feature images referenced by **absolute site URLs** so Ghost ingests them into `content/images`) → import → verify post counts + series membership vs the seed manifest.
3. **Cutover flip:** set `GHOST_URL` + `GHOST_CONTENT_API_KEY` in Vercel → scheduled snapshot writer job activates (first refresh mirrors Ghost media to `/media/`) → webhooks live → seed loader retires (its job is done; the seed content remains in git as the migration source of record).
4. **Post-cutover drills run the full resilience suite:** kill-Ghost (snapshot fallback) drill; cold-start (no-snapshot + unreachable) failure drill; media-mirror drill; embed drill; webhook E2E per D3; backup restore drill.

**Gate G-CUT (binary):** migration manifest counts match (posts, tags, series membership); live-mode E2E publish → webhook → `/blog` + series + RSS + JSON-LD green; kill-Ghost and cold-start drills pass exactly as defined in D4; media served from `/media/`; monitoring jobs active and fire in a forced-failure test; rollback documented for the cutover itself (revert = delete Ghost envs → seed mode resumes — it's still in the code until G-CUT completes).

---

## 5. Publishing workflow (seamless day-to-day) **[rev3.1]**

**Seed mode (launch → cutover):**
1. Write a Markdown post in `src/content/seed/<series-slug>/` with frontmatter (`title`, `summary`, `date`, `featureImage`, `draft`).
2. Commit + push → Vercel redeploys on push → post is live on `/blog`, its series page, series RSS, and search within one build. No front-matter-by-hand beyond the YAML you wanted anyway; the DTO mapping is the loader's job.

**Ghost mode (after Phase G):**
1. Log into Ghost → write in the editor.
2. Attach the series internal tag + topical tags. Publish (or schedule — `post.published` fires at publish time, so scheduling is covered).
3. Webhook → rebuild fetching live → post live on `/blog`, its series page, series RSS, site RSS, and search within one measured build (~1–3 min, SLA measured in Phase 6).
4. Publishes, edits, unpublishes, deletes, and tag attach/detach all rebuild (D3). Tag renames are caught within a day by the snapshot content-hash PR (D4/D3); a required series going empty fails G2.
5. Draft review happens in Ghost's dashboard (on-site headless draft preview is a v1 non-goal).

---

## 6. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | 8-bit Doctor Who theme = derivative of a copyrighted composition. | Opt-out from frame one; isolated in `IntroSound`; trimmed/looped asset gated by measured size; original file never committed; derivative commits only after the licence decision is recorded; replacement chiptune ready to swap; never in OG assets/video. **Launch gate includes the licence decision.** [rev3] |
| R2 | Ghost unreachable at build. | Three-state D4 + timestamped stale banner + cold-start failure rule. |
| R3 | Autoplay blocked → silent intro. | By design (D10): toggle = gesture, truthful state, persisted preference. |
| R4 | three.js payload on mobile. | Lazy chunk + WebGL-gated download + CI budgets. |
| R5 | Tailwind 4 needs modern browsers (Safari 16.4+, Chrome 111+). | Accepted (technical audience); no-JS HTML carries the content. |
| R6 | Self-hosted Ghost = maintenance. | Nightly backups + monthly restore drills + build-id heartbeat; Ghost(Pro) is a drop-in escape (same Content API). |
| R7 **[rev2]** | Ghost tag renamed/re-organized → series drift. | Slug-keyed registry + `required` series fail the build (D11) + content-hash snapshot PR catches renames (D3/D4). |
| R8 **[rev2]** | Astro-7 tooling gap (adapter without astro-7 peer). | Written-note fallback; Astro-5 matrix documented. |
| R9 **[rev2]** | Ghost 6 `limit=all` trap truncating content. | Page loop + total assertion + 101-fixture. |
| R10 **[rev3]** | Webhook gaps (missing events) leaving deleted posts live. | Verified event set (D3) + post-publish build-id freshness check. **Detects missing rebuilds** (delivery status is not observable through a direct deploy hook); verifying receiver is the documented upgrade. |
| R11 **[rev2]** | Deploy-hook URL leaked. | Bearer hygiene: Ghost + Vercel only, never git/logs/code; rotation runbook. |
| R12 **[rev2]** | Vendored effect drifts / patches rot. | Pristine upstream baseline + unified patch + `VENDOR_PATCHES.md` + Vite fixture smoke in CI. |
| R13 **[rev2]** | Ghost image CDN host change. | Writer-owned mirroring to `/media/` makes the site self-sufficient (outage drill at G-CUT). |
| R14 **[rev3.1]** | Cutover regression (Ghost envs flipped before content fully migrated). | G-CUT binary manifest-count check; rollback = unset Ghost envs → seed mode (kept operational until G-CUT passes); seed content retained in git as the migration source. |

---

## 7. Non-goals (v1) — [rev2]
- **Ghost at v1** (deferred by D13 — the CMS cutover is Phase G, gated on the droplet being ready; the site ships Ghost-shaped but seed-powered).
- **GitHub stats widgets** (removed from PROMPT.md; conflicts with "nothing client-fetches").
- **Newsletter signup** (removed from DESIGN.md; revisit behind the same resilience rules).
- **On-site draft preview** (drafts review locally in seed mode / in Ghost's dashboard post-cutover; revisit with the verified-receiver auth model).
- **RSS `<content>` full-body** (feeds list summaries only).

---

## 8. Execution lanes (route-level dependency map) — **[rev3.1]**
- **Lane E (Phase 0B.1 + Phase 5)** starts day 1 and does **not** wait for Lane A — "Lane A blocks everything" meant dependent *code* lanes, never provisioning. Lane E's Ghost half (0B.2) is **deferred to Phase G** and does not gate anything in v1.
- **Lane A (0A + 1)** — scaffold, runtimes, tokens, CI, primitives, SEO/storage/DTO contracts. Blocks B, C, D's code work.
- **Lane B (Phase 3)** — wormhole/audio/controls. Needs A (Toggle, fonts incl. the Michroma patch target, storage module, paint contract).
- **Lane C (Phase 2 + Phase 4 step 5)** — adapter facade, seed loader/mapper, sanitizer, blog/series/search pages. **Needs A only — no Ghost env, no droplet, no webhook dependency in v1** [rev3.1]. The Ghost loader code and snapshot writer are written here but stay dormant (their integration gates live at G-CUT, not G2).
- **Lane D (Phase 4 steps 1–4, 6)** — Work hub, static case studies (content collections, no Ghost runtime), ledgers, CV + CI PDF, contact/static pages. Parallel with B and C; merge at routes.
- Primitives (Phase 1) block B and the page lanes; Phase 2's G2 gates Ghost-*shaped* pages (fed by seed); everything funnels into G6; Phase G runs as its own mini-project when the droplet lands (~2–4 days incl. drills).
- **Estimate:** v1 ~2.5–3.5 weeks focused solo, or ~1.5–2 weeks with lanes parallelized (dephasing Ghost removed the external-lead-time blocker from the critical path); cutover is a bounded +2–4 day add-on whenever the droplet is ready.
