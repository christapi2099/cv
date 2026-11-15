/**
 * <wormhole-bg>: drop-in custom element. No page CSS or JS required.
 *
 *   <script type="module" src="/wormhole/element.js"></script>
 *   <wormhole-bg fixed intro="once"></wormhole-bg>            (full-page background)
 *   <section class="hero" style="position:relative; isolation:isolate">
 *     <wormhole-bg></wormhole-bg> ...your hero content...      (hero background)
 *   </section>
 *
 * Styles live in Shadow DOM, so the effect and your site's CSS cannot affect
 * each other. Safe to import during SSR (defines nothing without a DOM).
 *
 * Attributes (live): theme, speed, intensity, quality, paused,
 *   look, intro, computer, logo, logo-text, lightning, ambient-opacity,
 *   ambient-fps, computer-color
 * Attributes (read when connected): calm, sway, max-dpr, no-parallax, fixed,
 *   no-font-link
 * Property: el.controller → the createVortex() handle (null until ready)
 * Property: el.ready      → Promise<handle> for the current mount
 * Events (bubble, composed): wormhole:ready, wormhole:statechange,
 *   wormhole:qualitychange, wormhole:introstart, wormhole:introend
 *
 * Storm vortex intro: while it plays, the element covers the page
 * (position: fixed; z-index 2147483000) with a Skip button that takes focus,
 * Esc skips, and a live region announces how to skip. Afterwards it returns
 * to its background placement at `ambient-opacity`.
 *
 * Title font: inside Shadow DOM @font-face does not apply, and the title is
 * drawn on a canvas using document fonts. So, unless `no-font-link` is set or
 * `logo="off"`, the element adds ONE Google Fonts stylesheet <link> for
 * Michroma to document.head (once per document, skipped if any link for that
 * family already exists). If the font does not load within 1.5 s, the title
 * uses a heavy system font.
 */
import { createVortex, THEMES } from './index.js';

const FALLBACK_CLASS = 'wormhole-fallback';
const TITLE_FONT_HREF = 'https://fonts.googleapis.com/css2?family=Michroma&display=swap';
const INTRO_MESSAGE = 'Intro playing. Press Escape or Skip to continue to the site.';

const STYLES = /* css */ `
  :host {
    display: block;
    position: absolute;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
    contain: strict;
  }
  :host([fixed]) { position: fixed; }
  :host([hidden]) { display: none; }
  /* Intro: cover the page and take pointer input (clicks behind do nothing). */
  :host([data-intro]) {
    position: fixed;
    inset: 0;
    z-index: 2147483000;
    pointer-events: auto;
  }
  .stage { position: absolute; inset: 0; }
  .stage::before {
    content: '';
    position: absolute;
    inset: 0;
    opacity: var(--placeholder-opacity, 1);
    background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--mid) 35%, transparent) 0,
      var(--deep) 70%);
  }
  .stage.${FALLBACK_CLASS}::before {
    background:
      radial-gradient(circle at 50% 50%, var(--deep) 0 6%, transparent 32%),
      repeating-conic-gradient(from 20deg at 50% 50%,
        color-mix(in srgb, var(--mid) 40%, transparent) 0 14deg, transparent 14deg 30deg,
        color-mix(in srgb, var(--energy) 14%, transparent) 30deg 36deg, transparent 36deg 52deg),
      radial-gradient(circle at 50% 50%, var(--mid) 0, var(--deep) 80%);
  }
  /* Storm look: the canvas is translucent, so hide the placeholder under it. */
  .stage.translucent:not(.${FALLBACK_CLASS})::before { display: none; }

  .overlay { position: absolute; inset: 0; }
  .overlay[hidden] { display: none; }
  .skip {
    position: absolute;
    right: max(20px, env(safe-area-inset-right));
    bottom: max(20px, env(safe-area-inset-bottom));
    min-height: 44px;
    min-width: 44px;
    padding: 0 20px;
    border: 1px solid rgb(239 233 255 / 0.45);
    border-radius: 999px;
    background: rgb(5 8 13 / 0.6);
    color: #f4f1ff;
    font: 500 16px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition: opacity 600ms ease, background-color 150ms ease;
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
  }
  .skip:hover { background: rgb(40 30 80 / 0.75); }
  .skip:focus-visible { outline: 2px solid #efe9ff; outline-offset: 3px; }
  :host([data-intro="leaving"]) .skip { opacity: 0; }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .skip { transition: none; }
  }
`;

