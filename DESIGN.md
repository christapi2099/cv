---
version: alpha
name: Christopher Tapia — Portfolio
description: >-
  Personal brand system for Christopher Tapia's CV/portfolio site. Dark-mode-first,
  built around the "Storm Vortex" Three.js intro/ambient background spec shipped in
  temporal-drift-v2/SPEC-v2.md (storm palette deep #05080d, cloud tones, violet-indigo
  core swirl #5b4bb3, lightning #efe9ff, computer purple #7b3fe4, and its
  contrast-validated text colors #eef4ff / #c6d2e8). Project case-study accents reuse
  the existing brand tokens from rolltrack-frontend/DESIGN.md (monochrome + #155dfc)
  and saha-scheduling/DESIGN.md (deep green #193330, orange #ff8201, sage #A1B1A4,
  warm white #F7F5F1). Michroma is required by the intro's 3D title canvas and
  anchors the display tier. No brand-guidelines PDF exists for the personal site,
  so the dark palette is derived from the storm spec; every text/background pair
  below was measured for WCAG AA during authoring.
colors:
  # Dark theme (default)
  surface: "#05080d"
  surface-container: "#0d1420"
  surface-elevated: "#131c2b"
  on-surface: "#c6d2e8"
  on-surface-heading: "#eef4ff"
  on-surface-muted: "#8fa1bd"
  primary: "#5b4bb3"
  on-primary: "#ffffff"
  primary-bright: "#7b3fe4"
  primary-container: "#1b1631"
  on-primary-container: "#c9bfff"
  link: "#9b8fe8"
  accent-lightning: "#efe9ff"
  outline: "#2e4257"
  outline-variant: "#1d2f3d"
  cloud-mid: "#4d6b7d"
  cloud-light: "#a9bfcc"
  error: "#ff8a80"
  error-container: "#2a1114"
  success: "#6fd3a0"
  success-container: "#0d1f16"
  warning: "#ffd08a"
  warning-container: "#2a1f0d"
  # Project brand accents (case-study cards only)
  rolltrack-blue: "#155dfc"
  rolltrack-black: "#000000"
  rolltrack-on-black: "#ffffff"
  saha-green: "#193330"
  saha-on-green: "#ffffff"
  saha-orange: "#ff8201"
  saha-sage: "#a1b1a4"
  # Light theme ("Daylight", secondary)
  light-surface: "#f7f5f1"
  light-on-surface: "#1d2f3d"
  light-on-surface-heading: "#05080d"
  light-on-surface-muted: "#535f55"
  light-link: "#155dfc"
  light-outline: "#a1b1a4"
  light-error: "#c10007"
  light-error-container: "#ffe2e2"
  light-on-error-container: "#c10007"
typography:
  display:
    fontFamily: Michroma
    fontSize: 32px
    fontWeight: "400"
    lineHeight: 40px
    letterSpacing: 0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 30px
    fontWeight: "700"
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: "700"
    lineHeight: 29px
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: "600"
    lineHeight: 25px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: "400"
    lineHeight: 29px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 26px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 22px
  label-lg:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: "600"
    lineHeight: 17px
    letterSpacing: 0.08em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: "500"
    lineHeight: 15px
    letterSpacing: 0.04em
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 24px
    letterSpacing: 0
rounded:
  none: 0px
  sm: 6px
  md: 10px
  lg: 16px
  xl: 24px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  xxxl: 64px
  gutter: 16px
  touch-target: 44px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
    height: "{spacing.touch-target}"
  button-primary-hover:
    backgroundColor: "{colors.primary-bright}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
    height: "{spacing.touch-target}"
  button-secondary:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface-heading}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
    height: "{spacing.touch-target}"
  button-secondary-hover:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.on-surface-heading}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
    height: "{spacing.touch-target}"
  card:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  card-elevated:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  chip:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "{spacing.sm}"
  chip-brand-rolltrack:
    backgroundColor: "{colors.rolltrack-black}"
    textColor: "{colors.rolltrack-on-black}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "{spacing.sm}"
  chip-brand-saha:
    backgroundColor: "{colors.saha-green}"
    textColor: "{colors.saha-on-green}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "{spacing.sm}"
  toggle:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface-heading}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.full}"
    height: "{spacing.touch-target}"
  input:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  alert-error:
    backgroundColor: "{colors.error-container}"
    textColor: "{colors.error}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  alert-success:
    backgroundColor: "{colors.success-container}"
    textColor: "{colors.success}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  alert-warning:
    backgroundColor: "{colors.warning-container}"
    textColor: "{colors.warning}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
