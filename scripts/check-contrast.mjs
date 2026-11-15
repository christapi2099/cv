#!/usr/bin/env node
/**
 * Gate G1 — contrast parity (plan §4 Phase 1).
 *
 * Resolves the *computed* semantic token colours in Chromium for both
 * `:root` (light) and `.dark`, recomputes WCAG 2.x ratios, and asserts both
 * DESIGN.md contrast tables within ±0.05. The pair list is exact: parsing the
 * table must yield precisely the spec's pairs, or the script fails.
 *
 * One pair in DESIGN.md is internally inconsistent (the light heading row's
 * stated 16.2:1 does not follow from the fixed `#05080d` / `#f7f5f1` colours).
 * It is reported as a documented spec defect, not silently skipped; the
 * computed pair still passes AA by a wide margin.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  serveDirectory,
  parseCssColor,
  contrastRatio,
} from './lib/harness.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TOLERANCE = 0.05;

/** Exact pair list from DESIGN.md's two measured tables. */
const EXPECTED_PAIR_KEYS = new Set([
  'dark:on-surface-heading on surface',
  'dark:on-surface on surface',
  'dark:on-surface on surface-container',
  'dark:on-surface on surface-elevated',
  'dark:on-surface-muted on surface',
  'dark:on-primary on primary',
  'dark:on-primary on primary-bright',
  'dark:on-primary-container on primary-container',
  'dark:link on surface',
  'dark:accent-lightning on primary',
  'dark:error on error-container',
  'dark:success on success-container',
  'dark:warning on warning-container',
  'dark:on-surface-heading on surface-elevated',
  'light:on-surface-heading on surface',
  'light:on-surface on surface',
  'light:on-surface-muted on surface',
  'light:link on surface',
  'light:error on error-container',
]);

/**
 * DESIGN.md's light table says `light-on-surface-heading` (#05080d) on
 * `light-surface` (#f7f5f1) is 16.2:1. The same document fixes both colours;
 * WCAG arithmetic gives 18.42:1. The colour table is the token authority, so
 * the prose ratio is the defect. Keep the pair in the exact list and surface
 * the discrepancy without weakening the AA floor.
 */
const KNOWN_SPEC_DEFECTS = new Map([
  [
    'light:on-surface-heading on surface',
    'DESIGN.md states 16.2:1, but its own colours (#05080d on #f7f5f1) compute 18.42:1. The colours table is normative, so the ratio prose is inconsistent; the pair still passes AA.',
  ],
]);

function sectionBetween(markdown, start, end) {
  const startIndex = markdown.indexOf(start);
  if (startIndex === -1) throw new Error(`DESIGN.md section not found: ${start}`);
  const endIndex = end ? markdown.indexOf(end, startIndex + start.length) : -1;
  if (end && endIndex === -1) throw new Error(`DESIGN.md section end not found: ${end}`);
  return markdown.slice(startIndex, endIndex === -1 ? undefined : endIndex);
}

function tableRows(section) {
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'))
    .map((line) => line.slice(1, -1).split('|').map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 2);
}

/** @param {string} token */
function normalizeToken(token) {
  return token.replace(/^light-/, '');
}

/** @param {string} markdown @param {'dark' | 'light'} theme */
function parseContrastTable(markdown, theme) {
  const section =
    theme === 'dark'
      ? sectionBetween(
          markdown,
          '**Measured contrast (WCAG AA):**',
          '**Project brand accents.**',
        )
      : sectionBetween(
          markdown,
          '**Light theme ("Daylight").**',
          '`primary` and `on-primary` carry over',
        );

  const pairs = [];
  for (const cells of tableRows(section)) {
    const first = cells[0] ?? '';
    const pair = /^`?([a-z0-9-]+)`?(?:\s+on\s+`?([a-z0-9-]+)`?)?$/i.exec(first);
    if (!pair) continue;

    const ratioText = cells
      .slice(1)
      .map((cell) => /(\d+(?:\.\d+)?)\s*:\s*1/.exec(cell)?.[1])
      .find((value) => value !== undefined);
    if (!ratioText) continue;

    const rawForeground = pair[1];
    const rawBackground = pair[2] ?? (theme === 'light' ? 'light-surface' : 'surface');
    const foreground = normalizeToken(rawForeground);
    const background = normalizeToken(rawBackground);
    pairs.push({
      theme,
      foreground,
      background,
      expected: Number.parseFloat(ratioText),
      key: `${theme}:${foreground} on ${background}`,
    });
  }
  return pairs;
}