const Base = globalThis.HTMLElement ?? class {};
const toNumber = (value) => (value === null || value.trim() === '' ? undefined : Number(value));
/** `computer="off"` (or "false") hides; absent or anything else shows. */
const toSwitch = (value) => value === null || !/^(off|false|0|no)$/i.test(value.trim());

/** Adds the title font stylesheet to <head> once per document. Never throws. */
function ensureTitleFont(doc) {
  try {
    const head = doc?.head;
    if (!head || head.querySelector('link[data-wormhole-font], link[href*="family=Michroma"]')) return;
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = TITLE_FONT_HREF;
    link.setAttribute('data-wormhole-font', '');
    head.append(link);
  } catch {
    // No font link: the title falls back to a heavy system font.
  }
}

export class WormholeBackground extends Base {
  static observedAttributes = [
    'theme', 'speed', 'intensity', 'quality', 'paused',
    'look', 'intro', 'computer', 'logo', 'logo-text', 'lightning', 'ambient-opacity', 'ambient-fps',
    'computer-color',
  ];

  #stage;
  #overlay;
  #skip;
  #live;
  #handle = null;
  #mountId = 0;
  #introOwner = 0; // mount id whose intro is on screen (0 = none)
  #introAbort = null;
  #returnFocus = null;
  #liveTimer = 0;
  #ready = Promise.resolve(null);

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    this.#stage = document.createElement('div');
    this.#stage.className = 'stage';
    this.#stage.setAttribute('part', 'stage'); // style from outside with wormhole-bg::part(stage)

    this.#overlay = document.createElement('div');
    this.#overlay.className = 'overlay';
    this.#overlay.setAttribute('part', 'intro');
    this.#overlay.hidden = true;
    this.#skip = document.createElement('button');
    this.#skip.type = 'button';
    this.#skip.className = 'skip';
    this.#skip.setAttribute('part', 'skip');
    this.#skip.textContent = 'Skip intro';
    this.#skip.addEventListener('click', () => this.#handle?.skipIntro());
    this.#overlay.append(this.#skip);

    this.#live = document.createElement('div');
    this.#live.className = 'sr-only';
    this.#live.setAttribute('role', 'status');
    this.#live.setAttribute('aria-live', 'polite');

    root.append(style, this.#stage, this.#overlay, this.#live);
  }

  /** The createVortex() handle, or null before ready / after removal. */
  get controller() {
    return this.#handle;
  }

  /** Resolves with the handle once the current mount is ready. */
  get ready() {
    return this.#ready;
  }

  connectedCallback() {
    this.#paintFallbackColors();
    this.#warnIfUnpositionedParent();
    if (toSwitch(this.getAttribute('logo')) && !this.hasAttribute('no-font-link')) ensureTitleFont(this.ownerDocument);
    this.#ready = this.#mount();
  }

  disconnectedCallback() {
    this.#mountId += 1; // invalidates any mount still in flight
    this.#handle?.dispose(); // ends a playing intro (introend fires) and frees the GPU
    this.#handle = null;
    this.#releaseIntro({ skipped: true, reason: 'disposed' }, { emit: false });
    this.#stage.classList.remove(FALLBACK_CLASS);
  }