---

# Christopher Tapia — Portfolio design system

## Overview

Christopher Tapia is a full-stack freelancer and the co-founder & CTO of RollTrackApp. The site's one job is to make a hiring manager or a prospective client believe — within seconds — that this person ships real production software. The proof is structural: case studies with numbers ($4,000/month saved for SAHA Collective, an AWS→DigitalOcean migration, a HIPAA-appropriate LiveKit deployment), press recognition from UC Irvine, and a blog that demonstrates engineering depth in plain language.

**Personality: cinematic, then quiet.** The visitor falls through a storm — tumbling retro computer, violet lightning, their host's name rising in brushed steel — and then lands on a site that is calm, fast, and ruthlessly readable. The drama lives entirely in the intro and the dim ambient background behind the content. The content itself never performs.

**Audience:** (1) freelance clients evaluating whether to hire Christopher for full-stack, Stripe Connect, or LiveKit work; (2) founders and engineering managers considering him for senior/lead roles.

### Values

- Shipping over promises: every claim on the site traces to a live product, a company page, or press coverage.
- Numbers over adjectives: "$4,000/month saved," not "cost-effective."
- Mobile-first: the storm, the type scale, and every touch target are designed for a phone held vertically, then enhanced for desktop.
- Accessibility is not optional: the intro is skippable, lightning is flash-safe, body text holds ≥ 4.5:1 over every ambient frame.

### Voice

First person, plain, direct. Short declarative sentences. Technical terms are used precisely and never as decoration. Humor is allowed on the blog (*Developer Horror Stories*), never on the case-study cards. Sample register: *"Instead of paying it, I forked the scheduler, built the integration SAHA actually needed, and self-hosted it on a single droplet."*

### Logo usage

The wordmark is "CHRISTOPHER TAPIA" set in Michroma, uppercase, with `0.02em` tracking. In the UI it appears in the header at `label-lg` scale and on the intro's 3D title as its own cinematic moment — the two should never compete on one screen. The wormhole effect is atmosphere, not a logo: it never appears in favicons, OG images, print, or email signatures. Keep clear space around the wordmark equal to the height of the "C". The provided brand logos (`rolltrackapp_logo.jpeg` — white-on-black mark, `SahaLogo.jpeg` — white-on-deep-green tile) belong exclusively to their case-study cards and social links, always at their own brand colors.

### Imagery

Four approved photos ship with the site: the RollTrack logo, the SAHA logo tile, Alenka Kyslik's headshot (used in the SAHA case study, credited as founder), and the SAHA Collective group photo. Photos sit inside `card` surfaces with a subtle dark vignette so warm daylight photos don't jump off the dark theme. Screenshots of the products are preferred over abstract stock art; there is no stock photography anywhere on the site.

### Theme behavior

Dark is the default and canonical theme; the wormhole ambient background runs only in dark. The light "Daylight" theme is a secondary reading mode for long blog sessions: the ambient background and lightning are hidden, and the page becomes a calm warm-white document. The theme toggle lives in the header, persists across visits, and the system `prefers-color-scheme` is respected only before the visitor has ever chosen.

## Colors

The dark palette is the storm itself — taken from the Storm Vortex shader spec, whose ambient mode was already contrast-tested over a `#05080d` page. Text colors are the spec's own validated pair.

