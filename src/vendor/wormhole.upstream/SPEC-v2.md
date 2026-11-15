# Wormhole v2: "Storm Vortex" intro + ambient background (spec)

Version label: **v2.0.0**. v1 ("Temporal Drift", the streak tunnel) stays available as `look="classic"`.

## 1. Vision
The visitor arrives on the portfolio and falls into a churning storm tunnel: dense, billowing clouds in slate blue, teal and steel grey, darkening toward the edges. At the far end sits a violet-indigo swirl. White-violet lightning cracks through the clouds and lights them from inside.

A **purple retro desktop computer** comes tumbling down the tunnel: a boxy CRT monitor with a glowing screen, sitting on its base, with a keyboard and a mouse trailing on their cables. A bolt strikes it, and it spins away and is knocked off course. It disappears into the swirl. From the depths, the visitor's **name rises as a heavy, brushed-steel 3D title**. Lightning flashes behind it, it holds, and then it dissolves back into the clouds.

The storm then calms. The camera slows to a gentle drift, and the whole effect settles into a **dim, translucent background** behind the real portfolio content. Lightning becomes rare and soft. The background never fights the text.

This is an original piece "in the spirit of" a classic sci-fi title sequence. It contains no police box, no show logo or wordmark, no show font, no music and no show or actor names, in code, comments, metadata or assets.

## 2. The two modes

### Intro (plays when the page is entered)
- Full-screen and above the page.
- About 10 s long. The visitor can skip it at any time (see §4).

### Ambient (the steady state)
- The same storm tunnel, slowed to about 0.25× speed.
- Lower saturation, drawn as a background layer with **opacity ~0.4**, which can be configured.
- The calm zone behind centred text stays on.
- The computer and title are gone.
- Lightning is optional, with at most one soft bolt every 8–15 s, and with no full-screen flash.
- **Readability rule:** composited behind body text, body text must keep at least 4.5:1 contrast (WCAG AA) in every ambient frame, at default settings. Headings must also keep at least 4.5:1.

## 3. Intro timeline (director keyframes, all times configurable in one table)
| t (s) | Beat |
|---|---|
| 0.0–0.8 | Fade from black. The camera rushes forward at 2.5× speed. |
| 0.8–2.5 | The computer appears far down the tunnel and tumbles toward the camera, drifting on a slow spiral. |
| 2.5 | **Strike 1.** A branched bolt from the top of the screen hits the computer. Clouds flash. The computer gets an angular kick and a sideways shove, handled by spring-damper physics with no teleporting. |
| 2.5–5.0 | The computer spins away, falls back into the swirl, and shrinks into the centre. |
| 4.2 | Strike 2. A smaller ambient bolt, which doesn't hit anything. |
| 5.0–6.0 | The title emerges from the centre: scaling up, moving toward the camera, rim-lit violet. |
| 6.0 | Strike 3, behind the title. The clouds light up and silhouette the title. |
| 6.0–7.8 | The title holds with a slow push-in. |
| 7.8–9.0 | The title dissolves (alpha plus a slight forward fly-through). Speed eases down. |
| 9.0–10.0 | Hand-off: the effect crossfades into ambient and the intro overlay fades away. |

**Safety caps for lightning flashes:**
- Flashes are at least 1.0 s apart, which is under 3 per second, meeting WCAG 2.3.1.
- No flash covers more than 25% of the screen at full brightness.
- A flash is a fast rise of 60 ms and an eased decay of 350 ms or more, never a hard square on/off.

## 4. Toggles (so the owner can decide what they like)
Every toggle is an element attribute and a controller method, and every one works live:

| Attribute | Default | What it does |
|---|---|---|
| `look` | `storm` | `storm` (v2) or `classic` (v1 streak tunnel) |
| `intro` | `once` | `once` plays once per browser session (sessionStorage, guarded with try/catch); `always`; `off` |
| `computer` | on (`computer="off"` hides) | The purple computer actor |
| `logo` | on (`logo="off"` hides) | The 3D title |
| `logo-text` | `CHRISTOPHER TAPIA` | Title text, at most 32 characters, rendered uppercase |
| `lightning` | `on` | `on`, `intro-only` or `off` |
| `ambient-opacity` | `0.4` | 0.15–0.8 |
| `computer-color` | `#7b3fe4` | Hex colour for the computer's case |

Plus the v1 attributes (`theme`, `speed`, `intensity`, `quality`, `paused`, `calm`, `fixed`, ...).

**Controller methods** (new): `skipIntro()`, `replayIntro()`, `setLook()`, `setComputer(bool)`, `setLogo(bool)`, `setLogoText(str)`, `setLightning(mode)`, `setAmbientOpacity(n)`.