  attributeChangedCallback(name, oldValue, value) {
    if (name === 'theme' || name === 'look' || name === 'ambient-opacity') this.#paintFallbackColors();
    const handle = this.#handle;
    if (!handle || oldValue === value) return;
    switch (name) {
      case 'theme': handle.setTheme(value ?? 'vortex'); break;
      case 'speed': handle.setSpeed(toNumber(value) ?? 1); break;
      case 'intensity': handle.setIntensity(toNumber(value) ?? 0.8); break;
      case 'quality': handle.setQuality(value ?? 'auto'); break;
      case 'paused': value === null ? handle.start() : handle.stop(); break;
      case 'look': handle.setLook(value ?? 'storm'); break;
      case 'intro': handle.setIntro(value ?? 'once'); break;
      case 'computer': handle.setComputer(toSwitch(value)); break;
      case 'logo':
        if (toSwitch(value) && !this.hasAttribute('no-font-link')) ensureTitleFont(this.ownerDocument);
        handle.setLogo(toSwitch(value));
        break;
      case 'logo-text': handle.setLogoText(value ?? 'CHRISTOPHER TAPIA'); break;
      case 'lightning': handle.setLightning(value ?? 'on'); break;
      case 'ambient-opacity': handle.setAmbientOpacity(toNumber(value) ?? 0.4); break;
      case 'ambient-fps': handle.setAmbientFps(toNumber(value) ?? 30); break;
      case 'computer-color': handle.setComputerColor(value ?? '#7b3fe4'); break;
      default: break;
    }
  }

  async #mount() {
    const id = ++this.#mountId;
    let handle;
    try {
      handle = await createVortex(this.#stage, this.#readOptions(id));
    } catch (error) {
      console.warn(`[wormhole] ${error?.message ?? error}`);
      return null;
    }
    if (id !== this.#mountId || !this.isConnected) {
      handle.dispose(); // removed (or re-added) while three.js was loading
      return null;
    }
    this.#handle = handle;
    this.#paintFallbackColors();
    this.#emit('wormhole:ready', { supported: handle.supported, controller: handle });
    return handle;
  }

