/**
 * Programmatic API. (For a zero-code drop-in, use the <wormhole-bg> element
 * from ./element.js instead.)
 *
 *   import { createVortex } from './wormhole/index.js';
 *   const vortex = await createVortex(document.querySelector('#hero-bg'), { theme: 'vortex' });
 *
 * three.js is loaded lazily (bare specifier 'three': resolved by an import map
 * or your bundler). If it can't load, WebGL 2 is missing, or a shader fails,
 * this still resolves — to an inert handle — and the container gets the
 * fallback class. It never throws for runtime problems.
 */
import {
  DEFAULTS, INTRO_TIMELINE, LIGHTNING, QUALITY_TIERS, STORM_PALETTE, THEMES, validateOptions,
} from './config.js';
import { detectWebGL2 } from './core/featureDetect.js';

export { DEFAULTS, INTRO_TIMELINE, LIGHTNING, QUALITY_TIERS, STORM_PALETTE, THEMES };

const warn = (message) => console.warn(`[wormhole] ${message}`);

function createInertHandle(reason, options) {
  const noop = () => {};
  const state = Object.freeze({
    running: false, tier: null, speed: 0, intensity: 0, visible: false, reducedMotion: false,
    contextLost: false, failed: true, disposed: false, reason,
    look: options.look, intro: 'idle', introMode: options.intro, computer: options.computer, logo: options.logo,
    logoText: options.logoText, lightning: options.lightning, ambientOpacity: options.ambientOpacity,
    ambientFps: options.ambientFps, computerColor: options.computerColor,
  });
  return Object.freeze({
    supported: false,
    start: noop, stop: noop, setSpeed: noop, setTheme: noop,
    setQuality: noop, setIntensity: noop, dispose: noop,
    // v2: no intro ever plays without WebGL; replayIntro() reports false.
    skipIntro: noop, replayIntro: () => false, setLook: noop, setIntro: noop, setComputer: noop,
    setLogo: noop, setLogoText: noop, setLightning: noop, setAmbientOpacity: noop,
    setAmbientFps: noop, setComputerColor: noop,
    get state() { return state; },
  });
}

function fallBack(container, options, reason) {
  warn(`${reason}; showing fallback.`);
  container.classList.add(options.fallbackClass);
  return createInertHandle(reason, options);
}

/**
 * @param {Element} container  positioned element the canvas fills
 * @param {object} [options]   see DEFAULTS in config.js
 * @returns {Promise<{ readonly supported: boolean, start(): void, stop(): void,
 *   setSpeed(n: number): void, setTheme(t: string|object): void, setQuality(q: string): void,
 *   setIntensity(n: number): void, dispose(): void, readonly state: object,
 *   skipIntro(): void, replayIntro(): boolean, setLook(l: 'storm'|'classic'): void,
 *   setIntro(m: 'once'|'always'|'off'): void, setComputer(b: boolean): void, setLogo(b: boolean): void,
 *   setLogoText(s: string): void, setLightning(m: 'on'|'intro-only'|'off'): void,
 *   setAmbientOpacity(n: number): void, setAmbientFps(n: 30|60): void, setComputerColor(hex: string): void }>}
 * @throws {TypeError} (as a rejection) when `container` is not an Element
 */
export async function createVortex(container, options = {}) {
  const doc = container?.ownerDocument;
  const win = doc?.defaultView;
  if (!win || !(container instanceof win.Element)) {
    throw new TypeError('createVortex(container): container must be a DOM Element.');
  }

  const validated = validateOptions(options, warn);

  if (!detectWebGL2(doc).supported) {
    return fallBack(container, validated, 'Hardware-accelerated WebGL 2 is unavailable');
  }

  let App;
  try {
    ({ App } = await import('./App.js'));
  } catch (error) {
    return fallBack(container, validated, `Could not load three.js (${error?.message ?? error})`);
  }

  let app;
  try {
    app = new App(container, validated, { win, doc, warn });
  } catch (error) {
    return fallBack(container, validated, `Initialisation failed (${error?.message ?? error})`);
  }
  // init() compiles shaders first, so a compile failure is known before we return.
  return (await app.init()) ? app.handle : fallBack(container, validated, 'Shader setup failed');
}
