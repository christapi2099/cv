/**
 * Pure configuration: defaults, themes, quality tiers and option validation.
 * No DOM, no three.js — safe to unit-test in Node.
 */

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const THEME_KEYS = Object.freeze(['deep', 'mid', 'energy', 'filament', 'star']);

/** Colour palettes. Each key maps to a CSS hex colour (sRGB). */
export const THEMES = Object.freeze({
  vortex: Object.freeze({
    deep: '#030716',
    mid: '#0b4f7a',
    energy: '#ff7a1a',
    filament: '#ffc46b',
    star: '#bfe8ff',
  }),
  nebula: Object.freeze({
    deep: '#07031a',
    mid: '#3a1f7a',
    energy: '#ff4f8b',
    filament: '#ffd1e8',
    star: '#d9ccff',
  }),
  emerald: Object.freeze({
    deep: '#010d0b',
    mid: '#0d5c4f',
    energy: '#e8b13a',
    filament: '#fff0b8',
    star: '#c9fff0',
  }),
  // The storm palette expressed in v1 keys: lets the classic look (and the CSS
  // fallback of the storm look) use storm colours.
  storm: Object.freeze({
    deep: '#05080d',
    mid: '#4d6b7d',
    energy: '#5b4bb3',
    filament: '#efe9ff',
    star: '#a9bfcc',
  }),
});

/** Full palette of the v2 storm look (sRGB hex). */
const STORM_KEYS = Object.freeze(['deep', 'cloudDark', 'cloudMid', 'cloudLight', 'core', 'lightning']);
export const STORM_PALETTE = Object.freeze({
  deep: '#05080d',
  cloudDark: '#1d2f3d',
  cloudMid: '#4d6b7d',
  cloudLight: '#a9bfcc',
  core: '#5b4bb3', // violet-indigo swirl at the far end
  lightning: '#efe9ff',
});

/** Looks: 'storm' is v2, 'classic' is the v1 streak tunnel (unchanged). */
export const LOOK_NAMES = Object.freeze(['storm', 'classic']);
export const INTRO_MODES = Object.freeze(['once', 'always', 'off']);
export const LIGHTNING_MODES = Object.freeze(['on', 'intro-only', 'off']);
export const AMBIENT_FPS_VALUES = Object.freeze([30, 60]);
export const LOGO_TEXT_MAX = 32;

/**
 * Quality tiers, ordered cheapest → richest in TIER_ORDER.
 * dprCap: max device pixel ratio · octaves: fBm layers (classic) · points: streak count.
 * stormOctaves / stormWarp: storm clouds (the domain warp is skipped on low) ·
 * logoLayers: slices of the fake-extruded title.
 */
export const QUALITY_TIERS = Object.freeze({
  low: Object.freeze({ name: 'low', dprCap: 1, octaves: 2, points: 350, stormOctaves: 3, stormWarp: false, logoLayers: 10 }),
  medium: Object.freeze({ name: 'medium', dprCap: 1.25, octaves: 3, points: 700, stormOctaves: 4, stormWarp: true, logoLayers: 16 }),
  high: Object.freeze({ name: 'high', dprCap: 1.5, octaves: 4, points: 1200, stormOctaves: 5, stormWarp: true, logoLayers: 24 }),
});
export const TIER_ORDER = Object.freeze(['low', 'medium', 'high']);
export const MAX_POINTS = QUALITY_TIERS.high.points;

/** Tuning constants for the look and feel. Not user options. */
export const VISUAL = Object.freeze({
  depthScale: 0.5, // tunnel depth = depthScale / screenRadius
  twist: 0.32, // radians of spiral per unit depth
  spin: 0.07, // radians per second of global rotation
  travel: 1.2, // depth units per second at speed 1
  streakDepth: 16, // depth range the streaks recycle through
  streakNear: 0.3, // nearest streak depth (just past the screen edge)
  wrap: 4096, // offset wrap; a multiple of streakDepth so streaks never jump
  pointerStrength: 0.06, // max vanishing-point shift (short-side units)
  pointerEase: 3.5, // exponential easing rate for pointer
  speedEase: 2.2, // exponential easing rate for speed changes
  swayAmplitude: 0.12, // vanishing-point drift at sway = 1 (short-side units)
  maxDt: 1 / 20, // clamp so a long frame never teleports the tunnel
});

/**
 * Storm vortex intro: every beat time (seconds) in one table. IntroDirector
 * derives its cue list and choreography from this, so retiming the intro is
 * an edit here only. Times must be non-decreasing in the order listed.
 */