  #readOptions(id) {
    const options = {
      fallbackClass: FALLBACK_CLASS,
      autoStart: !this.hasAttribute('paused'),
      pointerParallax: !this.hasAttribute('no-parallax'),
      onQualityChange: (tier) => this.#emit('wormhole:qualitychange', { tier }),
      onStateChange: (state) => {
        if (id === this.#mountId) this.#paintFallbackColors(state.look);
        this.#emit('wormhole:statechange', state);
      },
      onIntroStart: () => this.#onIntroStart(id),
      onIntroHandoff: () => { if (this.#introOwner === id) this.setAttribute('data-intro', 'leaving'); },
      onIntroEnd: (detail) => { if (this.#introOwner === id) this.#releaseIntro(detail, { emit: true }); },
    };
    const numeric = {
      speed: 'speed', intensity: 'intensity', calm: 'calm', sway: 'sway', maxDpr: 'max-dpr',
      ambientOpacity: 'ambient-opacity', ambientFps: 'ambient-fps',
    };
    for (const [key, attr] of Object.entries(numeric)) {
      const value = toNumber(this.getAttribute(attr));
      if (value !== undefined) options[key] = value;
    }
    const strings = {
      theme: 'theme', quality: 'quality', look: 'look', intro: 'intro', lightning: 'lightning',
      logoText: 'logo-text', computerColor: 'computer-color',
    };
    for (const [key, attr] of Object.entries(strings)) {
      if (this.hasAttribute(attr)) options[key] = this.getAttribute(attr);
    }
    options.computer = toSwitch(this.getAttribute('computer'));
    options.logo = toSwitch(this.getAttribute('logo'));
    return options;
  }

  // ── Intro overlay ──────────────────────────────────────────────────────────

  #onIntroStart(id) {
    if (id !== this.#mountId || !this.isConnected) return;
    this.#introAbort?.abort();
    this.#introAbort = new AbortController();
    const { signal } = this.#introAbort;
    this.#introOwner = id;

    const doc = this.ownerDocument;
    this.#returnFocus = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : null;
    this.setAttribute('data-intro', 'playing');
    this.#overlay.hidden = false;
    this.#skip.focus({ preventScroll: true });

    // Esc skips. Capture phase, so page handlers cannot swallow it first.
    doc.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' && event.key !== 'Esc') return;
      event.preventDefault();
      this.#handle?.skipIntro();
    }, { capture: true, signal });
    // Tabbing from Skip into the page means "take me to the site".
    this.#skip.addEventListener('focusout', (event) => {
      const next = event.relatedTarget;
      // Site-owned controls (the sound toggle) are not "the page": focusing
      // one must not end the intro. See VENDOR_PATCHES.md #1.
      if (next?.closest?.('[data-wormhole-control]')) return;
      if (next && next !== this && !this.shadowRoot.contains(next)) this.#handle?.skipIntro();
    }, { signal });

    // Set after a tick so screen readers notice the change.
    clearTimeout(this.#liveTimer);
    this.#liveTimer = setTimeout(() => { this.#live.textContent = INTRO_MESSAGE; }, 60);
    this.#emit('wormhole:introstart', {});
  }

  /** Every intro end (finished, skipped, watchdog, hidden tab, error, removal) lands here. */
  #releaseIntro({ skipped = false, reason = 'complete' } = {}, { emit }) {
    this.#introOwner = 0;
    this.#introAbort?.abort();
    this.#introAbort = null;
    clearTimeout(this.#liveTimer);
    this.#live.textContent = '';
    const hadFocus = this.shadowRoot.activeElement === this.#skip;
    this.removeAttribute('data-intro');
    this.#overlay.hidden = true;
    if (hadFocus) {
      const target = this.#returnFocus;
      if (target?.isConnected && typeof target.focus === 'function') target.focus({ preventScroll: true });
      // The old target may be gone or disabled: never leave focus on a hidden button.
      if (this.shadowRoot.activeElement === this.#skip) this.#skip.blur();
    }
    this.#returnFocus = null;
    if (emit) this.#emit('wormhole:introend', { skipped: Boolean(skipped), reason });
  }

  /** The CSS fallback uses the look's colours, so it matches the WebGL look. */
  #paintFallbackColors(lookOverride) {
    const look = lookOverride ?? this.#handle?.state?.look ?? (this.getAttribute('look') === 'classic' ? 'classic' : 'storm');
    const storm = look === 'storm';
    const theme = storm ? THEMES.storm : (THEMES[this.getAttribute('theme')] ?? THEMES.vortex);
    const style = this.#stage.style;
    style.setProperty('--deep', theme.deep);
    style.setProperty('--mid', theme.mid);
    style.setProperty('--energy', theme.energy);
    // Storm is an ambient layer: its fallback/placeholder is dimmed like the canvas.
    const opacity = Math.min(0.8, Math.max(0.15, toNumber(this.getAttribute('ambient-opacity')) ?? 0.4));
    style.setProperty('--placeholder-opacity', storm ? String(opacity) : '1');
    this.#stage.classList.toggle('translucent', storm && Boolean(this.#handle?.supported));
  }

  #warnIfUnpositionedParent() {
    if (this.hasAttribute('fixed') || !this.parentElement) return;
    if (getComputedStyle(this.parentElement).position === 'static') {
      console.warn('[wormhole] <wormhole-bg> fills its nearest positioned ancestor. '
        + 'Give its parent `position: relative; isolation: isolate`, or add the `fixed` attribute.');
    }
  }

  #emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
}

/** Register under another tag name if 'wormhole-bg' clashes with your site. */
export function defineWormhole(tagName = 'wormhole-bg') {
  if (!globalThis.customElements || customElements.get(tagName)) return;
  customElements.define(tagName, class extends WormholeBackground {});
}

defineWormhole();
