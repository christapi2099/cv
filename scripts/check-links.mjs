#!/usr/bin/env node
/**
 * Gate G4/G6 — DOM-level link checker (plan.md §4 Phase 4.2/4, Phase 6.1).
 *
 * Crawls the built `dist/` HTML (not the dev server) and verifies:
 *   - every internal `href`/`src` resolves to a file the build emitted,
 *   - every fragment (`/work#full-stack`, `#main`) resolves to an `id` or
 *     `name` in the target document — curl cannot check this, so it is done
 *     here against the emitted DOM.
 *
 * External links are reported (unique, with their source pages) but never
 * fetched; their liveness is out of scope for a hermetic build gate.
 *
 * Usage: node scripts/check-links.mjs [--verbose]
 * Run after `pnpm build`.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SKIP_DIRS = new Set(['pagefind']);
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const NON_HTTP_SCHEMES = /^(?:mailto|tel|javascript|data|sms):/i;
const SITE_ORIGIN = (() => {
  try {
    return new URL(process.env.SITE_URL?.trim() || 'http://localhost:4321').origin;
  } catch {
    return null;
  }
})();

/**
 * Canonical/sitemap URLs point at the build origin (SITE_URL, or the dev
 * fallback when unset). Those are internal links and must be checked; only
 * genuinely third-party hosts are reported.
 */
function asInternalAbsolute(raw) {
  try {
    const url = new URL(raw);
    if (!/^https?:$/i.test(url.protocol)) return null;
    if (url.origin === SITE_ORIGIN || /^(localhost|127\.0\.0\.1)$/i.test(url.hostname)) return url;
  } catch {
    /* Not an absolute URL; handled as a root-relative path below. */
  }
  return null;
}
const verbose = process.argv.includes('--verbose');

const failures = [];
const externalLinks = new Map();
const pages = new Map();
const fileExists = new Map();

async function listHtml(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...(await listHtml(path.join(directory, entry.name))));
    } else if (entry.name.endsWith('.html')) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files.sort();
}

function routeFor(file) {
  const relative = path.relative(DIST, file).split(path.sep).join('/');
  if (relative === 'index.html') return '/';
  if (relative.endsWith('/index.html')) return `/${relative.slice(0, -'/index.html'.length)}`;
  return `/${relative.replace(/\.html$/, '')}`;
}

function stripCode(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

function ids(html) {
  const found = new Set();
  for (const match of html.matchAll(/\bid=["']([^"']+)["']/gi)) found.add(match[1]);
  for (const match of html.matchAll(/<a\b[^>]*\bname=["']([^"']+)["']/gi)) found.add(match[1]);
  return found;
}

/** Map a URL pathname to the emitted file that serves it. */
async function resolvePath(pathname) {
  if (pathname === '') pathname = '/';
  const decoded = decodeURIComponent(pathname);
  const relative = decoded.replace(/^\/+/, '');
  const candidates =
    relative === ''
      ? ['index.html']
      : [
          relative,
          `${relative}/index.html`,
          `${relative}.html`,
        ];

  for (const candidate of candidates) {
    const file = path.join(DIST, candidate);
    if (fileExists.has(file)) {
      if (fileExists.get(file)) return file;
      continue;
    }
    let exists = false;
    try {
      exists = (await stat(file)).isFile();
    } catch {
      exists = false;
    }
    fileExists.set(file, exists);
    if (exists) return file;
  }

  return null;
}

async function readPage(file) {
  if (!pages.has(file)) pages.set(file, await readFile(file, 'utf8'));
  return pages.get(file);
}

async function main() {
  let html;
  try {
    html = await listHtml(DIST);
  } catch (error) {
    console.error(`check-links: no dist/ (${error?.code ?? error}). Run \`pnpm build\` first.`);
    process.exitCode = 1;
    return;
  }

  if (html.length === 0) {
    console.error('check-links: dist/ has no HTML. Run `pnpm build` first.');
    process.exitCode = 1;
    return;
  }

  let checked = 0;
  for (const file of html) {
    const route = routeFor(file);
    const pageHtml = stripCode(await readPage(file));
    const attributes = [
      ...pageHtml.matchAll(/\bhref=["']([^"']+)["']/gi),
      ...pageHtml.matchAll(/\bsrc=["']([^"']+)["']/gi),
    ];

    for (const match of attributes) {
      const raw = match[1].trim();
      if (!raw || raw === '#') continue;

      if (EXTERNAL.test(raw)) {
        const absolute = asInternalAbsolute(raw);
        if (absolute === null) {
          if (NON_HTTP_SCHEMES.test(raw)) continue;
          if (!externalLinks.has(raw)) externalLinks.set(raw, new Set());
          externalLinks.get(raw).add(route);
          continue;
        }
        checked += 1;
        const targetFile = await resolvePath(absolute.pathname);
        if (targetFile === null) {
          failures.push(`${route}: ${raw} → no emitted file for "${absolute.pathname}"`);
          continue;
        }
        const fragment = absolute.hash.replace(/^#/, '');
        if (fragment && targetFile.endsWith('.html')) {
          const targetIds = ids(await readPage(targetFile));
          if (!targetIds.has(fragment)) {
            failures.push(
              `${route}: ${raw} → #${fragment} not found in ${routeFor(targetFile)}`,
            );
          }
        }
        continue;
      }

      checked += 1;
      const [pathname, fragment] = raw.split('#');
      const targetPath = pathname || route;
      const targetFile = await resolvePath(targetPath.split('?')[0]);
      if (targetFile === null) {
        failures.push(`${route}: ${raw} → no emitted file for "${targetPath}"`);
        continue;
      }

      if (fragment && targetFile.endsWith('.html')) {
        const targetIds = ids(await readPage(targetFile));
        if (!targetIds.has(fragment)) {
          failures.push(`${route}: ${raw} → #${fragment} not found in ${routeFor(targetFile)}`);
        }
      }
    }
  }

  console.log(
    `check-links: ${html.length} page(s), ${checked} internal link(s), ${externalLinks.size} unique external link(s).`,
  );

  if (externalLinks.size > 0) {
    console.log('external links (reported, not fetched):');
    for (const [url, sources] of [...externalLinks.entries()].sort()) {
      console.log(`  ${url}  ← ${[...sources].join(', ')}`);
    }
  }

  if (verbose) {
    console.log(`checked pages: ${[...pages.keys()].map((file) => routeFor(file)).join(', ')}`);
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`✗ ${failure}`);
    console.error(`\ncheck-links: ${failures.length} broken link(s).`);
    process.exitCode = 1;
    return;
  }

  console.log('check-links: PASS — every internal link and anchor resolves.');
}

await main();