export const INTRO_TIMELINE = Object.freeze({
  fadeIn: 0.8, // fade from black; camera rushes at rushSpeed
  computerIn: 0.8, // computer appears far down the tunnel
  strike1: 2.5, // bolt hits the computer
  strike2: 4.2, // ambient bolt, hits nothing
  computerOut: 5.0, // computer gone into the swirl
  titleIn: 5.0, // title emerges from the centre
  strike3: 6.0, // bolt behind the title (silhouette)
  titleHoldEnd: 7.8, // title starts dissolving
  titleOut: 9.0, // title gone
  handoff: 9.0, // crossfade to ambient begins
  duration: 10.0, // intro complete
  watchdog: 14.0, // wall-clock safety net: the intro always ends by now
  hiddenLimit: 2.0, // tab hidden longer than this ends the intro
  rushSpeed: 2.5,
  cruiseSpeed: 1.0,
  outroSpeed: 0.55,
  // Flash peaks (0..1) for the three strikes.
  strike1Flash: 0.85,
  strike2Flash: 0.45,
  strike3Flash: 0.9,
});
export const INTRO_BEAT_ORDER = Object.freeze([
  'fadeIn', 'computerIn', 'strike1', 'strike2', 'computerOut', 'titleIn', 'strike3',
  'titleHoldEnd', 'titleOut', 'duration', 'watchdog',
]);

/** Lightning safety caps (WCAG 2.3.1) and ambient cadence. */
export const LIGHTNING = Object.freeze({
  minGap: 1.0, // s between flash starts: < 3 flashes per second, always
  rise: 0.06, // s, smooth rise (never a hard on/off square)
  decay: 0.42, // s, eased decay (>= 0.35 s)
  ambientGapMin: 8, // s between ambient bolts
  ambientGapMax: 15,
  ambientFlashCap: 0.25, // ambient cloud flash never exceeds this
  ambientBoltGain: 0.14, // ambient bolts are faint (text must stay AA over them)
  flashRadius: 0.24, // gaussian sigma of the cloud flash, short-side units
  boltLife: 0.22, // s visible
  boltFade: 0.12, // s tail fade after boltLife
  flickerAmp: 0.3, // main-channel flicker amplitude (<= 30%)
  poolSize: 4,
});

/** Ambient (steady-state) presentation of the storm look. */
export const AMBIENT = Object.freeze({
  speed: 0.25, // × user speed
  opacityMin: 0.15,
  opacityMax: 0.8,
  ease: 1.6, // 1/s easing of speed and grading after a skip
});

export const DEFAULTS = Object.freeze({
  speed: 1,
  theme: 'vortex',
  intensity: 0.8,
  quality: 'auto',
  maxDpr: 2,
  pointerParallax: true,
  sway: 0.15,
  calm: 0.6,
  respectReducedMotion: true,
  autoStart: true,
  fallbackClass: 'vortex-fallback',
  onQualityChange: null,
  onStateChange: null,
  // v2
  look: 'storm',
  intro: 'once',
  computer: true,
  logo: true,
  logoText: 'CHRISTOPHER TAPIA',
  logoFont: 'Michroma',
  lightning: 'on',
  ambientOpacity: 0.4,
  ambientFps: 30,
  computerColor: '#7b3fe4',
  stormPalette: STORM_PALETTE,
  onIntroStart: null,
  onIntroHandoff: null,
  onIntroEnd: null,
});

const QUALITY_VALUES = Object.freeze(['auto', ...TIER_ORDER]);

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function readNumber(value, fallback, min, max, key, warn) {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    warn(`"${key}" must be a finite number; using ${fallback}.`);
    return fallback;
  }
  const clamped = clamp(value, min, max);
  if (clamped !== value) warn(`"${key}" ${value} is outside ${min}..${max}; using ${clamped}.`);
  return clamped;
}

function readBoolean(value, fallback, key, warn) {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') {
    warn(`"${key}" must be a boolean; using ${fallback}.`);
    return fallback;
  }
  return value;
}

/**
 * Resolve a theme name or a partial colour object to a complete frozen theme.
 * Invalid colours fall back to the matching colour of the default theme.
 */
export function resolveTheme(theme, warn = () => {}) {
  const base = THEMES[DEFAULTS.theme];
  if (typeof theme === 'string') {
    if (Object.hasOwn(THEMES, theme)) return THEMES[theme];
    warn(`Unknown theme "${theme}"; using "${DEFAULTS.theme}".`);
    return base;
  }
  if (theme === null || typeof theme !== 'object') {
    warn('"theme" must be a theme name or a colour object; using default.');
    return base;
  }
  const resolved = {};
  for (const key of THEME_KEYS) {
    const value = theme[key];
    if (value === undefined) {
      resolved[key] = base[key];
    } else if (typeof value === 'string' && HEX_COLOR.test(value)) {
      resolved[key] = value;
    } else {
      warn(`theme.${key} "${String(value)}" is not a hex colour; using ${base[key]}.`);
      resolved[key] = base[key];
    }
  }
  return Object.freeze(resolved);
}

