#!/usr/bin/env node
/**
 * Gate G1 — primitive parity (plan §4 Phase 1).
 *
 * Builds the review page with VITE_DEV_ROUTES=1 into an ignored in-repo
 * outDir, serves it, and in Chromium asserts for both theme subtrees:
 *   - every DESIGN.md primitive is present,
 *   - every interactive primitive is >= 44px tall (touch-target floor),
 *   - every interactive primitive has a visible 2px focus ring.
 *
 * The review build is separate from `dist` on purpose: the plain production
 * build must remain free of `/dev/design` (the negative gate).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  serveDirectory,
  parseCssColor,
  parsePx,
  contrastRatio,
} from './lib/harness.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const REVIEW_DIST = path.join(ROOT, 'node_modules', '.cache', 'cv-review-dist');
const ASTRO_BIN = path.join(ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs');
const MIN_TARGET_PX = 44;
const MIN_FOCUS_CONTRAST = 3;

const REQUIRED_PRIMITIVES = [
  'button-primary',
  'button-secondary',
  'button-ghost',
  'card',
  'card-elevated',
  'chip',
  'chip-rolltrack',
  'chip-saha',
  'toggle',
  'alert-error',
  'alert-success',
  'alert-warning',
  'input',
  'section-heading',
  'avatar',
  'badge',
];

const THEMES = /** @type {const} */ (['dark', 'light']);
const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, [role="button"]';

function buildReviewPage() {
  rmSync(REVIEW_DIST, { recursive: true, force: true });
  try {
    execFileSync(
      process.execPath,
      [ASTRO_BIN, 'build', '--outDir', REVIEW_DIST],
      {
        cwd: ROOT,
        env: { ...process.env, VITE_DEV_ROUTES: '1' },
        stdio: 'pipe',
      },
    );
  } catch (error) {
    const failure = /** @type {{ stdout?: Buffer; stderr?: Buffer }} */ (error);
    process.stderr.write(failure.stdout?.toString() ?? '');
    process.stderr.write(failure.stderr?.toString() ?? '');
    throw new Error('Review build (VITE_DEV_ROUTES=1) failed');
  }

  const pageFile = path.join(REVIEW_DIST, 'dev', 'design', 'index.html');
  if (!existsSync(pageFile)) {
    throw new Error(`Review build did not emit ${pageFile}`);
  }
  return pageFile;
}

/**
 * Establish keyboard modality, then programmatically focus the target. The
 * preceding Tab makes Chromium treat the script focus as keyboard-driven so
 * `:focus-visible` styles apply.
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} target
 */
async function focusAndMeasure(page, target) {
  await page.keyboard.press('Tab');
  await target.focus();
  /* `transition-colors` includes outline-color; let the ring settle. */
  await page.waitForTimeout(200);
  return target.evaluate((element) => {
    const style = getComputedStyle(element);
    let backgroundNode = element.parentElement;
    let background = 'rgba(0, 0, 0, 0)';
    while (backgroundNode) {
      const candidate = getComputedStyle(backgroundNode).backgroundColor;
      if (candidate && candidate !== 'rgba(0, 0, 0, 0)' && candidate !== 'transparent') {
        background = candidate;
        break;
      }
      backgroundNode = backgroundNode.parentElement;
    }
    return {
      focused: document.activeElement === element,
      focusVisible: element.matches(':focus-visible'),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor,
      background,
      height: element.getBoundingClientRect().height,
    };
  });
}

async function main() {
  buildReviewPage();

  const server = await serveDirectory(REVIEW_DIST);
  const address = server.address();
  if (!address || typeof address === 'string') {
    await new Promise((resolve) => server.close(resolve));
    throw new Error('Failed to bind the review server');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  /** @type {import('playwright').Browser | undefined} */
  let browser;

  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const response = await page.goto(`${baseUrl}/dev/design`, { waitUntil: 'load' });
    if (!response || response.status() !== 200) {
      throw new Error(`/dev/design did not return 200 (got ${response?.status()})`);
    }

    const failures = [];
    let presentCount = 0;
    let interactiveCount = 0;

    for (const theme of THEMES) {
      for (const name of REQUIRED_PRIMITIVES) {
        const wrapper = page.locator(
          `[data-theme-section="${theme}"] [data-primitive="${name}"]`,
        ).first();
        if ((await wrapper.count()) === 0) {
          failures.push(`${theme}: missing primitive "${name}"`);
          continue;
        }
        presentCount += 1;

        if (!(await wrapper.isVisible())) {
          failures.push(`${theme}: primitive "${name}" is not visible`);
          continue;
        }

        const selfInteractive = await wrapper.evaluate(
          (element, selector) => element.matches(selector),
          INTERACTIVE_SELECTOR,
        );
        const target = selfInteractive
          ? wrapper
          : wrapper.locator(INTERACTIVE_SELECTOR).first();

        if ((await target.count()) === 0) continue;

        interactiveCount += 1;
        const measured = await focusAndMeasure(page, target);

        if (!measured.focused) {
          failures.push(`${theme}: "${name}" could not receive focus`);
        }
        if (measured.height < MIN_TARGET_PX - 0.01) {
          failures.push(
            `${theme}: "${name}" is ${measured.height.toFixed(1)}px tall (minimum ${MIN_TARGET_PX}px)`,
          );
        }

        const outlineWidth = parsePx(measured.outlineWidth) ?? 0;
        const ringColor = parseCssColor(measured.outlineColor);
        const background = parseCssColor(measured.background);
        if (
          !measured.focusVisible ||
          measured.outlineStyle === 'none' ||
          outlineWidth < 2 ||
          !ringColor ||
          !background
        ) {
          failures.push(
            `${theme}: "${name}" focus ring missing (visible=${measured.focusVisible}, style=${measured.outlineStyle}, width=${measured.outlineWidth}, colour=${measured.outlineColor})`,
          );
          continue;
        }

        const ringContrast = contrastRatio(ringColor, background);
        if (ringContrast < MIN_FOCUS_CONTRAST) {
          failures.push(
            `${theme}: "${name}" focus ring contrast ${ringContrast.toFixed(2)}:1 against ${measured.background} (minimum ${MIN_FOCUS_CONTRAST}:1)`,
          );
        }
      }
    }

    if (failures.length > 0) {
      console.error('Primitive parity FAILED:');
      for (const failure of failures) console.error(`  - ${failure}`);
      process.exitCode = 1;
      return;
    }

    console.log('Primitive parity PASSED');
    console.log(
      `  ${presentCount}/${REQUIRED_PRIMITIVES.length * THEMES.length} primitive instances present in both themes`,
    );
    console.log(
      `  ${interactiveCount} interactive instances: height ≥ ${MIN_TARGET_PX}px and focus ring ≥ ${MIN_FOCUS_CONTRAST}:1`,
    );
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(String(error));
  process.exitCode = 1;
});
