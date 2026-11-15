import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

/**
 * Phase 3 / G3 fixture extensions (D6 + D10).
 *
 * These run against the *bundled* vendored element and its pure modules with
 * `three` stubbed by the Vitest `vendor` project alias. They guard the intro
 * state machine, the live attribute surface and the two failure paths that
 * the browser suites also exercise: a failed local chunk and an import
 * failure that must release the page shell.
 */

const patchedRoot = new URL('../../src/vendor/wormhole/', import.meta.url);
const readPatched = (file: string) => readFile(new URL(file, patchedRoot), 'utf8');

interface ConfigModule {
  INTRO_TIMELINE: { duration: number; watchdog: number };
  DEFAULTS: { intro: string; look: string };
  resolveIntroMode: (value: unknown, warn?: (message: string) => void) => string;
}

interface DirectorModule {
  shouldPlayIntro: (options: {
    mode: string;
    reducedMotion: boolean;
    playedThisSession: boolean;
    supported?: boolean;
    look?: string;
    running?: boolean;
    replay?: boolean;
  }) => boolean;
  END_REASONS: readonly string[];
}

const importConfig = async (): Promise<ConfigModule> =>
  (await import(
    /* @vite-ignore */ new URL('config.js', patchedRoot).href
  )) as ConfigModule;

const importDirector = async (): Promise<DirectorModule> =>
  (await import(
    /* @vite-ignore */ new URL('director/IntroDirector.js', patchedRoot).href
  )) as DirectorModule;

