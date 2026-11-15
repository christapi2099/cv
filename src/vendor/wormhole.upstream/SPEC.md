# Spec: "Temporal Drift" infinite vortex hero (hardened)

## Vision
The visitor drifts forward through an endless tunnel of folded spacetime. Deep indigo and teal walls spiral around a dark, calm centre. Amber energy bands twist along the walls, thin lightning-like filaments crawl across them, and star streaks rush past toward the viewer. The pointer gently steers the vanishing point. Brightness is held back on purpose: the effect frames the name, title and call to action without competing with them. The design is original and makes no reference to any show.

## Visual layers (2 draw calls)
1. **Tunnel.** A full-screen quad with a procedural fragment shader.
   - Polar mapping: `depth = k / r`. Noise is sampled on a circle `(cos θ', sin θ')` so there is no atan seam.
   - fBm walls are stretched along depth so they read as spiralling streams.
   - Amber bands; ridged-noise filaments using `pow(ridge, 32)`.
   - Glow comes from an in-shader core term plus a Reinhard tone map. There is no post-processing.
2. **Streaks.** `THREE.Points` with a fixed buffer.
   - Depth is `mod(seed·range − offset, range)`, so the CPU does no work per point.
   - They use the same projection and twist as the tunnel, so the streaks ride the walls.
   - Sprites are stretched radially, with additive blending.
3. **Motion.** Eased pointer parallax plus a low-frequency sway, both applied as a vanishing-point offset.

**Infinite travel** is one scalar, `offset`. It wraps at 4096, which is a multiple of the streak range, so the streaks are seamless. **Flash safety:** shimmer stays under 1 Hz at speed 1 and under 3 Hz at maximum speed, which satisfies WCAG 2.3.1.

## Architecture
See README. The rules:
- Dependencies point one way.
- No module-level mutable state.
- Only the core services and `index.js` touch the DOM.
- There is a single run-state machine, `App.#sync()`, and `shouldRun = wantsRun && visible && !contextLost && !reducedMotion`.

## Public API
**Drop-in:** the `<wormhole-bg>` custom element, from `wormhole/element.js`. It uses Shadow DOM and is decoupled from the host page.

**Programmatic:** `await createVortex(el, options)` returns `{ supported, start, stop, setSpeed, setTheme, setQuality, setIntensity, dispose, state }`.

## Hardening (as built)
- **Reduced motion:** renders one still frame with no rAF loop and no parallax, and reacts live to the setting changing.
- **No WebGL 2, CDN failure, init exception or shader compile/link error:** adds `fallbackClass`, returns an inert handle, and never throws to the page. A shader error is caught through `renderer.debug.onShaderError`.
- **Context lost/restored:** the loop pauses, and three.js re-uploads its resources on restore.
- **Pausing:** stops when the page is hidden or the hero is out of view. When it resumes, `dt` is 0, so nothing jumps.
- **Frame timing:** `dt` is clamped to 50 ms. While the loop is stopped, a still frame is drawn after any resize, theme or tier change.
- **Pixel ratio:** `min(devicePixelRatio, maxDpr, tier cap)`. A DPR change (moving to another monitor, zooming) triggers a resize.
- **Adaptive quality:** learns the display's refresh interval, so 60 Hz and 120 Hz screens are judged correctly. It steps down at more than 1.35× the refresh interval for 1.5 s, and up at under 1.1× for 6 s, with a 30 s cooldown. It never re-tries a tier it stepped down from. Changing the point count only changes `setDrawRange`; nothing is reallocated.
- **dispose():** idempotent. One AbortController removes all listeners; observers are disconnected; geometries, materials and the renderer are disposed; `forceContextLoss()` is called and the canvas is removed.
- **Errors:** an exception inside a frame stops the effect and shows the fallback, so the console isn't flooded with one error per frame. If a user's `onQualityChange` callback throws, it is isolated from the effect.
- **Options:** validated, clamped and frozen, with warnings for unknown keys and bad values.

## Deviations from the first draft (and why)
- **WebGL 2 only:** three.js r163 and later dropped WebGL 1.
- **DPR caps per tier are 1, 1.25 and 1.5, not up to 2:** the shader is smooth, so the extra pixels cost GPU time without visible gain.
- **Adaptive thresholds are relative to the learned refresh interval:** a fixed "<12 ms to upgrade" rule can never trigger on a 60 Hz display.
- **`createVortex` is async:** it lazy-loads three.js, so a CDN failure becomes a fallback rather than a module-graph crash.

## Review round (independent agent): fixed
- **Shader failure before the handle exists:** `init()` now awaits `compileAsync`, so a shader failure yields the inert fallback handle, and `supported` is a getter.
- **30 Hz-capped displays:** these were being degraded permanently. A probe now steps down and checks whether frames got faster; if they didn't, it restores the original tier and learns the display's cadence.
- **GLSL:** reversed `smoothstep` edges, `pow` of a negative base, and clipped streak sprites are fixed.
- **Rendering errors:** every render is guarded, not just loop frames.
- **GPU choice:** `powerPreference: 'default'` and `failIfMajorPerformanceCaveat: true`.
- **Context loss:** a context that is never restored shows the fallback.
- **Pure, tested state:** `RunState` and `resolveIntensity` are extracted and unit-tested.
- **Contrast:** a calm zone is added, and the harness now asserts AA contrast with the scrim composited in.
- **Small fixes:** shader logs are taken from the shader objects, `autoClear` is off, the dead clear colour is removed, `forceContextLoss` is skipped when the context is already lost, the still frame recentres under reduced motion, and the demo has a fixed accessible label for the pause toggle.

## Mobile and decoupling
- **Orientation:** framing is normalised to the short side, the vignette and calm zone are aspect-aware, and touch steering recentres on `pointerup` and `pointercancel`.
- **Packaging:** the library lives in `wormhole/` with no reference to the demo, and is delivered as a custom element.

## Acceptance checks
- [x] Shaders compile and link with three r170's GLSL3 prefixes, verified in headless Chrome with `tests/run-harness.py`.
- [x] 2 draw calls; 0 textures.
- [x] No allocations in `#advance`, `#render` or `update`.
- [x] 18 unit tests cover option validation, adaptive quality (slow from the start, 60 and 120 Hz stability, no oscillation, 30 Hz cap, vsync quantisation), RunState, the loop's `dt` behaviour, and visibility logic.
- [x] Landscape and portrait frames are rendered, and body text is at least 4.5:1 in every frame, including the worst-case palette at intensity 1.
- [x] The CDN-failure fallback is verified in headless Chrome at phone sizes.
- [ ] Still to check on real devices: frame rate on mid-range phones, overlay contrast with your own copy, and a 10-minute heap snapshot.
