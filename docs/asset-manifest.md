# Asset manifest — Phase 0A.4

Status: **draft** (pending owner sign-off on the two open flags in §5).
Owner: Christopher Tapia. Scope: the image assets currently sitting in the repo root, plus the
retired Next.js template derivatives they replace. Paths follow `plan.md` §2:
brand logos → `public/brand/`; persons/photos → `src/assets/figures/`.

The original `Doctor_Who_-_Main_Theme_8-Bit_Version.mp3` and `temporal-drift-v2.zip` were never
opened while drafting this manifest. Audio is recorded in §4 as an owner decision, not as an
image asset.

---

## 1. Approved image assets

| File | Description | Proposed target | Licence / credit | Alt text | Dimensions | Approved use |
|---|---|---|---|---|---|---|
| `alenkaprofileimageheadshot.jpeg` | Square studio-style headshot of Alenka Kyslik, founder of SAHA Collective: long blonde hair, teal button-up shirt, light neutral background. | `src/assets/figures/alenka-kyslik-headshot.jpeg` | Owner-supplied. Copyright remains with Alenka Kyslik; publication is under permission for the SAHA case study. **Credit line required:** “Alenka Kyslik, founder of SAHA Collective.” | “Portrait of Alenka Kyslik, founder of SAHA Collective, smiling in a teal shirt against a light background.” | 200 × 200 px, JPEG, sRGB, 10,920 B | SAHA Collective case study — founder avatar/credit alongside her quote. Not a hero image, not an OG image. Flagged: only 200 px square, so render at ≤ 100 CSS px at 1× or request a larger source. |
| `groupphotosahacollective.jpeg` | Zoom gallery-view screenshot of a five-person call, name labels visible: Jaclyn Cox, Christopher Tapia, Alec Magsombol, Jane Medrano, Alenka Kyslik. Includes the Zoom toolbar and meeting header (“60-minute Meeting between Jaclyn Cox and Alenka…”). | `src/assets/figures/saha-collective-team.jpeg` | Owner-supplied. Contains identifiable third parties and the Zoom UI/branding; publication requires each participant’s consent, which is not recorded in the repo. Credit as “SAHA Collective team meeting (screenshot).” | “Video-call screenshot of five SAHA Collective team members — including Christopher Tapia — in a Zoom gallery grid with their names labelled.” | 800 × 422 px (≈1.9:1), JPEG, sRGB, 59,857 B | SAHA Collective case study, “team/context” figure. Crop the meeting toolbar/header before use. Do not use as an OG image or hero. |
| `rolltrackapp_logo.jpeg` | RollTrackApp brand mark: a white capital “R” on a black square. | `public/brand/rolltrackapp-logo.jpeg` (use `.svg`/`.png` if a vector/master is supplied) | RollTrackApp trademark and © RollTrackApp. Owner is co-founder & CTO; used nominatively to identify the project. | “RollTrackApp logo — a white letter R on a black square.” | 400 × 400 px, JPEG, sRGB, 4,184 B | Brand chip / project card / RollTrackApp case study. Nominative use only; do not alter the mark. JPEG has no alpha — prefer a transparent master. |
| `SahaLogo.jpeg` | SAHA Collective brand mark: a white interlocking heart-shaped knot on a dark green square. | `public/brand/saha-logo.jpeg` | © SAHA Collective. Owner built the platform; used nominatively to identify the client/project. | “SAHA Collective logo — a white interlocking heart-shaped knot on a dark green square.” | 400 × 400 px, JPEG, sRGB, 10,968 B | Brand chip / SAHA Collective case study. Nominative use only; do not alter the mark. JPEG has no alpha — prefer a transparent master. |

## 2. Drop list — retired Next.js template derivatives

Per `plan.md` §4.0A.4 (“delete unapproved template assets (`public/images/headshot-*`
derivatives unless adopted)”) and the owner’s decision that Christopher’s new headshot is
supplied separately (§3 D-A), **all** of these are **drop** — do not restore them from history
or migrate them. They are already absent from the working tree (removed during Phase 0A.2); the
paths are recorded here for the record.