/** Runtime setter validation: anything but a finite number keeps `current`. */
function resolveRuntimeNumber(value, current, min, max, key, warn) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    warn(`"${key}" must be a finite number; keeping ${current}.`);
    return current;
  }
  return readNumber(value, current, min, max, key, warn);
}

export function resolveSpeed(value, warn = () => {}, current = DEFAULTS.speed) {
  return resolveRuntimeNumber(value, current, 0, 4, 'speed', warn);
}

export function resolveIntensity(value, warn = () => {}, current = DEFAULTS.intensity) {
  return resolveRuntimeNumber(value, current, 0, 1, 'intensity', warn);
}

function resolveEnum(value, allowed, fallback, key, warn) {
  if (allowed.includes(value)) return value;
  warn(`"${key}" must be one of ${allowed.join(', ')}; using "${fallback}".`);
  return fallback;
}

export function resolveLook(value, warn = () => {}, current = DEFAULTS.look) {
  return resolveEnum(value, LOOK_NAMES, current, 'look', warn);
}

export function resolveIntroMode(value, warn = () => {}, current = DEFAULTS.intro) {
  return resolveEnum(value, INTRO_MODES, current, 'intro', warn);
}

export function resolveLightning(value, warn = () => {}, current = DEFAULTS.lightning) {
  return resolveEnum(value, LIGHTNING_MODES, current, 'lightning', warn);
}

export function resolveAmbientOpacity(value, warn = () => {}, current = DEFAULTS.ambientOpacity) {
  return resolveRuntimeNumber(value, current, AMBIENT.opacityMin, AMBIENT.opacityMax, 'ambientOpacity', warn);
}

export function resolveAmbientFps(value, warn = () => {}, current = DEFAULTS.ambientFps) {
  if (AMBIENT_FPS_VALUES.includes(value)) return value;
  warn(`"ambientFps" must be ${AMBIENT_FPS_VALUES.join(' or ')}; using ${current}.`);
  return current;
}

export function resolveColor(value, warn = () => {}, current = DEFAULTS.computerColor, key = 'computerColor') {
  if (typeof value === 'string' && HEX_COLOR.test(value)) return value;
  warn(`"${key}" "${String(value)}" is not a hex colour; using ${current}.`);
  return current;
}

export function resolveBoolean(value, warn = () => {}, current = true, key = 'value') {
  if (typeof value === 'boolean') return value;
  warn(`"${key}" must be a boolean; keeping ${current}.`);
  return current;
}

/**
 * Title text: trimmed, control characters removed, whitespace collapsed,
 * uppercased, at most LOGO_TEXT_MAX characters. Empty or non-string input
 * keeps `current`.
 */
export function resolveLogoText(value, warn = () => {}, current = DEFAULTS.logoText) {
  if (typeof value !== 'string') {
    warn(`"logoText" must be a string; keeping "${current}".`);
    return current;
  }
  // eslint-disable-next-line no-control-regex
  let text = value.replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, '').trim().toUpperCase();
  if (!text) {
    warn(`"logoText" is empty; keeping "${current}".`);
    return current;
  }
  const chars = Array.from(text); // count code points, not UTF-16 units
  if (chars.length > LOGO_TEXT_MAX) {
    text = chars.slice(0, LOGO_TEXT_MAX).join('').trim();
    warn(`"logoText" is longer than ${LOGO_TEXT_MAX} characters; truncated to "${text}".`);
  }
  return text;
}

/** A CSS font-family name (letters, digits, spaces, hyphens). */
export function resolveFontFamily(value, warn = () => {}, current = DEFAULTS.logoFont) {
  if (typeof value === 'string' && /^[\w][\w -]{0,39}$/.test(value.trim())) return value.trim();
  warn(`"logoFont" must be a plain font-family name; using "${current}".`);
  return current;
}

/** Partial storm palette → complete frozen palette (like resolveTheme). */
export function resolveStormPalette(palette, warn = () => {}) {
  if (palette === STORM_PALETTE) return STORM_PALETTE;
  if (palette === null || typeof palette !== 'object') {
    warn('"stormPalette" must be an object of hex colours; using default.');
    return STORM_PALETTE;
  }
  const resolved = {};
  for (const key of STORM_KEYS) {
    const value = palette[key];
    resolved[key] = value === undefined ? STORM_PALETTE[key] : resolveColor(value, warn, STORM_PALETTE[key], `stormPalette.${key}`);
  }
  for (const key of Object.keys(palette)) {
    if (!STORM_KEYS.includes(key)) warn(`Unknown stormPalette key "${key}" ignored.`);
  }
  return Object.freeze(resolved);
}