| Token | Hex | Role |
|---|---|---|
| `surface` | `#05080d` | Page background; the wormhole ambient composites over it |
| `surface-container` | `#0d1420` | Cards, inputs, nav bar, alert surfaces |
| `surface-elevated` | `#131c2b` | Hover states, modals, elevated panels |
| `on-surface` | `#c6d2e8` | Body text (storm-tinted off-white, from the wormhole spec) |
| `on-surface-heading` | `#eef4ff` | Headings and emphasized text |
| `on-surface-muted` | `#8fa1bd` | Captions, metadata, timestamps |
| `primary` | `#5b4bb3` | Violet-indigo core swirl: buttons, focus rings, active states |
| `on-primary` | `#ffffff` | Text on primary |
| `primary-bright` | `#7b3fe4` | Hover state of primary; the retro computer's case color |
| `primary-container` | `#1b1631` | Chip and badge surfaces carrying violet identity |
| `on-primary-container` | `#c9bfff` | Text on primary-container |
| `link` | `#9b8fe8` | Inline links in body copy (primary itself is too dark to read as text here) |
| `accent-lightning` | `#efe9ff` | Glows, focus outlines over media, the "current" indicator |
| `outline` | `#2e4257` | Input borders, card dividers |
| `outline-variant` | `#1d2f3d` | Hairline dividers (cloud-dark from the storm palette) |
| `cloud-mid` | `#4d6b7d` | **Illustration only** (charts, wormhole art) — fails AA as text |
| `cloud-light` | `#a9bfcc` | Illustration highlight; also large decorative numerals (≥ 24px, 10.52:1) |
| `error` | `#ff8a80` | Error text/icons |
| `error-container` | `#2a1114` | Error alert background |
| `success` | `#6fd3a0` | Success text/icons |
| `success-container` | `#0d1f16` | Success alert background |
| `warning` | `#ffd08a` | Warning text/icons |
| `warning-container` | `#2a1f0d` | Warning alert background |

**Measured contrast (WCAG AA):**

| Pair | Ratio | Passes |
|---|---|---|
| `on-surface-heading` on `surface` | 18.17:1 | AAA |
| `on-surface` on `surface` | 13.17:1 | AAA (spec-validated over every ambient frame) |
| `on-surface` on `surface-container` | 12.11:1 | AAA |
| `on-surface` on `surface-elevated` | 11.22:1 | AAA |
| `on-surface-muted` on `surface` | 7.64:1 | AA |
| `on-primary` on `primary` | 6.77:1 | AA (buttons) |
| `on-primary` on `primary-bright` | 5.72:1 | AA (hover) |
| `on-primary-container` on `primary-container` | 10.27:1 | AAA |
| `link` on `surface` | 7.15:1 | AA |
| `accent-lightning` on `primary` | 5.73:1 | AA |
| `error` on `error-container` | 7.74:1 | AA |
| `success` on `success-container` | 9.39:1 | AAA |
| `warning` on `warning-container` | 11.26:1 | AAA |
| `on-surface-heading` on `surface-elevated` | 15.48:1 | AAA |

**Project brand accents.** Case-study cards may use their subject's real brand colors — this is deliberate provenance, not noise, and it stays confined to chips, logos, and a single accent line per card:

| Token | Hex | Where |
|---|---|---|
| `rolltrack-blue` | `#155dfc` | RollTrack card accent |
| `rolltrack-black` / `rolltrack-on-black` | `#000000` / `#ffffff` | RollTrack logo tile & brand chip |
| `saha-green` / `saha-on-green` | `#193330` / `#ffffff` | SAHA logo tile & brand chip (13.48:1) |
| `saha-orange` | `#ff8201` | SAHA card accent (8.07:1 on `surface`, usable as text) |
| `saha-sage` | `#a1b1a4` | SAHA secondary accent (8.92:1 on `surface`) |

**Light theme ("Daylight").** Warm white from the SAHA brand book, storm ink:

