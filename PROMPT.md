# Portfolio Revamp — Master Prompt

> Enhanced from the original request. Hand this prompt to any developer or AI agent to execute the revamp. Pair it with `plan.md` (execution phases) and `DESIGN.md` (visual system). Structural reference (do not fork — fresh Astro scaffold, see plan.md D1): [markhorn-dev/astro-sphere](https://github.com/markhorn-dev/astro-sphere) · Design spec: [google-labs-code/design.md](https://github.com/google-labs-code/design.md)

---

## Who this site is for

I'm **Christopher Tapia** — UC Irvine ICS '25 informatics alumnus (first-generation student), **co-founder & CTO of [RollTrackApp](https://rolltrackapp.com)**, and a freelance full-stack web developer. This site is my CV/resume portfolio: it must position me for **freelance contracts and full-time senior/lead opportunities** by proving I ship real production software that makes money, saves money, and runs at scale — not toy projects.

**UCI feature article for bio material and authentic quotes:** https://ics.uci.edu/2026/03/19/from-project-expo-to-cto-alumnus-christopher-tapia-kicked-his-career-into-high-gear/

**Company links:** https://www.linkedin.com/company/rolltrackapp/ · https://www.linkedin.com/company/sahadotcollective/

---

## Stack (implementation detail in plan.md D1/D9)

The revamp replaces the dated Next.js site with a **static-first, SEO-native, mobile-first, dark-mode-default** portfolio. Stack:

| Layer | Technology |
|---|---|
| Static site | **Astro** — fresh scaffold on the current major; astro-sphere as structural reference only, not a fork |
| Intro + ambient background | **Three.js** wormhole effect (see below) |
| Interactive components | **Svelte** (via official Astro integration) |
| Styling | **Tailwind CSS** |
| Language | **TypeScript** throughout, strict mode |
| Blog/articles CMS | **Ghost** (headless, fetched at build time — phased in at cutover; v1 publishes from local Markdown, same routes, plan.md D13) |
| SEO | Native: sitemap, canonical URLs, Open Graph, JSON-LD (`Person`, `WebSite`, `Article`), RSS, performance budget |
| Responsive | Mobile-first; every breakpoint designed, not squeezed |

## The intro: wormhole + 8-bit theme

1. **Intro animation** — the "Storm Vortex" wormhole (code in `temporal-drift-v2.zip`: drop-in `<wormhole-bg>` web component, three.js r170, no build step). Plays ~10s on first arrival per session, then settles into a dim ambient background behind page content. Built-in: skip button, `Esc` to skip, `prefers-reduced-motion` respect, watchdog timer, quality tiers for phones.
2. **8-bit music** — `Doctor_Who_-_Main_Theme_8-Bit_Version.mp3` plays with the intro.
   - A visible **sound toggle** (on/off) is available from the first frame of the intro.
   - When the intro ends (naturally or skipped), the music **fades out over ~2s**, then the regular site is presented.
3. **Music starts only when the intro starts.** The sound preference persists across sessions; the intro plays once per session, and browser autoplay policy may require the visitor's tap — the visible toggle is that gesture, and it always shows the actually-audible state.
   - **Licensing note:** the 8-bit rendition is a derivative of the copyrighted Doctor Who theme. Keep it as an optional, toggleable enhancement (never required for the site to function), and be ready to swap in a licensed/original chiptune if the site scales or gets commercial scrutiny.
3. **No-JS / no-WebGL:** the site fully works without JS. Without WebGL, the intro never plays and a CSS-gradient fallback renders instead.

## What I want the site to say

### Positioning (freelancer value propositions — each needs its own landing anchor)

- **Full-stack web development** — end to end: database schema to deployed pixel.
- **Stripe Connect developer** — marketplace payments, onboarding, embedded components, Connect account flows.
- **LiveKit developer** — self-hosted, real-time video infrastructure (WebRTC) at production scale.
- **Performance-first web apps** — static-first architecture, Core Web Vitals budgets, measurable speed.

**Stack fluency to show (not just list — tie each to a real project):** Next.js, NestJS, React, Svelte, Python, Django, PostgreSQL, MySQL, TypeScript, Payload CMS, SEO, Astro, Three.js, Tailwind CSS, DigitalOcean, AWS.

### Case studies (the heart of the site — use the provided images)

**1. RollTrackApp — Gym management SaaS for martial arts gyms** (`rolltrackapp_logo.jpeg`, rolltrackapp.com)
- Role: **Co-founder & CTO** — technical lead and product manager.
- Stack: Next.js, Django, PostgreSQL.
- What it does: attendance tracking, payment management, and gamification features that increase student retention and reduce churn — "taking the pulse of your gym."
- Also cover: **AWS → DigitalOcean migration** (cost-driven infrastructure move executed without customer-visible downtime).
- Authentically: this began as my UCI capstone at the 2025 ICS Project Expo and became a company. Quote from UCI article: *"The expo kind of became my career."*

**2. SAHA Collective — Provider platform for a holistic-wellness marketplace** (`SahaLogo.jpeg`, `alenkaprofileimageheadshot.jpeg`, `groupphotosahacollective.jpeg`; built for founder Alenka Kyslik)
- **SAHA Provider Portal**: onboarding providers, **Stripe integration**, embedded into the company's WordPress site.
- **SAHA Scheduler — the $4,000/month save (phrase authentically, facts, no vendor-bashing):**
  > The scheduler SAHA needed would have required a sub-organization API plan billed for a minimum of 100 users — roughly $4,000 every month for a team a fraction of that size. Instead of paying it, I forked the open-source scheduler, built the custom integration SAHA actually needed, and self-hosted it on a single DigitalOcean droplet. The monthly cost dropped from thousands of dollars to a flat droplet bill — and SAHA owns the whole stack.
- **SAHA Meet — HIPAA-appropriate video, self-hosted**: a LiveKit integration for the scheduler, self-hosted and reskinned for SAHA's brand. Purpose: daily HIPAA-appropriate telehealth video without per-seat API costs of hosted providers. Emphasize: HIPAA posture is a property of how we deployed and configured it (self-hosted infrastructure, no third-party call recordings), not a certification claim.

### Tone and authenticity rules

- First person, plain language. Numbers over adjectives ("$4,000/month saved", "AWS→DO migration", "100-user minimum").
- Every claim must be traceable to something real (live site, LinkedIn company page, the UCI article).
- No "passionate ninja wizard" language. The wormhole intro is the personality; the copy stays factual.

---

## Content strategy (seamless writing — Ghost-shaped from day one) **[rev3.1]**

The content model is decided by the plan (D13): v1 publishes from **local Markdown** (`src/content/seed/<series-slug>/*.md` → commit → auto-redeploy), and the same routes cut over to **Ghost** in Phase G whenever the droplet is ready — nothing authoring-side changes underneath the URLs. I create content in two recurring **series**, plus standalone articles:

1. **Developer Horror Stories** — war stories: the 3 a.m. production incident, the migration that went sideways, the bug that haunted me. Entertaining, teachable, shareable.
2. **Project Breakdowns** — long-form technical articles deconstructing how I actually built things: how RollTrack's attendance analytics work, how the cal.com fork was cut down for SAHA, how SAHA Meet's LiveKit deployment stays HIPAA-appropriate.

**The seamless workflow I want:**
- **Seed mode (v1):** write a Markdown file, drop it in the series directory, commit → the site redeploys automatically.
- **Ghost mode (after cutover):** write the post in Ghost, drop it into the right **series** (Ghost internal tag, e.g. `#series: developer-horror-stories`), hit publish.
- On the site: the post appears on the blog index, inside its series page (`/series/developer-horror-stories/`), in the series navigation, and in RSS — with correct `Article` JSON-LD, series breadcrumbs, and OG images.
- I never touch code or config to publish a post. No YAML front matter by hand, no redeploy dance. Adding a *new* series later must require at most one config entry — never a new page template.
- Draft review and scheduled publishing happen in Ghost's dashboard. (Ghost's own preview renders Ghost's theme, not this site — an on-site headless draft preview is a non-goal for v1.)

**The UCI feature article — introduce as earned third-party proof, not self-promotion:**
- Placement: an "In the press" treatment on the About page and a subtle "As featured by UC Irvine" chip on the homepage. Link card with the headline: *"From Project Expo to CTO: Alumnus Christopher Tapia Kicked His Career Into High Gear."*
- Narrative framing: it anchors the career arc the site tells — first-gen student tinkering with swap-meet computer parts → informatics at UC Irvine → 2025 Project Expo capstone → co-founder & CTO. Pull one authentic quote (e.g., *"The expo kind of became my career."*) with attribution and link out.
- Never paste the full article (copyright); quote briefly, link generously.

---

## Code organization & clean code requirements

The current repo is a dated Next.js site; the revamp is a fresh Astro scaffold (astro-sphere as structural reference only, per plan.md D1) and must end up **organized like a product, not a template dump**:

- **Clean code principles throughout** (see the `clean-code` skill): small single-purpose functions, intention-revealing names, error handling at boundaries, no dead code, no `any`, comments only where they earn their place.
- **Abstract away components:** UI primitives (Button, Card, Chip, Badge, SectionHeading) live in `src/components/ui/`; composed features (ProjectCard, SeriesCard, PostCard, WormholeStage, SoundToggle, PressCard) build on those primitives; page layouts consume features only. No feature reaches into primitives' internals.
- **Content layering:** a typed adapter boundary owns all Ghost access (`src/lib/ghost/` — focused modules behind one typed facade + typed content collections). Pages never call the Ghost API directly — they consume the adapter's typed outputs. This is what makes CMS swaps, caching, and offline snapshots possible.
- **Separation:** content (data) / components (presentation) / layouts (structure) / lib (logic) / styles (tokens) — each folder has one job.

---

## Non-negotiable engineering requirements

1. **JS-disabled resilience:** every dynamic region (blog list, blog post body, project cards) renders meaningful static HTML at build time, or shows a designed, actionable error state — never a blank hole or spinner forever. The nav, case studies, contact info, and CV must be 100% functional with JavaScript off.
2. **CDN failure resilience:** Ghost content and any third-party embeds get build-time snapshots cached locally; if the Ghost API is unreachable at build time, the last successful snapshot is used and the build succeeds (stale-content-with-timestamp beats failed deploy). Runtime embeds degrade to static previews.
3. **Backups & recovery:** the Ghost instance and site content get automated backups (nightly DB export + config, retained versions documented), the site itself is restorable from git + build (any static host), and media assets in the repo/CDN are mirrored. Document the restore procedure in the repo README.
4. **SEO-native:** every page has unique title/description, canonical URL, OG/Twitter cards, JSON-LD, sitemap.xml, robots.txt, RSS feed; blog posts get `Article` schema with authorship pointed at my `Person` schema. Lighthouse SEO ≥ 98, Performance ≥ 90 on mobile.
5. **Accessibility:** WCAG AA. Skip intro, sound toggle, reduced-motion paths, focus management, contrast baked into `DESIGN.md` tokens.
6. **TypeScript strict**; no `any` in committed code.