**Events** (new): `wormhole:introstart`, `wormhole:introend` (`detail: { skipped }`).

The demo page gets a small "Effect settings" panel. It has switches for Computer, Title, Lightning, Look (Storm/Classic) and Ambient opacity, plus a **Replay intro** button, so the owner can try each option.

## 5. Intro overlay behaviour (inside the element, so it stays drop-in)
- **Layout:** during the intro the element renders as `position: fixed; inset: 0; z-index: 2147483000` and covers the page. Afterwards it returns to its normal background placement.
- **Controls:**
  - A visible **Skip intro** button in the corner. It's real text, at least 44 px tall, and gets focus when the intro starts.
  - `Esc` skips too.
  - When the intro ends, focus returns to where it was.
  - A visually hidden live region announces "Intro playing. Press Escape or Skip to continue to the site."
- **Accessibility:**
  - While the overlay is up, page scrolling is not locked, but the overlay intercepts pointer input. Clicks behind it do nothing.
  - **Reduced motion:** the intro never plays and there is no lightning. Show one still ambient frame.
  - If WebGL is unavailable, there is no intro. Show the CSS fallback gradient in ambient mode.
- **Safety net:** the intro must always end, whether it finishes, is skipped, the tab is hidden for more than 2 s (it ends immediately, so the visitor never returns to a half-played intro), or an error occurs. A watchdog ends it after 14 s no matter what.

## 6. Visual building blocks

**Storm clouds (new fragment shader, `shaders/storm.glsl.js`)**
- Same polar tunnel mapping as v1 (`depth = k / r`, short-side normalisation, seamless circle sampling).
- **Domain-warped fBm.** Warp the sample point with a second fBm before the main one, which gives billowing cauliflower shapes instead of smooth bands. Low twist, so it reads as cloud, not spiral.
- **Fake volumetric lighting.** Take two fBm samples a small step apart along the light direction. The difference gives a cheap self-shadow (darker undersides) and silver-lined edges.
- **Palette** (theme `storm`):

  | Role | Colour |
  |---|---|
  | deep | `#05080d` |
  | cloud dark | `#1d2f3d` |
  | cloud mid | `#4d6b7d` |
  | cloud light | `#a9bfcc` |
  | core swirl | `#5b4bb3`, violet-indigo |
  | lightning | `#efe9ff` |

- **Core swirl.** The centre has a tighter twisting violet vortex: higher twist, plus a ring-shaped fold term.
- **Lightning illumination.** Uniforms `uFlash` (0–1) and `uFlashPos` (screen space). The flash brightens the clouds with a soft radial falloff from the bolt, tinted violet-white. The ambient flash cap is 0.25.
- **Ambient grading.** Uniforms `uAmbient` (0–1) desaturate by about 40%, lower contrast, and darken toward the page background.
- **Quality.** Octaves are adaptive per quality tier: high 5, medium 4, low 3. The warp is skipped on low.

**Lightning (`entities/LightningEntity.js`)**
- **Path.** Bolts are generated in JS when they spawn, never per frame. Recursive midpoint displacement creates the main channel, with 1–3 branches that taper.
- **Rendering.** Each bolt is a camera-facing ribbon mesh with additive blending. It has a hot white core and a violet glow falloff done in the shader across the ribbon width.
- **Life cycle.** About 220 ms visible, with a 2–3 frame flicker on the main channel (amplitude ≤ 30%), then fade.
- **Memory.** A pool of 4 bolts with preallocated buffers, so nothing is allocated while bolts play.
- **Targeting.** A bolt can target a world point (the computer), or end at a random point inside the cloud wall.

**Purple computer (`entities/ComputerEntity.js`)**, built only from three.js primitives, with no model files:
- **Monitor.** A CRT box: the front bezel box, plus a tapered back housing built as a frustum by scaling a box's back vertices. It sits on a slim base box and stand.
- **Screen.** An inset plane with emissive glow. Its CanvasTexture is drawn once: a green-on-black prompt `> hello world_` plus scanlines. A cursor blink is driven by a uniform, under 2 Hz.
- **Keyboard.** A wedge base, with keys as one `InstancedMesh` of small boxes laid out in rows (about 60 keys).
- **Mouse.** A capsule.
- **Cables.** Two `TubeGeometry` cables from the keyboard and the mouse to the monitor. Each is rebuilt only when the rig is created; during motion the parts move as one rigid group with a slight lag on the keyboard and mouse, using spring followers.
- **Materials.** `MeshStandardMaterial`:
  - Case: purple (`computer-color`), roughness 0.55, metalness 0.1.
  - Keys: lighter lavender.
  - Lighting: a hemisphere light (cloud colours) plus one point light that moves to and pulses with each lightning strike.