| Token | Hex | Ratio on `light-surface` |
|---|---|---|
| `light-surface` | `#f7f5f1` | — |
| `light-on-surface-heading` | `#05080d` | 16.2:1 |
| `light-on-surface` | `#1d2f3d` | 12.64:1 |
| `light-on-surface-muted` | `#535f55` | 6.15:1 |
| `light-link` | `#155dfc` | 4.82:1 |
| `light-error` on `light-error-container` | `#c10007` on `#ffe2e2` | 5.27:1 |

`primary` and `on-primary` carry over to light mode unchanged (6.22:1 on `light-surface`). The `saha-orange` is NOT used on the light theme as text (3.0:1); on light it is decoration only.

## Typography

Four typefaces, one voice. **Michroma** is the display tier — the same font the wormhole intro extrudes into the 3D title, so the name on the hero and the name in the storm are one continuous gesture. **Space Grotesk** carries headlines and labels with its techy grotesque character. **Inter** does the thankless work: body copy and long-form articles (Ghost posts) at maximum readability. **JetBrains Mono** is for code blocks and inline code.

- `display` — Michroma: the wordmark and hero name only. Always uppercase with `0.02em` tracking; never used below 24px; never used for sentences.
- `headline-lg/md/sm` — Space Grotesk: page titles, section headers, card titles. Sentence case. `headline-lg` scales up to 44px on ≥ 1024px viewports via fluid `clamp()`.
- `body-lg/md/sm` — Inter: all prose. `body-lg` for lead paragraphs and article body; `body-md` the workhorse; `body-sm` for captions and metadata.
- `label-lg` — Space Grotesk, 0.08em tracking, uppercase: buttons, nav items, eyebrow text above headlines.
- `label-sm` — Inter, 0.04em tracking: chips, tags, series labels.
- `code-md` — JetBrains Mono: code blocks; inline code gets the same family at 0.9em with a `primary-container` background.

Casing rules: headlines sentence case; labels uppercase; the wordmark uppercase. No title case anywhere.

## Layout & Spacing

Mobile-first. The single-column phone layout (360px) is the canonical design; larger screens add width and a second column, they never re-flow the hierarchy.

- **Grid:** one column below 768px; 12-column grid at ≥ 1024px with a 1256px max content width, gutters scaling 16px → 24px. Blog prose column stays at 68ch regardless of viewport.
- **Rhythm:** all vertical spacing comes from the spacing scale (4px base). Component padding uses `sm`–`lg`; section padding `xl`–`xxxl` (a case study breathes: `xxxl` top, `xxl` bottom).
- **Touch targets:** every interactive element is at least `touch-target` (44px) tall — sound toggle, skip-intro button, nav links, chips. This is a hard floor, including on the intro overlay.
- **Ambient readability:** the wormhole keeps its calm zone behind centered hero text; body sections sit on `surface`/`surface-container` where the ambient is dimmed, so long articles are never read over motion.
- **Header:** sticky, translucent `surface` with backdrop blur; collapses to a menu button below 768px.

## Elevation & Depth

The dark theme doesn't decorate with drop shadows — depth is tonal. Elevation is expressed by stepping up surface lightness: `surface` → `surface-container` → `surface-elevated`. Modals and menus may add one soft shadow: `0 8px 32px rgba(5, 8, 13, 0.6)`.

Glow is the theme's one expressive gesture, borrowed from lightning: `accent-lightning` used as a 2px focus ring, and — sparingly, once per view — a violet radial gradient (`rgba(123, 63, 228, 0.25) → transparent`) behind a hero or active card. The wormhole itself provides the atmosphere: ambient mode runs at 0.4 opacity, 30fps cap, and is the only "texture" the theme allows. No glassmorphism panels, no noise overlays, no gradient buttons.

## Shapes

