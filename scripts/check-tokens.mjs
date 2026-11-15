#!/usr/bin/env node
/**
 * Token parity: DESIGN.md ↔ src/styles/global.css
 *
 * G1 token parity. This script:
 *   1. parses the normative token tables from DESIGN.md's frontmatter,
 *   2. builds/serves dist/ (run `pnpm build` first) and loads it in Chromium,
 *   3. resolves the *computed* value of every semantic CSS variable for both
 *      themes (server-rendered .dark, then :root/light),
 *   4. compares colors, type, radii, and spacing against DESIGN.md.
 *
 * The rest of G1 lives alongside this file: scripts/check-contrast.mjs
 * (WCAG ratios for both DESIGN.md tables) and scripts/check-primitives.mjs
 * (44px targets, visible focus rings, review-context axe).
 *
 * Light-mode container tiers are derived in CSS with color-mix because
 * DESIGN.md's light table does not enumerate them; those three variables are
 * reported as documented skips, never silently ignored.
 */
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');

/** @param {string} file */
function parseScalar(raw) {
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

/**
 * Minimal parser for the flat/nested YAML in DESIGN.md's frontmatter.
 * @param {string} markdown
 * @returns {Record<string, Record<string, string | Record<string, string>> | string>}
 */
function parseFrontmatter(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!match) throw new Error('DESIGN.md has no frontmatter block');

  const root = {};
  let section = null;
  let entry = null;
  let blockScalar = false;

  for (const rawLine of match[1].split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;
    const indent = /^\s*/.exec(rawLine)[0].length;
    const text = rawLine.trim();

    if (indent === 0) {
      blockScalar = false;
      const colon = text.indexOf(':');
      if (colon === -1) continue;
      const key = text.slice(0, colon).trim();
      const value = text.slice(colon + 1).trim();
      if (value === '') {
        root[key] = {};
        section = key;
      } else {
        root[key] = value;
        section = null;
      }
      entry = null;
      if (value === '>-' || value === '>' || value === '|' || value === '|-') {
        blockScalar = true;
      }
      continue;
    }

    if (blockScalar || !section) continue;

    const colon = text.indexOf(':');
    if (colon === -1) continue;
    const key = text.slice(0, colon).trim();
    const value = text.slice(colon + 1).trim();
    const bucket = /** @type {Record<string, string | Record<string, string>>} */ (root[section]);

    if (indent === 2) {
      if (value === '') {
        bucket[key] = {};
        entry = key;
      } else {
        bucket[key] = parseScalar(value);
        entry = null;
      }
    } else if (entry) {
      const nested = /** @type {Record<string, string>} */ (bucket[entry]);
      nested[key] = parseScalar(value);
    }
  }

  return root;
}

/** @param {string} hex */
function hexToRgb(hex) {
  const value = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) throw new Error(`Not a 6-digit hex colour: ${hex}`);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

/** @param {string} cssColor */
function parseCssColor(cssColor) {
  const match = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(cssColor);
  if (!match) return null;
  return {
    r: Number.parseFloat(match[1]),
    g: Number.parseFloat(match[2]),
    b: Number.parseFloat(match[3]),
  };
}

/** @param {string} cssLength */
function parsePx(cssLength) {
  const value = Number.parseFloat(cssLength);
  return Number.isFinite(value) ? value : null;
}

const LIGHT_SEMANTIC_OVERRIDES = {
  surface: 'light-surface',
  'on-surface': 'light-on-surface',
  'on-surface-heading': 'light-on-surface-heading',
  'on-surface-muted': 'light-on-surface-muted',
  link: 'light-link',
  outline: 'light-outline',
  error: 'light-error',
  'error-container': 'light-error-container',
};

const FONT_VAR_BY_STYLE = {
  display: '--font-display',
  'headline-lg': '--font-headline',
  'headline-md': '--font-headline',
  'headline-sm': '--font-headline',
  'body-lg': '--font-body',
  'body-md': '--font-body',
  'body-sm': '--font-body',
  'label-lg': '--font-headline',
  'label-sm': '--font-body',
  'code-md': '--font-mono',
};

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