| File (historical path) | What it is | Dimensions | Disposition |
|---|---|---|---|
| `portfolio/public/images/headshot-400.webp` | Responsive derivative | 400 × 600 px, 54,434 B | **drop** |
| `portfolio/public/images/headshot-800.webp` | Responsive derivative | 800 × 1200 px, 169,586 B | **drop** |
| `portfolio/public/images/headshot-1200.webp` | Responsive derivative | 1200 × 1799 px, 319,138 B | **drop** |
| `portfolio/public/images/headshot-400.avif` | Responsive derivative | 400 w declared; AVIF not decodable by the local ImageMagick build | **drop** |
| `portfolio/public/images/headshot-800.avif` | Responsive derivative | 800 w declared; AVIF not decodable locally | **drop** |
| `portfolio/public/images/headshot-1200.avif` | Responsive derivative | 1200 w declared; AVIF not decodable locally | **drop** |
| `portfolio/public/images/headshot-blur.txt` | Base64 LQIP placeholder string | n/a (text) | **drop** |
| `images/chris-circle-headshot.png` | Superseded headshot original (already deleted in commit `bd85ee3`) | 680 × 680 px, 829,854 B | **drop** — history only; may be re-supplied by the owner if desired (§3 D-A) |

Note: the AVIF/WebP derivatives are 2:3 portrait crops, while the historical original is square —
further evidence they are stale template output, not candidates for the adopted headshot.

## 3. Owner decisions recorded

**D-A — Christopher’s own headshot: ADOPT (`Person` schema `image` + hero). RESOLVED 2026-11-14:**
owner-supplied file ingested as `src/assets/figures/christopher-tapia-headshot.jpg` (708 × 944 preview
of a 1200 × 1600 original; filename `christopher-tapia-suit_6392-v2-1200x1600x72-708x944.jpg`).
No image in the repo root is Christopher’s headshot. The only person image is Alenka’s 200 × 200
portrait; the SAHA group photo contains him but is a Zoom gallery screenshot and is unusable as a
portrait/headshot. The old headshot (680 × 680 PNG, deleted in `bd85ee3`) survives only in git
history and is **not** approved by this manifest; it is a possible re-supply source. Until a
file is supplied and listed above, the `Person` schema image and hero portrait cannot ship.

**D-B — 8-bit Doctor Who theme: SHIP trimmed.**
Ship the intro window only (≈13 s, re-encoded ≈96 kbps mono, ≤160 KB by measured bytes) as
`public/audio/intro-8bit.*`. Required alongside it: credit **“Lichttrager” (YouTube)** and a
prominent, plain-language non-ownership disclaimer (derivative of the copyrighted *Doctor Who*
theme; rights remain with the original composers/rights-holders; no affiliation or endorsement).
The original-named MP3 and `temporal-drift-v2.zip` never enter git. This remains an optional,
toggleable enhancement and is gated by R1 / the Phase 3 measured-size gate — not approved merely
by being listed here.

**D-C — NestJS / Payload CMS / MySQL: authored in ledgers, UI-hidden.**
Each may appear in the case-study `claim_source` ledgers, but none may render in UI copy until
artifact permission exists (per Phase 4 ledgers and `check-claims`). Not an image asset; recorded
here so the decision has one home.

## 4. Open items / could not determine

1. **Christopher’s headshot — MISSING.** Must be supplied (see D-A). Blocks `Person` image + hero.
2. **Group photo consent.** RESOLVED 2026-11-14: owner recorded participant consent for all five
   named individuals. Still crop the Zoom toolbar before use.
3. **Alenka headshot resolution.** 200 × 200 px is below a comfortable 2× display size; either cap
   display size or request a larger original.
4. **Written licences.** No licence/credit files exist in the repo for any of the four images.
   Licences above are recorded as “owner-supplied / nominative use”; explicit publication
   permission for the headshot and group photo should be confirmed and, if possible, stored.
5. **Vector brand masters.** Both logos are 400 × 400 JPEG with no transparency. Request the
   canonical SVG/PNG masters; until then, the JPEGs are the approved fallback.
6. **AVIF sizes.** The local ImageMagick build has no AVIF delegate, so only the declared widths
   are known for the dropped AVIF derivatives (their disposition is “drop” regardless).

## 5. Approval

| Item | State |
|---|---|
| Four root images inventoried | done |
| Drop list recorded | done |
| Christopher headshot adopted | done — ingested 2026-11-14 (`src/assets/figures/christopher-tapia-headshot.jpg`) |
| Group photo cleared for publication | done — consent recorded 2026-11-14 (crop Zoom toolbar) |
| Audio decision recorded | done (ship trimmed; credit “Lichttrager” YouTube + non-ownership disclaimer; encoded asset `public/audio/intro-8bit.mp3` = 150,668 B @ 12.5 s / 96 kbps mono, ≤ 160 KB gate passed; original MP3 + zip never committed) |
| NestJS/Payload/MySQL decision recorded | done (ledgers only; UI-hidden) |