- Buttons, inputs, alerts: `md` (10px).
- Cards, post cards, media frames: `lg` (16px).
- Hero panels and modals: `xl` (24px).
- Chips, tags, the sound toggle, avatars: `full`.
- Icon style: outline, 1.5px stroke, 24px default (`lucide` set), no filled icons except the play/sound states, where a filled glyph reads as "on".
- Photos keep `lg` corners with a 1px `outline-variant` hairline; logo tiles keep `md` corners (never `full` — these are brand marks, not avatars).

## Components

**Buttons.** `button-primary` (violet, uppercase Space Grotesk labels) is for the one main action per view: "View case study," "Read the breakdown," "Get in touch." Hover lightens to `primary-bright`. `button-secondary` (container surface, outline hairline) is for everything else. A `ghost` variant (no background, `link`-colored label) is reserved for in-text actions. Never more than one primary button per section.

**Cards.** `card` is the universal surface: case studies, posts, series tiles, press mentions. `card-elevated` appears on hover/keyboard focus of an interactive card (plus the violet glow once per view, per Elevation). Card titles use `headline-sm`, descriptions `body-sm`, and the meta row (date, reading time, series chip) uses `on-surface-muted`. Case-study cards add: the subject's logo tile (brand colors), a stack chip row, and one accent hairline in the subject's brand color (`rolltrack-blue` or `saha-orange`).

**Chips.** `chip` (violet container) tags technologies and stack items. `chip-brand-rolltrack` / `chip-brand-saha` mark content belonging to a subject brand — black and deep-green respectively with white labels. Series chips (`label-sm` in `saha-sage` for SAHA series, `link` for general series) navigate to series pages. Chips are 44px touch targets when they are links; visual chips can be smaller but never below 28px.

**Toggles.** `toggle` (full-round, container surface, `label-lg` text) covers the sound toggle during the intro, the skip-intro control, and the theme toggle. The sound toggle shows its state with a filled/silent speaker glyph and a text label ("Sound on" / "Sound off"), not color alone. It is visible from the first frame of the intro (rendered fixed above the intro overlay), then lives in the sticky header; after the intro ends it becomes "Replay intro with sound," and the visitor's choice persists across sessions. It always displays the actually-audible state, never an intent.

**Alerts.** `alert-error`, `alert-success`, `alert-warning` are the designed fallback states — including the no-JS and CDN-failure states: "Article feed unavailable — showing the latest snapshot from {date}," etc. They always state what happened, what the visitor sees instead, and what to do next. Errors are actionable copy, never just red text.

**Inputs.** `input` on `surface-container` with `outline` borders; focus ring `accent-lightning` at 2px. Used for the contact form; it works without JavaScript (`mailto:` is the visible, always-works path — a form with no action and no JS is a dead end and is forbidden).

**Post prose.** Ghost article bodies render in Inter `body-lg` at 68ch with Space Grotesk for in-article headings, `code-md` blocks on `surface-container` with `md` corners, and blockquotes marked by a 3px `primary` left rule — never italics-on-grey.

## Do's and Don'ts

- Do default to dark mode; never flash a white screen before the theme resolves.
- Do keep every text/background pair at or above its measured ratio; don't put `cloud-mid` or `primary` down as text colors.
- Do respect `prefers-reduced-motion`: no intro, no ambient lightning, no music autoplay.
- Do keep the intro skippable (button + `Esc` + focus management) and the sound opt-out visible from frame one.
- Do use the subject brands' colors only inside their case-study contexts; don't let SAHA green or RollTrack blue leak into global UI.
- Don't stack decoration on the wormhole: no extra gradients, particles, or glass panels over the ambient background.
- Don't use Michroma below 24px, for sentences, or for anything that isn't the name or the wordmark.
- Don't autogenerate a spinner for a failed dynamic region; ship the designed alert state with a snapshot or an actionable message.
- Don't ship any interactive element under 44px tall on touch.
- Don't claim HIPAA *certification*; the case study says the deployment is configured for HIPAA-appropriate operation.
- Don't put the 8-bit theme's autoplay ahead of the visitor: sound is opt-out at first frame, and returning sessions remember the choice.