function assertExactPairs(pairs) {
  const parsed = new Set(pairs.map((pair) => pair.key));
  const missing = [...EXPECTED_PAIR_KEYS].filter((key) => !parsed.has(key));
  const unexpected = [...parsed].filter((key) => !EXPECTED_PAIR_KEYS.has(key));
  if (missing.length === 0 && unexpected.length === 0) return;
  const details = [
    ...missing.map((key) => `missing from DESIGN.md: ${key}`),
    ...unexpected.map((key) => `unexpected pair in DESIGN.md: ${key}`),
  ];
  throw new Error(`DESIGN.md contrast pair list drifted:\n  - ${details.join('\n  - ')}`);
}

/** @param {import('playwright').Page} page @param {string[]} variables */
async function resolveColors(page, variables) {
  return page.evaluate((vars) => {
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(probe);
    const style = getComputedStyle(probe);
    /** @type {Record<string, string>} */
    const resolved = {};
    for (const variable of vars) {
      probe.removeAttribute('style');
      probe.style.color = `var(${variable})`;
      resolved[variable] = style.color;
    }
    probe.remove();
    return resolved;
  }, variables);
}

/** @param {import('playwright').Page} page @param {'dark' | 'light'} theme */
async function measureTheme(page, theme, variables) {
  await page.evaluate((next) => {
    document.documentElement.classList.toggle('dark', next === 'dark');
  }, theme);
  return resolveColors(page, variables);
}

async function main() {
  if (!existsSync(path.join(DIST, 'index.html'))) {
    throw new Error('dist/index.html is missing — run `pnpm build` before the contrast check');
  }

  const markdown = await readFile(path.join(ROOT, 'DESIGN.md'), 'utf8');
  const pairs = [
    ...parseContrastTable(markdown, 'dark'),
    ...parseContrastTable(markdown, 'light'),
  ];
  assertExactPairs(pairs);

  const variables = [
    ...new Set(
      pairs.flatMap((pair) => [`--color-${pair.foreground}`, `--color-${pair.background}`]),
    ),
  ];

  const server = await serveDirectory(DIST);
  const address = server.address();
  if (!address || typeof address === 'string') {
    await new Promise((resolve) => server.close(resolve));
    throw new Error('Failed to bind the preview server');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  /** @type {import('playwright').Browser | undefined} */
  let browser;

  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(baseUrl, { waitUntil: 'load' });

    const failures = [];
    const warnings = [];
    const summary = {
      dark: { checked: 0, failed: 0, defects: 0 },
      light: { checked: 0, failed: 0, defects: 0 },
    };

    for (const theme of /** @type {const} */ (['dark', 'light'])) {
      const themePairs = pairs.filter((pair) => pair.theme === theme);
      const resolved = await measureTheme(page, theme, variables);
      for (const pair of themePairs) {
        summary[theme].checked += 1;
        const foreground = parseCssColor(resolved[`--color-${pair.foreground}`] ?? '');
        const background = parseCssColor(resolved[`--color-${pair.background}`] ?? '');
        if (!foreground || !background) {
          failures.push(
            `${pair.key}: could not resolve computed colours (fg "${resolved[`--color-${pair.foreground}`]}", bg "${resolved[`--color-${pair.background}`]}")`,
          );
          summary[theme].failed += 1;
          continue;
        }

        const actual = contrastRatio(foreground, background);
        const delta = Math.abs(actual - pair.expected);
        const defect = KNOWN_SPEC_DEFECTS.get(pair.key);

        if (delta > TOLERANCE + 1e-9) {
          if (defect && actual >= 4.5) {
            warnings.push(
              `${pair.key}: DESIGN.md ${pair.expected.toFixed(2)}:1, computed ${actual.toFixed(2)}:1 (Δ${delta.toFixed(2)}) — ${defect}`,
            );
            summary[theme].defects += 1;
            continue;
          }
          failures.push(
            `${pair.key}: expected ${pair.expected.toFixed(2)}:1 (±${TOLERANCE}), computed ${actual.toFixed(2)}:1 (Δ${delta.toFixed(2)})`,
          );
          summary[theme].failed += 1;
        }
      }
    }

    if (failures.length > 0) {
      console.error('Contrast parity FAILED against DESIGN.md:');
      for (const failure of failures) console.error(`  - ${failure}`);
      for (const warning of warnings) console.error(`  ! ${warning}`);
      process.exitCode = 1;
      return;
    }

    console.log('Contrast parity PASSED against DESIGN.md');
    console.log(
      `  dark:  ${summary.dark.checked - summary.dark.failed - summary.dark.defects}/${summary.dark.checked} pairs within ±${TOLERANCE}`,
    );
    console.log(
      `  light: ${summary.light.checked - summary.light.failed - summary.light.defects}/${summary.light.checked} pairs within ±${TOLERANCE}; ${summary.light.defects} documented spec defect`,
    );
    console.log(`  exact pair list: ${pairs.length} pairs (case-normalized hex resolution)`);
    for (const warning of warnings) console.log(`  documented spec defect: ${warning}`);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(String(error));
  process.exitCode = 1;
});
