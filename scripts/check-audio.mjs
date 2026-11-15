#!/usr/bin/env node
/**
 * Gate G3 — intro audio + truthful sound control (plan §4 Phase 3).
 *
 * Runs against the built site with a real Chromium audio graph:
 *   1. a rejected autoplay flips the persisted preference to `off` and says so,
 *   2. the toggle never claims "Sound on" while the element is paused,
 *   3. keyboard focus moving from Skip to the toggle does NOT end the intro
 *      (vendor patch #1),
 *   4. every end path ramps the GainNode 0.4 → 0 over 2 s — natural, skip,
 *      site watchdog, and the no-event watchdog (module-import failure),
 *   5. the shell `inert` is set during the intro and released on every path,
 *   6. no bare `from 'three'` survives in the built JS and no external
 *      three/Google-Fonts request is made at runtime.
 *
 * `dist/` must exist (CI builds before running the check-* harnesses).
 */
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { serveDirectory } from './lib/harness.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ASTRO_ASSETS = path.join(DIST, '_astro');
const INTRO_WATCHDOG_MS = 12_000;
const FADE_OUT_MS = 2000;
const FADE_TOLERANCE_MS = 350;

if (!existsSync(DIST)) {
  console.error('check-audio: dist/ is missing — run `pnpm build` first.');
  process.exit(1);
}

const failures = [];
const pass = (name, detail = '') => console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
const fail = (name, detail = '') => {
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
};
const check = (name, condition, detail = '') => (condition ? pass(name, detail) : fail(name, detail));

/** Records GainNode automation so the fade can be measured, not assumed. */
const instrumentAudio = () => {
  window.__siteStates = [];
  window.__audioTrace = [];
  document.addEventListener('site:wormholestate', (event) => {
    window.__siteStates.push(event.detail);
  });
  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor) return;
  const createGain = AudioContextCtor.prototype.createGain;
  AudioContextCtor.prototype.createGain = function instrumentedCreateGain(...args) {
    const node = createGain.apply(this, args);
    const readContextTime = () => this.currentTime;
    for (const method of [
      'setValueAtTime',
      'linearRampToValueAtTime',
      'exponentialRampToValueAtTime',
      'cancelScheduledValues',
    ]) {
      const original = node.gain[method].bind(node.gain);
      node.gain[method] = (...callArgs) => {
        window.__audioTrace.push({
          method,
          value: typeof callArgs[0] === 'number' ? callArgs[0] : null,
          time: typeof callArgs[1] === 'number' ? callArgs[1] : callArgs[0],
          contextTime: readContextTime(),
        });
        return original(...callArgs);
      };
    }
    return node;
  };
};

/** Rejects every play() — the autoplay-blocked browser. */
const rejectPlay = () => {
  HTMLMediaElement.prototype.play = function rejectAutoplay() {
    return Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError'));
  };
};

const waitForIntroStart = (page) =>
  page.waitForFunction(
    () => document.querySelector('wormhole-bg')?.getAttribute('data-intro') === 'playing',
    null,
    { timeout: 25_000 },
  );

const waitForIntroEnd = (page) =>
  page.waitForFunction(
    () => {
      const element = document.querySelector('wormhole-bg');
      return Boolean(element?.controller) && element.getAttribute('data-intro') === null;
    },
    null,
    { timeout: 25_000 },
  );

const snapshot = (page) =>
  page.evaluate(() => {
    const element = document.querySelector('wormhole-bg');
    const audio = document.querySelector('[data-intro-audio]');
    const button = document.querySelector('#sound-toggle');
    const status = document.querySelector('[data-sound-status]');
    const shell = document.querySelector('[data-wormhole-shell]');
    return {
      supported: element?.controller?.supported ?? null,
      intro: element?.getAttribute('data-intro') ?? null,
      paused: audio?.paused ?? null,
      src: audio?.getAttribute('src') ?? null,
      label: document.querySelector('[data-sound-label]')?.textContent?.trim() ?? null,
      pressed: button?.getAttribute('aria-pressed') ?? null,
      status: status?.textContent?.trim() ?? '',
      statusHidden: status?.hidden ?? true,
      shellInert: shell?.hasAttribute('inert') ?? null,
      soundPreference: localStorage.getItem('sound'),
      fallback: document.documentElement.dataset.wormholeFallback ?? null,
    };
  });

const trace = (page) => page.evaluate(() => window.__audioTrace);

/** True when the trace contains a 0.4 → 0 linear ramp lasting ~2 s. */
function hasTwoSecondFadeToZero(entries) {
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.method !== 'linearRampToValueAtTime' || entry.value !== 0) continue;
    const previous = [...entries.slice(0, index)]
      .reverse()
      .find((candidate) => candidate.method === 'setValueAtTime');
    if (!previous) continue;
    const durationMs = (entry.time - previous.time) * 1000;
    if (Math.abs(durationMs - FADE_OUT_MS) <= FADE_TOLERANCE_MS) return true;
  }
  return false;
}

