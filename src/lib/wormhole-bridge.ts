/**
 * Site-side wormhole bridge (D6 + D10).
 *
 * Why a bridge instead of wiring the element directly:
 *  - `wormhole:introstart` can fire before any island hydrates, so the
 *    listeners are attached to the (still un-upgraded) `<wormhole-bg>` at
 *    element insertion — *before* the bundled element module is imported.
 *  - `wormhole:ready` only gates controller access (skip / replay), never
 *    listening.
 *  - Every intro end (natural, skip, watchdog, theme change, reduced motion,
 *    module-import failure) releases the page shell and moves the sound
 *    control back into the header through one idempotent path.
 *
 * Cleanup order inside the vendor is part of the contract: patch #2 removes
 * the shell `inert` attribute *before* it restores focus and emits
 * `introend` (see src/vendor/wormhole/VENDOR_PATCHES.md).
 */
import type {
  WormholeController,
  WormholeIntroEndDetail,
  WormholeReadyDetail,
} from '../vendor/wormhole/element';

export const WORMHOLE_STATE_EVENT = 'site:wormholestate';

/** Site watchdog (D10): longer than the 10 s intro, shorter than the 14 s vendor net. */
export const INTRO_WATCHDOG_MS = 12_000;

export const SHELL_ATTRIBUTE = 'data-wormhole-shell';
const SHELL_SELECTOR = `[${SHELL_ATTRIBUTE}]`;
const CLUSTER_SELECTOR = '[data-sound-cluster]';
const SLOT_SELECTOR = '[data-sound-slot]';
const ELEMENT_SELECTOR = 'wormhole-bg';
const INTRO_CONTROL_ATTRIBUTE = 'data-intro-control';

export type IntroPhase = 'idle' | 'intro';

export interface WormholeState {
  readonly phase: IntroPhase;
  readonly reason: string | null;
  readonly hasEnded: boolean;
  /** Replay is possible right now (dark, reduced-motion-free, controller ready). */
  readonly available: boolean;
  readonly supported: boolean | null;
  readonly themeAllowed: boolean;
  readonly reducedMotion: boolean;
  readonly loadError: string | null;
}

