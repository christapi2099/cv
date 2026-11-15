import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

/**
 * Vendored-wormhole fixture (D6 / plan §3).
 *
 * The `three` alias in the `vendor` Vitest project points at
 * `tests/vendor/three-stub.js`, so this is the only context where the bundled
 * element loads without real WebGL. Full browser smoke lives in Phase 3/G3;
 * this test guards the three D6 patches and the pinned attribute contract
 * against upstream drift.
 */

const patchedRoot = new URL('../../src/vendor/wormhole/', import.meta.url);
const readPatched = (file: string) => readFile(new URL(file, patchedRoot), 'utf8');

/** Shape of the upstream module we actually use in this fixture. */
interface WormholeElementModule {
  WormholeBackground: { observedAttributes: readonly string[] };
}

/** Minimal Element stand-in for the `focusout` exemption condition. */
interface ClosestHost {
  closest?: (selector: string) => unknown;
}

/** Mirrors the patched guard in element.js (`#onIntroStart`). */
const isExemptControl = (next: ClosestHost | null): boolean =>
  Boolean(next?.closest?.('[data-wormhole-control]'));

const PATCHED_ATTRIBUTES = [
  'theme', 'speed', 'intensity', 'quality', 'paused',
  'look', 'intro', 'computer', 'logo', 'logo-text', 'lightning', 'ambient-opacity', 'ambient-fps',
  'computer-color',
] as const;

describe('vendored wormhole fixture', () => {
  it('resolves the bare three specifier to the r170 stub', async () => {
    // three@0.170.0 ships no type declarations and @types/three is not
    // installed (nothing in the site imports three directly); the stub is the
    // only module this fixture reads.
    // @ts-expect-error -- untyped three build; the stub exposes REVISION.
    const three = (await import('three')) as { REVISION: string };
    expect(three.REVISION).toBe('170-stub');
  });

  it('imports the bundled element and pins its observed attributes', async () => {
    // Variable specifier: the fixture loads the real patched module, while TS
    // leaves this vendored .js file untyped (allowJs is off).
    const elementUrl = new URL('element.js', patchedRoot).href;
    const mod = (await import(/* @vite-ignore */ elementUrl)) as WormholeElementModule;
    expect(typeof mod.WormholeBackground).toBe('function');
    expect(mod.WormholeBackground.observedAttributes).toEqual(PATCHED_ATTRIBUTES);
  });

  it('exempts data-wormhole-control targets from the focusout skip handler (patch #1)', async () => {
    const source = await readPatched('element.js');
    const guard = "if (next?.closest?.('[data-wormhole-control]')) return;";
    expect(source).toContain(guard);
    expect(source.indexOf(guard)).toBeLessThan(
      source.indexOf('!this.shadowRoot.contains(next)'),
    );

    // Light DOM simulation of the condition: a marked site control is
    // exempt; an unmarked page element is not.
    const control: ClosestHost = { closest: (selector) => (selector === '[data-wormhole-control]' ? control : null) };
    const plain: ClosestHost = { closest: () => null };
    expect(isExemptControl(control)).toBe(true);
    expect(isExemptControl(plain)).toBe(false);
    expect(isExemptControl(null)).toBe(false); // pointer / click-away
  });

  it('releases unconditionally, without an intro-owner early return (patch #2)', async () => {
    const source = await readPatched('element.js');
    expect(source).not.toContain('if (!this.#introOwner) return;');
    expect(source).toContain('#releaseIntro({ skipped = false, reason');
  });

  it('requests Michroma at weight 400 only (patch #3)', async () => {
    const fonts = await readPatched('core/fonts.js');
    const canvasArt = await readPatched('entities/canvasArt.js');
    expect(fonts).toContain('400 128px');
    expect(fonts).not.toContain('900 128px');
    expect(canvasArt).toContain('`400 ${px}px ${fontFamilyCss}`');
    expect(canvasArt).not.toContain('`900 ${px}px ${fontFamilyCss}`');
  });
});
