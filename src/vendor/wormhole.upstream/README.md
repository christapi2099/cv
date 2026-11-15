# Wormhole background: Storm Vortex (v2) and Temporal Drift (classic)

A background effect you can drop into an existing portfolio. It's built with three.js r170 and plain ES modules, and it needs no build step.

- **v2 "Storm Vortex" (default, `look="storm"`).** A storm vortex intro plays when a visitor arrives. They fall through a churning tunnel of slate-blue storm clouds toward a violet swirl, while a purple retro desktop computer tumbles past, gets struck by lightning and spins away. Then your name rises as a brushed-steel 3D title. After about 10 s the storm settles into a dim, translucent background behind your page.
- **v1 "Temporal Drift" (`look="classic"`).** The original streak tunnel, unchanged.

Everything is procedural: there are no model files, no font files, no textures and no audio. The design is original and uses no show assets, names or logos.

**The effect is decoupled from your site.** Everything lives in `wormhole/`. It doesn't read or change your page's CSS, globals or DOM outside its own element. The one exception is an optional font `<link>`, described under [Content Security Policy and fonts](#content-security-policy-and-fonts). `index.html` is only a sample portfolio that uses it.

## Drop it into your existing portfolio (3 steps)

**1. Copy the `wormhole/` folder** into your site, for example `public/wormhole/` or `static/wormhole/`.

**2. Make `three` resolvable.**
- **Plain HTML site:** add this import map once, in `<head>`:
  ```html
  <script type="importmap">
    { "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js" } }
  </script>
  ```
- **Vite, Next, Astro or another bundler:** run `npm i three@0.170.0` and skip the import map.

**3. Add the element.** For the v2 experience (intro, then a full-page ambient background):
```html
<script type="module" src="/wormhole/element.js"></script>
<wormhole-bg fixed intro="once" logo-text="Your Name"></wormhole-bg>
```
For a hero-only background, put it as the first child of a positioned hero:
```html
<section class="hero" style="position: relative; isolation: isolate;">
  <wormhole-bg></wormhole-bg>
  <!-- your existing hero content, unchanged -->
</section>
```
The element styles itself inside Shadow DOM and sits behind your content with `z-index: -1`, so it never captures clicks. The only exception is while the intro plays, when it covers the page. It cleans up after itself when it's removed from the page.

### Frameworks
**React 19 / Next.js (App Router).** Load the element on the client only:
```jsx
'use client';
import { useEffect } from 'react';
export default function WormholeBg(props) {
  useEffect(() => { import('../wormhole/element.js'); }, []);
  return <wormhole-bg fixed intro="once" {...props} />;
}
```
On React 18, pass attributes as strings, and listen for events with `ref.current.addEventListener`.

**Vue, Svelte and Astro.** Use `<wormhole-bg>` directly. In Vue, set `compilerOptions.isCustomElement = (tag) => tag === 'wormhole-bg'`. In Astro, put the script import in a `<script>` tag.

**Importing on the server is safe.** `element.js` defines nothing when there's no DOM.

**Tag name clashes.** If `wormhole-bg` is already taken, import `{ defineWormhole }` and call `defineWormhole('my-tag')`.

## v2: the storm vortex intro and ambient mode

**Intro (about 10 s, skippable at any time).** All the beat times live in one table, `INTRO_TIMELINE` in `config.js`.

| Time (s) | Beat |
|---|---|
| 0–0.8 | Fade from black, with a 2.5× rush. |
| 0.8–2.5 | The computer appears far away and tumbles toward you on a slow spiral. |
| 2.5 | Strike 1 hits it: the clouds flash, and spring-damper physics kick it. |
| 4.2 | Strike 2, an ambient bolt. |
| 5–6 | The title rises from the centre. |
| 6.0 | Strike 3, behind the title. |
| 7.8–9 | The title dissolves forward. |
| 9–10 | Crossfade into ambient. |

**Ambient (the steady state).**
- The same storm at 0.25× speed.
- The colours are graded down: about 40% less saturation, lower contrast and darker.
- It's drawn at `ambient-opacity` (default 0.4).
- It's capped at 30 fps to save battery.
- The calm zone behind centred text stays on.
- At most one faint bolt every 8–15 s, with no full-screen flash.

At the default settings, body text (`#c6d2e8`) and headings (`#eef4ff`) stay at 4.5:1 or better against **every pixel** of every ambient frame, including frames with a flash. This is measured by `tests/run-harness.py` over a `#05080d` page.

**Overlay behaviour while the intro plays.**
- The element covers the page (`position: fixed; z-index: 2147483000`). Clicks behind it do nothing, but scrolling isn't locked.
- A real **Skip intro** button (44 px or taller) takes focus. `Esc` also skips, and so does tabbing past the button into the page.
- When the intro ends, focus goes back to where it was.
- A visually hidden live region announces "Intro playing. Press Escape or Skip to continue to the site."

**The intro always ends.** It ends when:
- it finishes, or the visitor skips it;
- `paused` is set or `intro="off"`;
- the look switches to classic;
- the tab is hidden for more than 2 s (it ends immediately, so the visitor never returns to a half-played intro);
- a WebGL error occurs or the context is lost;
- the element is removed;
- or, no matter what, a 14 s wall-clock watchdog fires.

**It never plays when:**
- reduced motion is on (a still ambient frame is shown, with no lightning);
- WebGL is unavailable (the CSS fallback is shown, dimmed to ambient opacity);
- three.js fails to load;
- the look is `classic`;
- or, with `intro="once"`, it already played in this browser session (stored in `sessionStorage`, with every access guarded; if storage is blocked the intro may play again).

**Lightning safety (WCAG 2.3.1).**
- Flash starts are at least 1 s apart, whatever asks for them. This is enforced by `LightningScheduler` and unit-tested.
- Each flash is a smooth 60 ms rise and a 420 ms eased decay, never a hard on/off.
- The cloud flash is a soft radial glow. In the harness it brightens about 3–4% of the screen by more than half its peak, against a 25% cap.
- Ambient flashes are capped at 0.25.
- There's no lightning at all under reduced motion.

### What you can turn off
| You want… | Do this |
|---|---|
| No intro at all | `intro="off"` |
| The intro on every page load | `intro="always"` |
| No computer | `computer="off"` |
| No 3D title | `logo="off"` (this also skips the font link) |
| Lightning in the intro only | `lightning="intro-only"` |
| No lightning, ever | `lightning="off"` |
| A dimmer or brighter background | `ambient-opacity="0.15"` … `"0.8"` |
| A smoother background (more battery) | `ambient-fps="60"` |
| The v1 streak tunnel instead | `look="classic"` (no intro, full opacity, exactly v1) |
| No animation | `paused`, or the visitor's reduced-motion setting |
| No font `<link>` added to `<head>` | `no-font-link` (the title then uses a heavy system font) |

## Element API
| Attribute | Live? | Default | Notes |
|---|---|---|---|
| `look` | yes | `storm` | `storm` (v2) or `classic` (v1) |
| `intro` | yes | `once` | `once` (per browser session), `always`, `off`; `off` ends a playing intro |
| `computer` | yes | on | `computer="off"` hides the computer |
| `logo` | yes | on | `logo="off"` hides the title |
| `logo-text` | yes | `CHRISTOPHER TAPIA` | Up to 32 characters, shown in uppercase |
| `lightning` | yes | `on` | `on`, `intro-only`, `off` |
| `ambient-opacity` | yes | `0.4` | 0.15–0.8 |
| `ambient-fps` | yes | `30` | `30` or `60`; the intro always runs at the display rate |
| `computer-color` | yes | `#7b3fe4` | Hex colour of the computer's case |
| `theme` | yes | `vortex` | Classic look: `vortex`, `nebula`, `emerald` or `storm` |
| `speed` | yes | `1` | 0–4; ambient storm runs at 0.25× this |
| `intensity` | yes | `0.8` | 0–1; brightness cap |
| `quality` | yes | `auto` | `auto`, `low`, `medium` or `high` |
| `paused` | yes | absent | Boolean; also ends a playing intro |
| `calm` | on connect | `0.6` | 0–1; dims bright detail behind centred text |
| `sway` | on connect | `0.15` | 0–1; idle drift |
| `max-dpr` | on connect | `2` | 1–2 |
| `no-parallax` | on connect | absent | Turns off pointer and touch steering |
| `fixed` | on connect | absent | Full-viewport background |
| `no-font-link` | on connect | absent | Don't add the title font stylesheet |

Invalid values never throw. They're replaced by the default, or the current value, with a `[wormhole]` console warning.

**Properties**
- `el.controller`: the handle, or `null` until the effect is ready.
- `el.ready`: a Promise that resolves with the handle.

**Controller methods.** These are the same as the attributes, and they're also available on the programmatic handle.
- v1: `start()`, `stop()`, `setSpeed(n)`, `setTheme(name | {deep, mid, energy, filament, star})`, `setQuality(q)`, `setIntensity(n)`, `dispose()`, `state`.
- New in v2:
  - `skipIntro()` and `replayIntro()`. `replayIntro()` returns `false`, and plays nothing, under reduced motion, under the classic look, or while paused.
  - `setLook('storm' | 'classic')`
  - `setIntro('once' | 'always' | 'off')`
  - `setComputer(bool)`, `setLogo(bool)` and `setLogoText(str)`
  - `setLightning('on' | 'intro-only' | 'off')`
  - `setAmbientOpacity(n)` and `setAmbientFps(30 | 60)`
  - `setComputerColor(hex)`

`state` now also includes `look`, `intro` (`playing`, `pending` or `idle`), `introMode`, `computer`, `logo`, `logoText`, `lightning`, `ambientOpacity`, `ambientFps` and `computerColor`.

**Events.** All of them bubble and are composed:
- `wormhole:ready` → `{ supported, controller }`
- `wormhole:statechange` → `state`
- `wormhole:qualitychange` → `{ tier }`
- `wormhole:introstart` → `{}` (new)
- `wormhole:introend` → `{ skipped, reason }` (new). `reason` is one of `complete`, `skip`, `watchdog`, `hidden`, `error`, `disabled` or `disposed`. When the element is removed mid-intro, the event fires on the now-detached element, so listen on the element itself for that case.

**Styling hooks.** Use `wormhole-bg::part(stage)`, `::part(intro)` and `::part(skip)`. You can also style `wormhole-bg[data-intro]` while the intro is up. The CSS fallback uses the look's colours automatically.

### Programmatic API (without the element)
```js
import { createVortex } from '/wormhole/index.js';
const vortex = await createVortex(containerEl, {
  look: 'storm', intro: 'once', logoText: 'Your Name', ambientOpacity: 0.4,
  onIntroStart: () => {}, onIntroEnd: ({ skipped, reason }) => {},
});
vortex.replayIntro(); vortex.setLightning('off'); vortex.dispose();
```
`createVortex` never throws for runtime problems, which are missing WebGL 2, a three.js load failure, a shader error or a lost GPU context. In those cases it adds a fallback class to the container and returns a handle where `supported` is `false` and every method does nothing.

The programmatic API has no Skip button or overlay. Those belong to the element, so if you use `createVortex` with an intro, provide your own skip UI that calls `skipIntro()`.

### Content Security Policy and fonts
Everything is generated in code, so the effect needs no `fetch`, XHR, model, texture or font JSON. Only two things load from elsewhere:
- **Scripts:** three.js, from the import map (`cdn.jsdelivr.net/npm`).
- **Title font:** the title is drawn into a canvas with the Michroma font. `@font-face` rules don't apply inside Shadow DOM, and canvas text uses document fonts. So, once per document, the element adds one `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Michroma&display=swap" data-wormhole-font>` to `document.head`. It skips this if any link for that family already exists, or if you set `no-font-link` or `logo="off"`. If the font isn't ready within 1.5 s, the title uses a heavy system font, such as Arial Black.

## What it handles for you
- **Portrait and landscape.** Framing is normalised to the short side. On portrait screens the title wraps to two lines (first name and last name), and the camera's field of view is fixed across the short side, so the actors frame the same way.
- **Pausing.** The loop pauses when the tab is hidden or the element is offscreen, and resumes with no jump.
- **Adaptive quality.**
  - Quality learns the display's refresh rate.
  - Under the ambient 30 fps cap, the cap interval is the reference, so on-time capped frames never look slow.
  - Phones start on the medium tier.
  - The storm uses 5, 4 or 3 octaves by tier, and skips the domain warp on low.
- **Teardown.** The computer and title are built when an intro starts and disposed when it ends, which frees their geometry, materials and textures. They're rebuilt only for a replay. `dispose()` frees everything, including the WebGL context.

## Layout of `wormhole/`
```
element.js              <wormhole-bg>: Shadow DOM, attributes, events, intro overlay + Skip
index.js                createVortex(); lazy-loads three, turns failures into a fallback
config.js               defaults, themes, storm palette, intro timeline, lightning caps, validation (pure)
App.js                  composition root: two render passes, looks, director/cue routing, lifecycle
looks.js                look strategies: storm | classic
director/
  IntroDirector.js      pure timeline: cues, choreography, skip / watchdog / hidden-tab end
  LightningScheduler.js pure flash policy: ≥ 1 s gaps, envelope, ambient cadence + caps
physics/Tumble.js       pure spring-damper + angular integrator, spring followers
core/                   RunState · Loop (frame cap) · QualityManager · RendererService ·
                        ResizeService · Visibility · featureDetect · fonts · introMemory
input/PointerInput.js   eased pointer and touch
entities/               FrameUniforms · TunnelEntity · StreaksEntity (classic)
                        StormEntity · LightningEntity · ActorStage · ComputerEntity · LogoEntity
                        boltPath (pure) · canvasArt (pure canvas drawing)
shaders/                noise · tunnel · streaks (classic) · storm · lightning · logo · screen
```
**Dependencies run one way:** `element → index → App → core / input / director / physics / entities → shaders / config`. The director, scheduler, physics, `boltPath` and `config` import nothing from three or the DOM.

**Budget:**

| Mode | Draw calls | Other |
|---|---|---|
| Intro | at most 8, measured with the stub: storm, the computer's case, screen, cables, keyboard, keys and mouse, plus 1 bolt; then storm, title and bolt | |
| Ambient | 1–2: storm, plus a rare bolt | 0 textures; 30 fps |
| Classic | 2, as in v1 | |

There are no allocations per frame in the update paths.

**Known limits.**
- **The travel wrap.** The offset wraps at 4,096, so the pattern cuts once in a long while: about once every 57 minutes at speed 1.
- **Cables.** The cables are built once in monitor space. During the most violent spin right after a strike, the trailing keyboard can briefly separate from its cable end.

## Develop and test
```bash
python3 -m http.server 8080        # then open http://localhost:8080
npm test                           # 47 unit tests (18 v1 + 29 v2)
python3 tests/run-harness.py       # compiles storm/lightning/logo/screen + v1 shaders with three r170's
                                   # GLSL3 prefixes in headless Chrome, renders frames to tests/out/,
                                   # asserts AA text contrast and the flash-area cap
python3 tests/smoke.py             # element smoke test with three.js stubbed (tests/three-stub.js):
                                   # intro, skip, Esc, toggles, replay, looks, leaks, reduced motion, CDN failure
```
For Android, see [ANDROID-PREVIEW.md](ANDROID-PREVIEW.md). For the history of changes, see [CHANGELOG.md](CHANGELOG.md).