- **Physics.** The tumble uses a tiny rigid-body integrator (angular velocity plus position spring-damper). A strike adds an impulse proportional to the bolt's direction.

**3D title (`entities/LogoEntity.js`)**
- Fonts can't be fetched in sandboxed hosts, and three's FontLoader uses fetch. So the title is built from a canvas, not from font geometry:
  1. Wait for `document.fonts.load('900 128px "Michroma"')` (or the configured font, with a system-ui fallback after 1.5 s).
  2. Draw the text into an offscreen canvas as an alpha mask.
- **Fake extrusion.** The mask is stacked in about 24 thin layers along z. The front layer uses a brushed-steel shader: a vertical gradient, anisotropic streak noise, and a bevel highlight from the mask's alpha gradient, which acts as a normal. The back layers are darker steel.
- **Lighting.** The title responds to `uFlash` with a violet rim light from behind.
- **Memory.** All layers share one texture and one geometry, and are drawn as a single `InstancedMesh`, so a draw call or two at most.
- **Fit.** The text is scaled to fit 80% of the short side, and wraps to two lines (first name / last name) on portrait screens.

**Camera**
- A `PerspectiveCamera` for the actors. The tunnel stays a screen-space quad, so it's drawn first, then the actors scene. `autoClear` is false.
- The actors' depth is mapped to match the tunnel's `depth = k / r`, so objects visually sit "in" the tunnel.

## 7. Architecture (extends v1; same rules)
```
wormhole/
  element.js              + intro overlay, Skip button, new attributes/events
  index.js                createVortex() unchanged signature; new options validated in config.js
  config.js               + LOOKS, storm theme, intro timeline table, new option validation
  App.js                  + two render passes, look switching, owns Director
  director/IntroDirector.js  pure timeline: phases, easing, cue firing (strikes, title in/out),
                             skip/finish/watchdog. No three.js imports, so it's unit-tested.
  director/LightningScheduler.js  pure: decides when ambient bolts fire (min gaps, flash caps)
  core/...                (v1 services reused unchanged where possible)
  entities/
    TunnelEntity.js       v1 classic look
    StormEntity.js        v2 storm look (shaders/storm.glsl.js)
    StreaksEntity.js      used by classic look only
    LightningEntity.js    bolt pool
    ComputerEntity.js     purple computer rig + tumble physics
    LogoEntity.js         canvas-mask extruded title
  physics/Tumble.js       pure spring-damper + angular integrator (unit-tested)
  shaders/                + storm.glsl.js, lightning.glsl.js, logo.glsl.js
```
- **Look strategy.** A "look" is a small object: `{ createBackground(shared), supportsActors }`. Switching look disposes the old background entity and creates the new one, with no page reload.
- **Lifecycle contract.** Every entity keeps v1's lifecycle (`setQuality`, `setTheme`, `setIntensity`, `dispose`), plus `update(frameState)` where it needs per-frame work. There are no allocations per frame.
- **Intro director.** It emits cues; App routes them to entities. Entities never talk to each other.

## 8. Performance budget
- **Intro on high:** about 8–10 draw calls (storm, about 3 computer groups, lightning, title).
- **Ambient:** 1–2 draw calls.
- **Ambient frame cap:** 30 fps by default (`ambient-fps`, 30 or 60), to save battery. During the intro the cap is the display rate.
- **Phones** start on the medium tier. The storm shader on low must hold at least 50 fps on a mid-range Android.
- **Teardown.** Actors are disposed, freeing their geometry, textures and materials, once the intro ends. They are rebuilt only for Replay.

## 9. Acceptance checks
- [ ] Unit tests for IntroDirector (cue order, skip, watchdog, hidden-tab end, reduced motion means no intro), LightningScheduler (min gap ≥ 1 s, ambient gaps 8–15 s, no bolts when off), Tumble physics (impulse decays, stays bounded), and the new option validation. All of the v1 tests still pass.
- [ ] Shader harness compiles `storm`, `lightning` and `logo` with three r170 prefixes. It renders storm frames for intro and ambient, landscape and portrait, and asserts ambient body-text contrast ≥ 4.5:1 at the default ambient opacity, composited over the page background.
- [ ] Element smoke test (three stubbed): `intro="once"` plays then ends with `wormhole:introend`. Skip button and Esc skip. Every toggle works live. Replay works. Remove and re-add leaks no contexts. Reduced motion means no intro.
- [ ] No police box, show logo or wordmark, show names, or audio anywhere.
- [ ] v1 `look="classic"` still renders exactly as before.