export interface InertTarget {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

export interface InertRoot {
  querySelectorAll(selector: string): ArrayLike<InertTarget>;
}

/** Minimal structural interface so this stays unit-testable without a DOM. */
export type ShellInertRoot = Pick<Document, 'querySelectorAll'>;

export function setShellInert(root: ShellInertRoot, inert: boolean): void {
  for (const shell of root.querySelectorAll(SHELL_SELECTOR)) {
    if (inert) shell.setAttribute('inert', '');
    else shell.removeAttribute('inert');
  }
}

export function releaseShellInert(root: ShellInertRoot): void {
  setShellInert(root, false);
}

export function isDarkTheme(doc: Document): boolean {
  return doc.documentElement.classList.contains('dark');
}

export function prefersReducedMotion(win: Window): boolean {
  return (
    typeof win.matchMedia === 'function' &&
    win.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

type StateListener = (state: WormholeState) => void;

class WormholeBridge {
  #started = false;
  #element: HTMLElement | null = null;
  #controller: WormholeController | null = null;
  #supported: boolean | null = null;
  #loadError: string | null = null;
  #phase: IntroPhase = 'idle';
  #reason: string | null = null;
  #hasEnded = false;
  #forcedReason: string | null = null;
  #watchdog = 0;
  #reducedMotion = false;
  #themeObserver: MutationObserver | null = null;
  #motionQuery: MediaQueryList | null = null;
  #listeners = new Set<StateListener>();
  #imported = false;
  #suppressAutoIntro = false;
  #state: WormholeState = {
    phase: 'idle',
    reason: null,
    hasEnded: false,
    available: false,
    supported: null,
    themeAllowed: true,
    reducedMotion: false,
    loadError: null,
  };

  get state(): WormholeState {
    return this.#state;
  }

  /** Idempotent. Safe before the element definition exists. */
  start(): void {
    if (this.#started || typeof document === 'undefined') return;
    this.#started = true;
    this.#reducedMotion = prefersReducedMotion(window);
    this.#element = document.querySelector<HTMLElement>(ELEMENT_SELECTOR);

    // Listeners first: `introstart` may fire before/while the module loads.
    this.#element?.addEventListener('wormhole:introstart', this.#onIntroStart as EventListener);
    this.#element?.addEventListener('wormhole:introend', this.#onIntroEnd as EventListener);
    this.#element?.addEventListener('wormhole:ready', this.#onReady as EventListener);

    this.#observeTheme();
    this.#observeMotion();
    this.#publish();
    this.#maybeLoad();
  }

  subscribe(listener: StateListener): () => void {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** True when replaying the intro is honest (no reduced motion, dark, ready). */
  canReplay(): boolean {
    return (
      this.#phase === 'idle' &&
      this.#controller !== null &&
      this.#supported !== false &&
      !this.#reducedMotion &&
      this.#loadError === null
    );
  }

  /** Replay only ever goes through the vendor controller (D10). */
  replayIntro(): boolean {
    if (!this.canReplay()) return false;
    const started = this.#controller?.replayIntro() ?? false;
    this.#publish();
    return started;
  }

  // ── Element lifecycle ──────────────────────────────────────────────────────

  #maybeLoad(): void {
    if (this.#imported || this.#loadError !== null) return;
    if (this.#element === null) {
      this.#fail('missing-element');
      return;
    }
    if (this.#reducedMotion) {
      this.#applyFallback('reduced-motion');
      return;
    }
    // Owner amendment (2026-11-15): the effect runs in BOTH light and dark
    // themes — light mode no longer suppresses download/intro/ambient.
    // A deferred load (theme/motion changed after first paint) must not
    // surprise the visitor with an intro they did not get on arrival.
    if (this.#suppressAutoIntro) this.#element.setAttribute('intro', 'off');

    this.#imported = true;
    void import('../vendor/wormhole/element.js').then(
      () => undefined,
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.#fail(`import-failed: ${message}`);
      },
    );
  }

  #onReady = (event: Event): void => {
    const detail = (event as CustomEvent<WormholeReadyDetail>).detail;
    this.#controller = detail?.controller ?? null;
    this.#supported = Boolean(detail?.supported);
    if (this.#supported) this.#removeFallback();
    else this.#applyFallback('webgl');
    this.#publish();
  };

  #onIntroStart = (): void => {
    if (this.#phase === 'intro') return; // vendor emits once; stay idempotent
    if (this.#reducedMotion) {
      this.#forcedReason = 'disabled';
      this.#controller?.skipIntro();
      this.#finish('disabled');
      return;
    }
    // Move the control out of the shell *before* the shell becomes inert.
    this.#relocateCluster(true);
    setShellInert(document, true);
    this.#phase = 'intro';
    this.#reason = null;
    this.#startWatchdog();
    this.#publish();
  };

  #onIntroEnd = (event: Event): void => {
    const detail = (event as CustomEvent<WormholeIntroEndDetail>).detail;
    this.#finish(this.#forcedReason ?? detail?.reason ?? 'complete');
  };

  /** One idempotent release path (natural, skip, watchdog, no-event, failure). */
  #finish(reason: string): void {
    this.#clearWatchdog();
    this.#forcedReason = null;
    releaseShellInert(document);
    this.#relocateCluster(false);
    this.#phase = 'idle';
    this.#reason = reason;
    this.#hasEnded = true;
    this.#publish();
  }

  #startWatchdog(): void {
    this.#clearWatchdog();
    this.#watchdog = window.setTimeout(() => {
      this.#watchdog = 0;
      this.#forcedReason = 'watchdog';
      this.#controller?.skipIntro();
      // No-event safety: even if the vendor never emits `introend`, release.
      this.#finish('watchdog');
    }, INTRO_WATCHDOG_MS);
  }

  #clearWatchdog(): void {
    if (this.#watchdog !== 0) {
      window.clearTimeout(this.#watchdog);
      this.#watchdog = 0;
    }
  }

  #fail(reason: string): void {
    this.#loadError = reason;
    this.#applyFallback('import-failed');
    releaseShellInert(document);
    this.#relocateCluster(false);
    this.#phase = 'idle';
    this.#reason = reason;
    this.#publish();
  }

  // ── Environment changes ────────────────────────────────────────────────────

  #observeTheme(): void {
    this.#themeObserver = new MutationObserver(() => this.#onThemeChange());
    this.#themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  #onThemeChange(): void {
    // Owner amendment (2026-11-15): the effect plays in light AND dark.
    // A theme switch no longer stops the controller or ends a running intro;
    // switching only ensures the effect is loaded (e.g. an early light
    // visit that deferred nothing now starts normally).
    this.#maybeLoad();
    if (this.#supported === false) this.#applyFallback('webgl');
    this.#publish();
  }

  #observeMotion(): void {
    if (typeof window.matchMedia !== 'function') return;
    this.#motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.#motionQuery.addEventListener('change', this.#onMotionChange);
  }

  #onMotionChange = (): void => {
    this.#reducedMotion = this.#motionQuery?.matches ?? false;
    if (this.#reducedMotion) {
      this.#applyFallback('reduced-motion');
      if (this.#phase === 'intro') {
        this.#forcedReason = 'reduced-motion';
        this.#controller?.skipIntro();
        this.#finish('reduced-motion');
      }
      this.#controller?.stop();
    } else {
      // Never start an intro late because the preference changed.
      this.#suppressAutoIntro = true;
      this.#maybeLoad();
      if (this.#supported) this.#removeFallback();
      this.#controller?.start();
    }
    this.#publish();
  };

  // ── DOM helpers ────────────────────────────────────────────────────────────

  #relocateCluster(intro: boolean): void {
    const cluster = document.querySelector<HTMLElement>(CLUSTER_SELECTOR);
    if (cluster === null) return;
    if (intro) {
      if (cluster.parentElement !== document.body) document.body.append(cluster);
      cluster.setAttribute(INTRO_CONTROL_ATTRIBUTE, '');
      return;
    }
    const slot = document.querySelector<HTMLElement>(SLOT_SELECTOR);
    if (slot !== null && cluster.parentElement !== slot) slot.append(cluster);
    cluster.removeAttribute(INTRO_CONTROL_ATTRIBUTE);
  }

  #applyFallback(reason: string): void {
    document.documentElement.dataset.wormholeFallback = reason;
  }

  #removeFallback(): void {
    if (typeof document.documentElement.dataset.wormholeFallback === 'string') {
      delete document.documentElement.dataset.wormholeFallback;
    }
  }

  #publish(): void {
    this.#state = Object.freeze({
      phase: this.#phase,
      reason: this.#reason,
      hasEnded: this.#hasEnded,
      available: this.canReplay(),
      supported: this.#supported,
      themeAllowed: true,
      reducedMotion: this.#reducedMotion,
      loadError: this.#loadError,
    });
    for (const listener of this.#listeners) listener(this.#state);
    document.dispatchEvent(
      new CustomEvent<WormholeState>(WORMHOLE_STATE_EVENT, { detail: this.#state }),
    );
  }
}

let sharedBridge: WormholeBridge | null = null;

/** The single site bridge. Calling this starts it (idempotently). */
export function getWormholeBridge(): WormholeBridge {
  sharedBridge ??= new WormholeBridge();
  sharedBridge.start();
  return sharedBridge;
}

export function startWormholeBridge(): WormholeBridge {
  return getWormholeBridge();
}