/** True when the timeline's beats are finite, >= 0 and in order. */
export function isValidTimeline(timeline) {
  let last = 0;
  for (const key of INTRO_BEAT_ORDER) {
    const value = timeline?.[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < last) return false;
    last = value;
  }
  return timeline.strike2 - timeline.strike1 >= LIGHTNING.minGap
    && timeline.strike3 - timeline.strike2 >= LIGHTNING.minGap
    && timeline.handoff <= timeline.duration;
}

export function resolveQuality(value, warn = () => {}) {
  if (QUALITY_VALUES.includes(value)) return value;
  warn(`"quality" must be one of ${QUALITY_VALUES.join(', ')}; using "auto".`);
  return 'auto';
}

/**
 * Validate user options. Never throws: bad values are replaced by defaults
 * and reported through `warn`. Returns a frozen, complete options object.
 */
export function validateOptions(input = {}, warn = () => {}) {
  const options = input !== null && typeof input === 'object' ? input : {};
  if (options !== input) warn('Options must be an object; using defaults.');

  for (const key of Object.keys(options)) {
    if (!Object.hasOwn(DEFAULTS, key)) warn(`Unknown option "${key}" ignored.`);
  }

  const fallbackClass =
    typeof options.fallbackClass === 'string' && /^[\w-]+$/.test(options.fallbackClass)
      ? options.fallbackClass
      : DEFAULTS.fallbackClass;
  if (options.fallbackClass !== undefined && fallbackClass !== options.fallbackClass) {
    warn('"fallbackClass" must be a single CSS class name; using default.');
  }

  const readCallback = (key) => {
    if (typeof options[key] === 'function') return options[key];
    if (options[key] != null) warn(`"${key}" must be a function; ignored.`);
    return null;
  };

  return Object.freeze({
    speed: readNumber(options.speed, DEFAULTS.speed, 0, 4, 'speed', warn),
    theme: resolveTheme(options.theme ?? DEFAULTS.theme, warn),
    intensity: readNumber(options.intensity, DEFAULTS.intensity, 0, 1, 'intensity', warn),
    quality: options.quality === undefined ? DEFAULTS.quality : resolveQuality(options.quality, warn),
    maxDpr: readNumber(options.maxDpr, DEFAULTS.maxDpr, 1, 2, 'maxDpr', warn),
    pointerParallax: readBoolean(options.pointerParallax, DEFAULTS.pointerParallax, 'pointerParallax', warn),
    sway: readNumber(options.sway, DEFAULTS.sway, 0, 1, 'sway', warn),
    calm: readNumber(options.calm, DEFAULTS.calm, 0, 1, 'calm', warn),
    respectReducedMotion: readBoolean(
      options.respectReducedMotion,
      DEFAULTS.respectReducedMotion,
      'respectReducedMotion',
      warn,
    ),
    autoStart: readBoolean(options.autoStart, DEFAULTS.autoStart, 'autoStart', warn),
    fallbackClass,
    onQualityChange: readCallback('onQualityChange'),
    onStateChange: readCallback('onStateChange'),
    // v2
    look: options.look === undefined ? DEFAULTS.look : resolveLook(options.look, warn),
    intro: options.intro === undefined ? DEFAULTS.intro : resolveIntroMode(options.intro, warn),
    computer: readBoolean(options.computer, DEFAULTS.computer, 'computer', warn),
    logo: readBoolean(options.logo, DEFAULTS.logo, 'logo', warn),
    logoText: options.logoText === undefined ? DEFAULTS.logoText : resolveLogoText(options.logoText, warn),
    logoFont: options.logoFont === undefined ? DEFAULTS.logoFont : resolveFontFamily(options.logoFont, warn),
    lightning: options.lightning === undefined ? DEFAULTS.lightning : resolveLightning(options.lightning, warn),
    ambientOpacity: readNumber(
      options.ambientOpacity, DEFAULTS.ambientOpacity, AMBIENT.opacityMin, AMBIENT.opacityMax, 'ambientOpacity', warn,
    ),
    ambientFps: options.ambientFps === undefined ? DEFAULTS.ambientFps : resolveAmbientFps(options.ambientFps, warn),
    computerColor: options.computerColor === undefined
      ? DEFAULTS.computerColor
      : resolveColor(options.computerColor, warn),
    stormPalette: options.stormPalette === undefined
      ? STORM_PALETTE
      : resolveStormPalette(options.stormPalette, warn),
    onIntroStart: readCallback('onIntroStart'),
    onIntroHandoff: readCallback('onIntroHandoff'),
    onIntroEnd: readCallback('onIntroEnd'),
  });
}
