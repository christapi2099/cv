#!/usr/bin/env node
/**
 * Gate G3 — background paint contract + hero pixel diff (plan §3 / §4.5).
 *
 * Paint contract (computed, not source):
 *   html  → var(--color-surface) = rgb(5, 8, 13)
 *   body  → transparent
 *   shell → transparent
 *
 * Hero diff: the same page, same state, effect running vs `ambient-opacity=0`.
 * A real difference proves the canvas (not the text/UI) is visible behind the
 * content. `sharp` decodes both Chromium screenshots to raw pixels.
 *
 * If the browser exposes no WebGL 2 the harness reports the limitation and
 * exits 2 — run it on a GPU-enabled CI runner rather than faking a pass.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { serveDirectory, parseCssColor } from './lib/harness.mjs';

const ROOT0 = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT0, 'dist');
const VIEWPORT = { width: 1280, height: 800 };
const HERO_CLIP = { x: 0, y: 0, width: 1280, height: 720 };
const MIN_CHANGED_RATIO = 0.1; // 10% of hero pixels must move
const MIN_MEAN_DELTA = 1.5; // of 255, averaged over the whole hero
const PIXEL_THRESHOLD = 4; // per-channel delta worth counting

if (!existsSync(DIST)) {
  console.error('check-paint: dist/ is missing — run `pnpm build` first.');
  process.exit(1);
}

const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) {
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

/** @param {Buffer} a @param {Buffer} b */
async function diffPixels(a, b) {
  const left = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const right = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (left.info.width !== right.info.width || left.info.height !== right.info.height) {
    throw new Error('screenshots have different dimensions');
  }
  const channels = left.info.channels;
  const pixels = left.info.width * left.info.height;
  let changed = 0;
  let totalDelta = 0;
  for (let offset = 0; offset < left.data.length; offset += channels) {
    const delta =
      Math.abs(left.data[offset] - right.data[offset]) +
      Math.abs(left.data[offset + 1] - right.data[offset + 1]) +
      Math.abs(left.data[offset + 2] - right.data[offset + 2]);
    if (delta / 3 >= PIXEL_THRESHOLD) changed += 1;
    totalDelta += delta / 3;
  }
  return { changedRatio: changed / pixels, meanDelta: totalDelta / pixels };
}

async function run() {
  const server = await serveDirectory(DIST);
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });

  try {
    const context = await browser.newContext({
      colorScheme: 'dark',
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(document.querySelector('wormhole-bg')?.controller), null, {
      timeout: 20000,
    });
    const supported = await page.evaluate(
      () => document.querySelector('wormhole-bg')?.controller?.supported ?? false,
    );
    if (!supported) {
      console.error(
        'check-paint: WebGL 2 is unavailable in this browser; the pixel-diff gate needs a GPU-enabled runner.',
      );
      process.exitCode = 2;
      return;
    }

    // End the intro deterministically, then let ambient settle.
    await page.evaluate(() => document.querySelector('wormhole-bg')?.controller?.skipIntro());
    await page.waitForFunction(
      () => document.querySelector('wormhole-bg')?.getAttribute('data-intro') === null,
      null,
      { timeout: 5000 },
    );
    await page.waitForTimeout(1600);

    const paint = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const shell = getComputedStyle(document.querySelector('[data-wormhole-shell]'));
      const element = document.querySelector('wormhole-bg');
      return {
        html: getComputedStyle(document.documentElement).backgroundColor,
        body: body.backgroundColor,
        shell: shell.backgroundColor,
        ambientOpacity: element?.controller?.state?.ambientOpacity ?? null,
      };
    });

    const htmlColor = parseCssColor(paint.html);
    check(
      'html paints the storm surface (var(--color-surface) = #05080d)',
      htmlColor !== null && htmlColor.r === 5 && htmlColor.g === 8 && htmlColor.b === 13,
      paint.html,
    );
    check(
      'body stays transparent so the root paints beneath z-index:-1',
      /rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(paint.body),
      paint.body,
    );
    check(
      'page shell stays transparent',
      /rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(paint.shell),
      paint.shell,
    );
    check('ambient opacity is the pinned 0.4', paint.ambientOpacity === 0.4, String(paint.ambientOpacity));

    const on = await page.screenshot({ clip: HERO_CLIP });
    await page.evaluate(() => {
      document.querySelector('wormhole-bg')?.setAttribute('ambient-opacity', '0');
    });
    await page.waitForTimeout(900);
    const off = await page.screenshot({ clip: HERO_CLIP });
    const { changedRatio, meanDelta } = await diffPixels(on, off);

    check(
      'hero pixel diff proves the canvas is visible (effect on vs ambient-opacity=0)',
      changedRatio >= MIN_CHANGED_RATIO && meanDelta >= MIN_MEAN_DELTA,
      `changed=${(changedRatio * 100).toFixed(1)}% meanΔ=${meanDelta.toFixed(2)}/255 ` +
        `(threshold ${(MIN_CHANGED_RATIO * 100).toFixed(0)}% / ${MIN_MEAN_DELTA})`,
    );

    await context.close();
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length > 0) {
    console.error(`\ncheck-paint: ${failures.length} failure(s)`);
    for (const failure of failures) console.error(` - ${failure}`);
    process.exit(1);
  }
  console.log('\ncheck-paint: all assertions passed');
}

await run();
