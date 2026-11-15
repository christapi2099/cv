# Implementation Kick-off — paste into a new session

> This is the prompt to start implementation of the portfolio revamp in a fresh session. It assumes no prior context: everything needed is either in this prompt or in the repo files it points to.

---

You are implementing a full portfolio-website revamp in **`/home/christophertapia/repos/cv`** (a git repo; today it's a dated Next.js site being replaced). The plan is already written, review-hardened (two independent senior review passes, all blockers resolved), and approved by its owner. Your job is disciplined execution — not re-planning.

## 1. Read (in order, before any code)

1. **`plan.md`** — the normative execution plan (rev 3.1). The decision log (D1–D13), the cross-cutting contracts (§3), the phases with binary gates (§4, G0–G6), the risks (§6), the non-goals (§7), and the lane map (§8) are binding. If you believe something in it is wrong, surface it in one message — don't silently deviate.
2. **`PROMPT.md`** — requirements, positioning, and the authenticity/voice rules the copy must satisfy.
3. **`DESIGN.md`** — the normative design system: exact tokens, contrast values, components, Do's/Don'ts. Tokens map 1:1 into Tailwind 4 `@theme`; the parity test compares them.
4. The wormhole effect source it integrates: `temporal-drift-v2.zip` in the repo root — extract it (`unzip -o temporal-drift-v2.zip -d /tmp/opencode/temporal-drift`) and read `SPEC-v2.md` + `README.md` before Phase 3.

## 2. Mode of work

- **v1 scope = seed mode** (decision D13): the site ships **without Ghost**. Content is local Markdown in `src/content/seed/<series-slug>/*.md`, publishing = commit + push (Vercel auto-redeploys). The Ghost adapter/loader/snapshot/webhook code gets written and unit-tested but stays dormant. Do **not** set `GHOST_URL`, do not provision Ghost, do not wire webhooks — that is Phase G, executed later when the owner's droplet is ready.
- **Branch:** `revamp/astro` off `main`. Never commit to `main` directly. Commit per completed step; a phase is only done when its gate command exits 0 **in CI**, not just locally.
- **Lanes:** follow §8. Lane A (Phase 0A + 1) first — it blocks all code lanes. Lane E.1 (Vercel project, `SITE_URL`, contact endpoint, backup bucket) runs in parallel from day 1. Lanes B/C/D proceed after A.
- **Verification owner is you.** Every gate in plan §4 is a command with an expected exit condition. Run each gate right after its phase and paste the evidence (command + output) into the phase's final commit message before moving on.

## 3. The verified traps — do not rediscover these

These were found by code-verified review of the effect source, Ghost docs, npm and Astro docs. The plan already encodes the fixes; violating any of these silently breaks a headline feature:

1. **`public/` kills the wormhole.** Files under `public/` are copied verbatim, outside Vite's module graph; the effect imports bare `'three'` and would fall back to a dead gradient forever. The effect lives in `src/vendor/wormhole.upstream/` (pristine) → `src/vendor/wormhole/` (built, with exactly three documented patches in `VENDOR_PATCHES.md`) and is bundled via a Vite-processed client script. `three@0.170.0` is pinned.
2. **`three` vendor patches (D6), all required:** (1) `data-wormhole-control` exemption in the `focusout` skip handler — otherwise tabbing to the sound toggle ends the intro; (2) `releaseIntro()` made unconditional (upstream early-returns when no intro owner — overlay/`inert`/focus could leak); (3) the two `900` Michroma font calls become `400` (Michroma ships one weight; 900 would render synthetic bold).
3. **`wormhole:introend` is NOT guaranteed to fire** (early-return paths for reduced motion, no WebGL, `intro="once"` already played, etc.). The audio module arms its own 12 s watchdog on `introstart`; listeners attach at element insertion *before* the dynamic import; `wormhole:ready` gates controller access only.
4. **The sound toggle is invisible/unclickable during the intro** unless it renders fixed at `z-index: 2147483001` (the overlay is `2147483000` and covers the page). Post-intro it becomes "Replay intro with sound". It shows "Sound on" **only while actually playing** (see D10's state machine). The app shell carries `inert` during the intro; the vendor patch removes `inert` *before* focus restoration.
5. **An opaque `body` background paints over the `z-index: -1` canvas.** `html { background: var(--color-surface) }`; body and page shells transparent; only content surfaces carry backgrounds.
6. **Node must be ≥ 22.23.4** (Astro 7 floor) — `engines`, `.nvmrc`, CI, and Vercel `NODE_VERSION`. TypeScript pinned to 6. CI runs `astro check && svelte-check && tsc --noEmit` + ESLint.
7. **Astro 7 content config lives at `src/content.config.ts`** (not `src/content/config.ts`), and Content Layer collections have **no reserved `slug` field** — carry `slug` as an explicit schema field for routes.
8. **Do not configure Ghost webhooks yet** (dormant). When Phase G comes: `post.updated` is not a Ghost event; the verified set is `post.published`, `post.published.edited`, `post.unpublished`, `post.deleted`, `post.tag.attached/detached`; no `site.changed` by default; **Ghost 6 has no `limit=all`** (silently caps at 100) — always paginate `limit=100` following `meta.pagination.next`.
9. **Builds never write.** In seed mode content/media are committed by hand; later the snapshot writer is the only automated committer. Gate: `git diff --exit-code && git status --porcelain`.
10. **Dark is server-rendered default** (`<html class="dark">` + `@custom-variant dark (&:where(.dark, .dark *))` + guarded inline script, tri-state per D2). No flash of light, and the no-JS experience is complete (native `<details>` nav, visible `mailto:` contact, server-rendered `/cv`).

Also remember: `<audio preload="none" loop>` with WebAudio `GainNode` fades (0→0.4 over 0.5 s; 0.4→0 over 2 s; raw `volume` clicks), the encoded asset gates at ≤ 160 KB by measured bytes and **must not be committed** until the licence decision is recorded, and the original-named MP3 never enters git.

## 4. Kick-off sequence

1. `git status → branch revamp/astro`.
2. **Phase 0A** per plan (inventory-before-deletion is step 2 — `/projects → /work` is the only moved legacy route; `/about`, `/contact`, `/` are retained; `vercel.json` is the redirect source of truth). Then run **Gate G0** and show me the evidence.
3. Ask me the three owner inputs before their dependent phases: (a) adopt or drop Christopher's own headshot (asset manifest, step 0A.4), (b) the 8-bit music licence decision is needed **before Phase 3 commit** (trim/encode the asset, keep it out of git until decided), (c) confirm drop/map of the un-attributed stack items (NestJS, Payload CMS, MySQL) before Phase 4 copy.
4. Proceed **Phase 1 → gate G1**, then run Lanes B/C/D to their gates (G3, G2→G4), Phase 5 (G5), Phase 6 (G6) — in that dependency order, pausing at each gate with evidence.

## 5. Standing rules

- TypeScript strict, zero `any`, no floating promises; components consume `components/ui/` only; error handling stays in `lib/` boundaries.
- Every claim in case-study copy needs `claim_source` frontmatter; `check-claims.mjs` phrases and ledgers are part of G4.
- The copy rules in `PROMPT.md` (§Tone and authenticity) are review criteria — numbers over adjectives, no vendor-bashing, "HIPAA-appropriate" never "HIPAA compliant/certified".
- If a task in the plan turns out ambiguous, re-read the corresponding decision log entry first; if still ambiguous, ask me with the context at hand — don't guess on anything the decision log deliberately fixed.
- Do not start Phase G (Ghost cutover, provisioning, webhooks, restore drills) unless I explicitly say the droplet is ready.

**Start now with step 1 of the kick-off sequence: report the branch + a short execution order confirmation, then begin Phase 0A.**
