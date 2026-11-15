# Vendored wormhole patches

This directory is the **built copy** of the Temporal Drift v2 wormhole effect
(`src/vendor/wormhole/`). It is a verbatim copy of
`src/vendor/wormhole.upstream/wormhole/` plus **exactly three** patches.
Review with:

```sh
git diff --no-index src/vendor/wormhole.upstream/wormhole src/vendor/wormhole
```

Upstream code is never edited; `src/vendor/wormhole.upstream/` is the diff
baseline (see its `BASELINE.md`).

## Decision D6 (plan.md §0), verbatim

> **The wormhole vendors into `src/vendor/wormhole/` (Vite-bundled) plus a
> pristine upstream baseline and one unified, checked-in patch.** … Layout:
> `src/vendor/wormhole.upstream/` = pristine verbatim copy (+README, SPEC,
> tests) for reviewable diffs; `src/vendor/wormhole/` = the patched copy
> actually built. `three@0.170.0` pinned. **Vendor patches (all documented in
> one `VENDOR_PATCHES.md`) — exactly three:** (1) *a11y control exemption:*
> elements marked `data-wormhole-control` are skipped by the `focusout` skip
> handler (otherwise tabbing to our toggle ends the intro); (2) *unconditional
> release:* `releaseIntro()` cleanup + event emission never early-returns on a
> missing intro owner (upstream early-returns; overlay/`inert`/focus could
> otherwise leak when no intro ever started); (3) *font weight:* the two `900`
> Michroma font-load/canvas calls request `400` (Michroma ships one weight; a
> 400-family drawn at 900 would be synthetic-bolded).

Also relevant, D10: "cleanup is atomic and unconditional (vendor patch #2): on
any intro end — natural, skip, watchdog, or no-event — the patch removes shell
`inert`, *then* restores focus, *then* emits `introend`".

No other upstream code, attribute, or API changes are allowed. New patches
require a D6 amendment.

---

## Patch #1 — a11y control exemption

**File:** `element.js`
**Location:** `#onIntroStart()`, the `#skip` `focusout` listener (~line 313).
**Change (added line after `const next = event.relatedTarget;`):**

```js
if (next?.closest?.('[data-wormhole-control]')) return;
```

Upstream context:

```js
// Tabbing from Skip into the page means "take me to the site".
this.#skip.addEventListener('focusout', (event) => {
  const next = event.relatedTarget;
  // PATCHED: site-owned controls are exempt
  if (next && next !== this && !this.shadowRoot.contains(next)) this.#handle?.skipIntro();
}, { signal });
```

**Rationale.** Upstream treats *any* focus leaving the Skip button for
something outside the shadow root as "take me to the site" and ends the intro.
The site renders its sound toggle (D10) at `z-index 2147483001` above the
intro overlay, so tabbing from Skip to that toggle would end the intro. The
exemption is opt-in: only elements the site explicitly marks
`data-wormhole-control` are ignored, so ordinary page focus still skips.
Optional chaining keeps `relatedTarget: null` (pointer/click-away) and
non-Element targets safe.

## Patch #2 — unconditional intro release

**File:** `element.js`
**Location:** `#releaseIntro()`, first statement (~line 326).
**Change (deleted line):**

```js
if (!this.#introOwner) return;
```

Upstream context:

```js
#releaseIntro({ skipped = false, reason = 'complete' } = {}, { emit }) {
  this.#introOwner = 0;              // PATCHED: guard removed
  this.#introAbort?.abort();
  ...
  if (emit) this.#emit('wormhole:introend', { skipped: Boolean(skipped), reason });
}
```

**Rationale.** Upstream early-returns whenever no intro owner is recorded, so
cleanup and `introend` can be skipped. Both existing call sites stay safe:
`disconnectedCallback()` passes `{ emit: false }`, and the
`onIntroEnd` callback only fires when `this.#introOwner === id`. Removing the
guard makes the release path idempotent and unconditional: overlay hidden,
abort signal cancelled, live region cleared, `data-intro` removed, focus
restored, and (when requested) `introend` emitted — even when no intro ever
started. This is the hook the site uses for atomic cleanup (shell `inert`
removal before focus restore, then `introend`; D10), and the release path taken
by the module-import-failure and watchdog cases. Cleanup being idempotent is
what makes repeated calls harmless.

## Patch #3 — Michroma weight 400

**Files/lines:**

- `core/fonts.js:32` — `loadFont()`:
  `` fonts.load(`400 128px "${family}"`) `` (was `900 128px`)
- `entities/canvasArt.js:34` — `drawLogoMask()`:
  `` const font = (px) => `400 ${px}px ${fontFamilyCss}` `` (was `900`)

**Rationale.** The owner self-hosts Michroma at **400 only** (DESIGN token:
Michroma 400). Michroma has a single weight; requesting `900` makes the
browser synthesize bold, which the design system forbids ("no synthetic bold
anywhere", plan §1). The `400` request matches the one face that exists both
for `document.fonts.load()` and for the canvas-drawn title texture, so the
loaded font and the drawn mask agree.

---

## Verification

```sh
# Exactly three patched files, no other drift:
git diff --no-index --stat src/vendor/wormhole.upstream/wormhole src/vendor/wormhole

# No remaining synthetic-bold Michroma requests:
grep -rn "900" src/vendor/wormhole/ --include=*.js   # only shader/z-index values may match

# Fixture smoke (alias + patch assertions):
pnpm vitest run
```

The fixture test at `tests/vendor/wormhole-element.test.ts` imports the
patched module through the `three` stub alias, asserts the pinned attribute
contract, and fails if any of these three patches disappears.