describe('wormhole intro contract (Phase 3)', () => {
  it('plays intro="once" once per session, and replay always re-arms it', async () => {
    const { shouldPlayIntro } = await importDirector();
    const base = { mode: 'once', reducedMotion: false, look: 'storm', running: true, supported: true };

    expect(shouldPlayIntro({ ...base, playedThisSession: false })).toBe(true);
    expect(shouldPlayIntro({ ...base, playedThisSession: true })).toBe(false);
    expect(shouldPlayIntro({ ...base, playedThisSession: true, replay: true })).toBe(true);
    expect(shouldPlayIntro({ ...base, mode: 'off', playedThisSession: false })).toBe(false);
    expect(shouldPlayIntro({ ...base, playedThisSession: false, reducedMotion: true })).toBe(false);
    expect(shouldPlayIntro({ ...base, playedThisSession: false, look: 'classic' })).toBe(false);
    expect(shouldPlayIntro({ ...base, playedThisSession: false, running: false })).toBe(false);
    expect(shouldPlayIntro({ ...base, playedThisSession: false, supported: false })).toBe(false);
  });

  it('keeps every intro end reason the site must clean up after', async () => {
    const { END_REASONS } = await importDirector();
    expect(END_REASONS).toEqual(
      expect.arrayContaining(['complete', 'skip', 'watchdog', 'hidden', 'error', 'disabled', 'disposed']),
    );
  });

  it('keeps the site watchdog inside the vendor intro bounds', async () => {
    const { INTRO_TIMELINE } = await importConfig();
    // The site timer is 12 s (see lib/wormhole-bridge.ts): after the 10 s
    // intro, before the vendor's 14 s net. Asserted here so a timeline change
    // cannot silently invert the order.
    expect(INTRO_TIMELINE.duration).toBeLessThan(12);
    expect(INTRO_TIMELINE.watchdog).toBeGreaterThan(12);
  });

  it('wires every observed attribute as a live toggle', async () => {
    const source = await readPatched('element.js');
    const observed = [
      'theme', 'speed', 'intensity', 'quality', 'paused',
      'look', 'intro', 'computer', 'logo', 'logo-text', 'lightning',
      'ambient-opacity', 'ambient-fps', 'computer-color',
    ];
    for (const attribute of observed) {
      expect(source).toContain(`case '${attribute}'`);
    }
    // Read-at-connect attributes (calm/sway/max-dpr/...) are not observed; the
    // pinned `observedAttributes` list in wormhole-element.test.ts is the guard.
  });
  it('offers skip via button and Esc, with a live region (a11y)', async () => {
    const source = await readPatched('element.js');
    expect(source).toContain("this.#skip.textContent = 'Skip intro'");
    expect(source).toContain("event.key !== 'Escape'");
    expect(source).toContain("this.#handle?.skipIntro()");
    expect(source).toContain("this.#live.setAttribute('role', 'status')");
    expect(source).toContain("aria-live', 'polite'");
  });

  it('falls back cleanly when the local App/three chunk fails (replaces CDN failure)', async () => {
    const source = await readPatched('index.js');
    expect(source).toContain("await import('./App.js')");
    expect(source).toContain('Could not load three.js');
    expect(source).toContain('return fallBack(container, validated');
  });

  it('releases the shell before focus restoration on every intro end (patch #2)', async () => {
    const source = await readPatched('element.js');
    const release = source.indexOf('[data-wormhole-shell]');
    const focus = source.indexOf('target.focus({ preventScroll: true })');
    const emit = source.indexOf("this.#emit('wormhole:introend'");
    expect(release).toBeGreaterThan(-1);
    expect(release).toBeLessThan(focus);
    expect(focus).toBeLessThan(emit);
  });

  it('exempts the sound control from the focusout skip handler (patch #1)', async () => {
    const source = await readPatched('element.js');
    const guard = "if (next?.closest?.('[data-wormhole-control]')) return;";
    const skip = source.indexOf('!this.shadowRoot.contains(next)');
    expect(source).toContain(guard);
    expect(source.indexOf(guard)).toBeLessThan(skip);
  });

  it('never requests Michroma at a synthetic weight (patch #3)', async () => {
    const fonts = await readPatched('core/fonts.js');
    const canvasArt = await readPatched('entities/canvasArt.js');
    expect(fonts).toContain('400 128px');
    expect(canvasArt).toContain('`400 ${px}px ${fontFamilyCss}`');
    expect(`${fonts}${canvasArt}`).not.toMatch(/`?900( 128px|\s)?/);
  });
});

describe('site bridge contract (Phase 3)', () => {
  it('imports the shell helpers without touching the DOM at module scope', async () => {
    // Importing in Node proves the bridge module is DOM-free until start().
    const bridge = await import('../../src/lib/wormhole-bridge');
    expect(typeof bridge.getWormholeBridge).toBe('function');
    expect(bridge.INTRO_WATCHDOG_MS).toBe(12_000);
  });

  it('sets and releases inert on the marked shell only', async () => {
    const bridge = await import('../../src/lib/wormhole-bridge');
    const attributes = new Set<string>();
    const shell = {
      setAttribute: (name: string) => attributes.add(name),
      removeAttribute: (name: string) => attributes.delete(name),
    };
    const root = {
      querySelectorAll: (selector: string) => (selector === '[data-wormhole-shell]' ? [shell] : []),
    } as unknown as Parameters<typeof bridge.setShellInert>[0];

    bridge.setShellInert(root, true);
    expect(attributes.has('inert')).toBe(true);
    bridge.releaseShellInert(root);
    expect(attributes.has('inert')).toBe(false);
  });

  it('resolves theme and reduced-motion from the live document', async () => {
    const bridge = await import('../../src/lib/wormhole-bridge');
    const documentLike = {
      documentElement: { classList: { contains: (name: string) => name === 'dark' } },
    } as unknown as Document;
    expect(bridge.isDarkTheme(documentLike)).toBe(true);

    const reducedWindow = {
      matchMedia: (query: string) => ({ matches: query.includes('reduce') }),
    } as unknown as Window;
    const normalWindow = { matchMedia: () => ({ matches: false }) } as unknown as Window;
    expect(bridge.prefersReducedMotion(reducedWindow)).toBe(true);
    expect(bridge.prefersReducedMotion(normalWindow)).toBe(false);
  });
});