async function assertBundle() {
  const files = (await readdir(ASTRO_ASSETS)).filter((file) => file.endsWith('.js'));
  let bareSpecifier = null;
  let appChunk = false;
  for (const file of files) {
    const source = await readFile(path.join(ASTRO_ASSETS, file), 'utf8');
    if (/(?:from|import)\s*\(?\s*["']three["']/.test(source)) bareSpecifier = file;
    if (file.startsWith('App.')) appChunk = true;
  }
  check('built JS contains no bare `three` specifier', bareSpecifier === null, bareSpecifier ?? '');
  check('App/three chunk was emitted (lazy, not in the element chunk)', appChunk);
}

async function run() {
  await assertBundle();

  const server = await serveDirectory(DIST);
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const externalRequests = [];

  const open = async ({ colorScheme = 'dark', init = null, abort = null } = {}) => {
    const context = await browser.newContext({ colorScheme });
    if (init !== null) await context.addInitScript(init);
    const page = await context.newPage();
    page.on('request', (request) => {
      const url = request.url();
      if (/fonts\.gstatic|\/three(?:\.module)?\.js|three@/.test(url)) externalRequests.push(url);
    });
    if (abort !== null) await page.route(abort, (route) => route.abort());
    await page.goto(origin, { waitUntil: 'load' });
    return { context, page };
  };

  try {
    // ── 1. Autoplay rejection: persist `off`, announce, never lie ───────────
    {
      const { context, page } = await open({ init: rejectPlay });
      await waitForIntroStart(page);
      await page
        .waitForFunction(
          () => document.querySelector('[data-sound-status]')?.textContent?.includes('Sound was blocked'),
          null,
          { timeout: 5000 },
        )
        .catch(() => undefined);
      const state = await snapshot(page);
      check(
        'rejected autoplay flips the persisted preference to off',
        state.soundPreference === 'off',
        `sound=${state.soundPreference}`,
      );
      check(
        'rejected autoplay announces the browser block',
        state.status.includes('Sound was blocked by your browser — tap to enable'),
        state.status || '(no status text)',
      );
      check(
        'toggle never claims Sound on while paused',
        state.paused === true && state.label !== 'Sound on' && state.pressed === 'false',
        `paused=${state.paused} label=${state.label} pressed=${state.pressed}`,
      );
      await context.close();
    }

    // ── 2. Truthful playing state + keyboard exemption (patch #1) ───────────
    {
      const { context, page } = await open({ init: instrumentAudio });
      await waitForIntroStart(page);
      await page.waitForTimeout(700);
      const playing = await snapshot(page);
      check(
        'real intro starts the music and shows Sound on only while playing',
        playing.paused === false && playing.label === 'Sound on' && playing.pressed === 'true',
        `paused=${playing.paused} label=${playing.label} pressed=${playing.pressed}`,
      );
      check('page shell is inert during the intro', playing.shellInert === true);

      // The vendor focuses Skip; one Tab reaches the fixed sound control.
      await page.keyboard.press('Tab');
      await page.waitForTimeout(250);
      const afterTab = await page.evaluate(() => ({
        active: document.activeElement?.id ?? '',
        intro: document.querySelector('wormhole-bg')?.getAttribute('data-intro') ?? null,
      }));
      check(
        'keyboard Tab to the sound toggle does not end the intro (patch #1)',
        afterTab.active === 'sound-toggle' && afterTab.intro === 'playing',
        `focus=${afterTab.active} intro=${afterTab.intro}`,
      );

      // Manual off: fade, then the pause event tells the truth.
      await page.click('#sound-toggle');
      await page.waitForTimeout(FADE_OUT_MS + 400);
      const muted = await snapshot(page);
      check(
        'manual mute pauses and labels Sound off',
        muted.paused === true && muted.label === 'Sound off' && muted.pressed === 'false',
        `paused=${muted.paused} label=${muted.label} pressed=${muted.pressed}`,
      );
      check('manual mute persists sound=off', muted.soundPreference === 'off');

      // Manual on again: the click is the gesture.
      await page.click('#sound-toggle');
      await page.waitForFunction(
        () => document.querySelector('[data-sound-label]')?.textContent?.trim() === 'Sound on',
        null,
        { timeout: 5000 },
      );
      const resumed = await snapshot(page);
      check(
        'manual enable resumes music and persists sound=on',
        resumed.paused === false && resumed.soundPreference === 'on',
        `paused=${resumed.paused} sound=${resumed.soundPreference}`,
      );

      const fade = await trace(page);
      check('manual mute uses a GainNode ramp, never element volume', hasTwoSecondFadeToZero(fade));
      await context.close();
    }

    // ── 3. Natural end and site watchdog ─────────────────────────────────────
    {
      const { context, page } = await open({ init: instrumentAudio });
      await waitForIntroStart(page);
      await waitForIntroEnd(page);
      const natural = await snapshot(page);
      check(
        'natural end releases the shell and returns the control to the header',
        natural.shellInert === false && natural.label === 'Replay intro with sound',
        `inert=${natural.shellInert} label=${natural.label}`,
      );
      await page.waitForTimeout(FADE_OUT_MS + 400);
      const naturalAfter = await snapshot(page);
      check('natural end fades the music out', hasTwoSecondFadeToZero(await trace(page)));
      check(
        'natural end pauses and detaches the audio source',
        naturalAfter.paused === true && naturalAfter.src === null,
        `paused=${naturalAfter.paused} src=${naturalAfter.src}`,
      );

      // Replay: the post-intro control re-arms both the intro and the music.
      await page.click('#sound-toggle');
      await waitForIntroStart(page);
      const replay = await snapshot(page);
      check(
        'replay restarts the intro and its music',
        replay.intro === 'playing' && replay.paused === false && replay.label === 'Sound on',
        `intro=${replay.intro} paused=${replay.paused} label=${replay.label}`,
      );
      await page.keyboard.press('Escape');
      await waitForIntroEnd(page);
      await page.waitForTimeout(FADE_OUT_MS + 400);
      const watchdogTraceStart = (await trace(page)).length;

      // Site watchdog: a synthetic introstart with no matching vendor intro
      // (the "introend never fires" case). The 12 s timer must release both
      // the shell and the audio.
      await page.evaluate(() => {
        document
          .querySelector('wormhole-bg')
          .dispatchEvent(new CustomEvent('wormhole:introstart', { bubbles: true, composed: true }));
      });
      await page.waitForTimeout(600);
      const watchdogMid = await snapshot(page);
      check('site watchdog re-arms shell inert + intro control', watchdogMid.shellInert === true);
      await page.waitForTimeout(INTRO_WATCHDOG_MS + 800);
      const watchdogEnd = await page.evaluate(() => ({
        state: window.__siteStates.at(-1) ?? null,
        inert: document.querySelector('[data-wormhole-shell]')?.hasAttribute('inert') ?? null,
      }));
      check(
        'no-event watchdog releases with reason=watchdog',
        watchdogEnd.state?.phase === 'idle' && watchdogEnd.state?.reason === 'watchdog',
        JSON.stringify(watchdogEnd.state),
      );
      check('no-event watchdog releases shell inert', watchdogEnd.inert === false);
      check(
        'no-event watchdog fades the music',
        hasTwoSecondFadeToZero((await trace(page)).slice(watchdogTraceStart)),
      );
      await context.close();
    }

    // ── 4. Failed local chunk: import failure + no-event watchdog ────────────
    {
      const { context, page } = await open({ init: instrumentAudio, abort: /element\..*\.js/ });
      await page.waitForFunction(
        () => document.documentElement.dataset.wormholeFallback === 'import-failed',
        null,
        { timeout: 10_000 },
      );
      const failed = await snapshot(page);
      check(
        'module-import failure shows the site fallback and releases the shell',
        failed.fallback === 'import-failed' && failed.shellInert === false,
        `fallback=${failed.fallback} inert=${failed.shellInert}`,
      );
      check('module-import failure never defines the element', failed.supported === null);

      // The site-level contract still holds with no controller at all.
      await page.evaluate(() => {
        document
          .querySelector('wormhole-bg')
          .dispatchEvent(new CustomEvent('wormhole:introstart', { bubbles: true, composed: true }));
      });
      await page.waitForTimeout(INTRO_WATCHDOG_MS + 900);
      const released = await page.evaluate(() => ({
        inert: document.querySelector('[data-wormhole-shell]')?.hasAttribute('inert') ?? null,
        state: window.__siteStates.at(-1) ?? null,
      }));
      check(
        'no-event watchdog cleans up after an import failure too',
        released.inert === false && released.state?.phase === 'idle',
        JSON.stringify(released.state),
      );
      check(
        'no-event watchdog still fades a playing track',
        hasTwoSecondFadeToZero(await trace(page)),
      );
      await context.close();
    }

    check(
      'no external three.js or Google Fonts request at runtime',
      externalRequests.length === 0,
      externalRequests.join(', '),
    );
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length > 0) {
    console.error(`\ncheck-audio: ${failures.length} failure(s)`);
    for (const failure of failures) console.error(` - ${failure}`);
    process.exit(1);
  }
  console.log('\ncheck-audio: all assertions passed');
}

await run();