/** @returns {Promise<import('node:http').Server>} */
function serveDist() {
  const server = createServer((request, response) => {
    void (async () => {
      try {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');
        let filePath = path.join(DIST, decodeURIComponent(url.pathname));
        if (!filePath.startsWith(DIST)) {
          response.writeHead(403).end('Forbidden');
          return;
        }
        if (!existsSync(filePath)) {
          filePath = path.join(DIST, 'index.html');
        } else {
          const { stat } = await import('node:fs/promises');
          const info = await stat(filePath);
          if (info.isDirectory()) filePath = path.join(filePath, 'index.html');
        }
        const body = await readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        response.writeHead(200, {
          'content-type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
        });
        response.end(body);
      } catch {
        response.writeHead(404).end('Not found');
      }
    })();
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  const design = parseFrontmatter(await readFile(path.join(ROOT, 'DESIGN.md'), 'utf8'));
  const colors = /** @type {Record<string, string>} */ (design.colors);
  const typography = /** @type {Record<string, Record<string, string>>} */ (design.typography);
  const rounded = /** @type {Record<string, string>} */ (design.rounded);
  const spacing = /** @type {Record<string, string>} */ (design.spacing);
  if (!colors || !typography || !rounded || !spacing) {
    throw new Error('DESIGN.md frontmatter is missing a token section');
  }

  if (!existsSync(path.join(DIST, 'index.html'))) {
    throw new Error('dist/index.html is missing — run `pnpm build` before the parity check');
  }

  const serverHtml = await readFile(path.join(DIST, 'index.html'), 'utf8');
  const failures = [];
  if (!/<html[^>]*class="[^"]*\bdark\b/.test(serverHtml)) {
    failures.push('built HTML does not render <html class="dark">');
  }

  const darkColorTokens = Object.entries(colors).filter(([name]) => !name.startsWith('light-'));
  const lightPaletteTokens = Object.entries(colors).filter(([name]) => name.startsWith('light-'));
  const derivedInLight = new Set(['surface-container', 'surface-elevated', 'outline-variant']);

  const requests = [];
  for (const [name] of darkColorTokens) {
    requests.push({ kind: 'color', variable: `--color-${name}` });
  }
  for (const [name] of lightPaletteTokens) {
    requests.push({ kind: 'color', variable: `--color-${name}` });
  }
  for (const [name, style] of Object.entries(typography)) {
    requests.push({ kind: 'font-family', variable: FONT_VAR_BY_STYLE[name] ?? '' });
    requests.push({ kind: 'font-size', variable: `--text-${name}` });
    requests.push({ kind: 'font-weight', variable: `--text-${name}--font-weight` });
    requests.push({ kind: 'line-height', variable: `--text-${name}--line-height` });
    if (style.letterSpacing !== undefined) {
      requests.push({
        kind: 'letter-spacing',
        variable: `--text-${name}--letter-spacing`,
        fontVariable: `--text-${name}`,
      });
    }
  }
  for (const name of Object.keys(rounded)) {
    requests.push({ kind: 'radius', variable: `--radius-${name}` });
  }
  for (const name of Object.keys(spacing)) {
    requests.push({ kind: 'spacing', variable: `--spacing-${name}` });
  }

  const server = await serveDist();
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

    /** @param {'dark' | 'light'} theme */
    const measure = async (theme) => {
      if (theme === 'light') {
        await page.evaluate(() => document.documentElement.classList.remove('dark'));
      } else {
        await page.evaluate(() => document.documentElement.classList.add('dark'));
      }
      return page.evaluate((specs) => {
        const probe = document.createElement('div');
        probe.setAttribute('aria-hidden', 'true');
        document.body.appendChild(probe);
        const style = getComputedStyle(probe);
        /** @type {Record<string, string>} */
        const resolved = {};
        for (const spec of specs) {
          probe.removeAttribute('style');
          if (spec.kind === 'color') probe.style.color = `var(${spec.variable})`;
          else if (spec.kind === 'font-family') probe.style.fontFamily = `var(${spec.variable})`;
          else if (spec.kind === 'font-size') probe.style.fontSize = `var(${spec.variable})`;
          else if (spec.kind === 'font-weight') probe.style.fontWeight = `var(${spec.variable})`;
          else if (spec.kind === 'line-height') probe.style.lineHeight = `var(${spec.variable})`;
          else if (spec.kind === 'letter-spacing') {
            if (spec.fontVariable) probe.style.fontSize = `var(${spec.fontVariable})`;
            probe.style.letterSpacing = `var(${spec.variable})`;
          }
          else if (spec.kind === 'radius') probe.style.borderTopLeftRadius = `var(${spec.variable})`;
          else if (spec.kind === 'spacing') probe.style.paddingLeft = `var(${spec.variable})`;

          if (spec.kind === 'color') resolved[spec.variable] = style.color;
          else if (spec.kind === 'font-family') resolved[spec.variable] = style.fontFamily;
          else if (spec.kind === 'font-size') resolved[spec.variable] = style.fontSize;
          else if (spec.kind === 'font-weight') resolved[spec.variable] = style.fontWeight;
          else if (spec.kind === 'line-height') resolved[spec.variable] = style.lineHeight;
          else if (spec.kind === 'letter-spacing') resolved[spec.variable] = style.letterSpacing;
          else if (spec.kind === 'radius') resolved[spec.variable] = style.borderTopLeftRadius;
          else if (spec.kind === 'spacing') resolved[spec.variable] = style.paddingLeft;
        }
        probe.remove();
        return resolved;
      }, requests);
    };

    const dark = await measure('dark');
    const light = await measure('light');

    const checkColor = (scope, variable, expectedHex, resolved) => {
      const expected = hexToRgb(expectedHex);
      const actual = parseCssColor(resolved);
      if (!actual) {
        failures.push(`${scope} ${variable}: expected ${expectedHex}, got unparseable "${resolved}"`);
        return;
      }
      const same =
        Math.round(actual.r) === expected.r &&
        Math.round(actual.g) === expected.g &&
        Math.round(actual.b) === expected.b;
      if (!same) {
        failures.push(
          `${scope} ${variable}: expected ${expectedHex} (rgb ${expected.r}, ${expected.g}, ${expected.b}), got ${resolved}`,
        );
      }
    };

    const checkLength = (scope, variable, expected, resolved) => {
      const parsed = parsePx(resolved);
      /* Chromium serializes a zero letter-spacing as "normal"; they are equal. */
      const actual = parsed === null && resolved === 'normal' && expected === 0 ? 0 : parsed;
      if (actual === null || Math.abs(actual - expected) > 0.01) {
        failures.push(`${scope} ${variable}: expected ${expected}px, got "${resolved}"`);
      }
    };

    let darkChecked = 0;
    for (const [name, expected] of darkColorTokens) {
      checkColor('dark', `--color-${name}`, expected, dark[`--color-${name}`]);
      darkChecked += 1;
    }

    let lightPaletteChecked = 0;
    for (const [name, expected] of lightPaletteTokens) {
      checkColor('light-palette', `--color-${name}`, expected, dark[`--color-${name}`]);
      lightPaletteChecked += 1;
    }

    let lightSemanticChecked = 0;
    const lightSkips = [];
    for (const [name, darkValue] of darkColorTokens) {
      if (derivedInLight.has(name)) {
        lightSkips.push(`--color-${name}`);
        continue;
      }
      const lightName = LIGHT_SEMANTIC_OVERRIDES[name];
      const expected = lightName ? colors[lightName] : darkValue;
      if (!expected) {
        failures.push(`light --color-${name}: DESIGN.md has no light binding (looked for ${lightName})`);
        continue;
      }
      checkColor('light', `--color-${name}`, expected, light[`--color-${name}`]);
      lightSemanticChecked += 1;
    }

    let typographyChecked = 0;
    for (const [name, style] of Object.entries(typography)) {
      const familyVar = FONT_VAR_BY_STYLE[name] ?? '';
      const family = dark[familyVar] ?? '';
      const firstFamily = family.split(',')[0]?.replace(/["']/g, '').trim().toLowerCase() ?? '';
      if (firstFamily !== style.fontFamily.trim().toLowerCase()) {
        failures.push(
          `typography ${name}: expected font-family ${style.fontFamily}, got "${family}"`,
        );
      }

      const size = parsePx(dark[`--text-${name}`]);
      if (size === null || Math.abs(size - Number.parseFloat(style.fontSize)) > 0.01) {
        failures.push(
          `typography ${name}: expected font-size ${style.fontSize}, got "${dark[`--text-${name}`]}"`,
        );
      }

      checkLength(
        'typography',
        `--text-${name}--line-height`,
        Number.parseFloat(style.lineHeight),
        dark[`--text-${name}--line-height`],
      );

      if (Number(dark[`--text-${name}--font-weight`]) !== Number(style.fontWeight)) {
        failures.push(
          `typography ${name}: expected font-weight ${style.fontWeight}, got "${dark[`--text-${name}--font-weight`]}"`,
        );
      }

      if (style.letterSpacing !== undefined) {
        const expectedTracking =
          Number.parseFloat(style.letterSpacing) * /** @type {number} */ (size);
        checkLength(
          'typography',
          `--text-${name}--letter-spacing`,
          expectedTracking,
          dark[`--text-${name}--letter-spacing`],
        );
      }
      typographyChecked += 1;
    }

    let roundedChecked = 0;
    for (const [name, expected] of Object.entries(rounded)) {
      checkLength('rounded', `--radius-${name}`, Number.parseFloat(expected), dark[`--radius-${name}`]);
      roundedChecked += 1;
    }

    let spacingChecked = 0;
    for (const [name, expected] of Object.entries(spacing)) {
      checkLength('spacing', `--spacing-${name}`, Number.parseFloat(expected), dark[`--spacing-${name}`]);
      spacingChecked += 1;
    }

    if (failures.length > 0) {
      console.error('Token parity FAILED against DESIGN.md:');
      for (const failure of failures) console.error(`  - ${failure}`);
      process.exitCode = 1;
      return;
    }

    console.log('Token parity PASSED against DESIGN.md');
    console.log(`  dark palette:      ${darkChecked}/${darkColorTokens.length} tokens`);
    console.log(`  light palette:     ${lightPaletteChecked}/${lightPaletteTokens.length} tokens`);
    console.log(`  light semantics:   ${lightSemanticChecked}/${darkColorTokens.length - lightSkips.length} tokens`);
    console.log(`  typography:        ${typographyChecked}/${Object.keys(typography).length} styles`);
    console.log(`  rounded:           ${roundedChecked}/${Object.keys(rounded).length} tokens`);
    console.log(`  spacing:           ${spacingChecked}/${Object.keys(spacing).length} tokens`);
    if (lightSkips.length > 0) {
      console.log(
        `  documented skips:  ${lightSkips.join(', ')} (light container tiers are color-mix derivations; DESIGN.md's light table does not enumerate them)`,
      );
    }
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(String(error));
  process.exitCode = 1;
});
