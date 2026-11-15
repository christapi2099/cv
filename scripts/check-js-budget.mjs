#!/usr/bin/env node
/**
 * Gate G6 — artifact-level JS budget (plan.md §4 Phase 6.2).
 *
 * Measures the built `dist/` output, not the source:
 *   - initial route JS (static import closure of the route's module scripts)
 *     ≤ 60 KB gzip,
 *   - the lazy effect closure (dynamic-imported wormhole element + three.js)
 *     ≤ 220 KB gzip,
 *   - every app chunk emitted for the site ≤ 300 KB gzip total.
 *
 * Pagefind's runtime is excluded: it is a post-build search index served only
 * on `/search` and already gated separately (D5). Everything is gzip -9, and
 * KB means 1024 bytes, so the gate is stricter than a decimal interpretation.
 *
 * Usage: node scripts/check-js-budget.mjs [--verbose]
 * Run after `pnpm build`.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ASTRO_DIR = path.join(DIST, '_astro');
const KIB = 1024;
const BUDGETS = {
  initialRoute: 60 * KIB,
  lazyEffect: 220 * KIB,
  total: 300 * KIB,
};
const STATIC_IMPORT = /\b(?:from|import)\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
const SCRIPT_SRC = /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["']/gi;

const verbose = process.argv.includes('--verbose');

function gzipBytes(source) {
  return gzipSync(source, { level: 9 }).length;
}

/** Resolve a chunk specifier (`/_astro/x.js` or `./x.js`) to a dist URL. */
function toChunkUrl(specifier, fromUrl) {
  const clean = specifier.split('?')[0].split('#')[0];
  if (clean.startsWith('/_astro/')) return clean;
  if (clean.startsWith('./') || clean.startsWith('../')) {
    return new URL(clean, `https://dist.local${fromUrl}`).pathname;
  }
  return null;
}

async function listChunks() {
  const names = await readdir(ASTRO_DIR);
  const chunks = new Map();

  for (const name of names.filter((entry) => entry.endsWith('.js')).sort()) {
    const file = path.join(ASTRO_DIR, name);
    const [source, info] = await Promise.all([readFile(file), stat(file)]);
    chunks.set(`/_astro/${name}`, {
      source: source.toString('utf8'),
      raw: info.size,
      gzip: gzipBytes(source),
    });
  }

  return chunks;
}

/** Follow `import ... from './chunk.js'` edges, returning a URL set. */
function importClosure(entries, chunks, { followDynamic = false } = {}) {
  const seen = new Set();
  const queue = [...entries];

  while (queue.length > 0) {
    const current = queue.shift();
    if (seen.has(current) || !chunks.has(current)) continue;
    seen.add(current);
    const source = chunks.get(current).source;
    for (const match of source.matchAll(STATIC_IMPORT)) {
      const target = toChunkUrl(match[1], current);
      if (target !== null && !seen.has(target)) queue.push(target);
    }
    if (followDynamic) {
      for (const match of source.matchAll(DYNAMIC_IMPORT)) {
        const target = toChunkUrl(match[1], current);
        if (target !== null && !seen.has(target)) queue.push(target);
      }
    }
  }

  return seen;
}

/** Chunk URLs the site loads lazily from an initial route closure. */
function dynamicTargets(urls, chunks) {
  const targets = new Set();
  for (const url of urls) {
    for (const match of chunks.get(url).source.matchAll(DYNAMIC_IMPORT)) {
      const target = toChunkUrl(match[1], url);
      if (target !== null && !urls.has(target)) targets.add(target);
    }
  }
  return targets;
}

async function listRoutes() {
  const routes = [];

  async function walk(directory, segments) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === '_astro' || entry.name === 'pagefind') continue;
      const file = path.join(directory, entry.name);
      const nextSegments = [...segments, entry.name];
      if (entry.isDirectory()) {
        await walk(file, nextSegments);
      } else if (entry.name.endsWith('.html')) {
        const html = await readFile(file, 'utf8');
        const scripts = [...html.matchAll(SCRIPT_SRC)].map((match) => toChunkUrl(match[1], '/'));
        const route =
          nextSegments.join('/') === 'index.html'
            ? '/'
            : `/${nextSegments.join('/').replace(/\/index\.html$/, '').replace(/\.html$/, '')}`;
        routes.push({ route, scripts: scripts.filter((entry) => entry !== null) });
      }
    }
  }

  await walk(DIST, []);
  return routes.sort((a, b) => a.route.localeCompare(b.route));
}

function sizeOf(urls, chunks) {
  let raw = 0;
  let gzip = 0;
  for (const url of urls) {
    raw += chunks.get(url).raw;
    gzip += chunks.get(url).gzip;
  }
  return { raw, gzip };
}

function formatKiB(bytes) {
  return `${(bytes / KIB).toFixed(2)} KiB`;
}

async function main() {
  let chunks;
  try {
    chunks = await listChunks();
  } catch (error) {
    console.error(`check-js-budget: no dist/_astro chunks (${error?.code ?? error}). Run \`pnpm build\` first.`);
    process.exitCode = 1;
    return;
  }

  if (chunks.size === 0) {
    console.error('check-js-budget: dist/_astro has no JS chunks. Run `pnpm build` first.');
    process.exitCode = 1;
    return;
  }

  const routes = await listRoutes();
  if (routes.length === 0) {
    console.error('check-js-budget: dist/ has no HTML routes. Run `pnpm build` first.');
    process.exitCode = 1;
    return;
  }

  const initialPerRoute = new Map();
  for (const { route, scripts } of routes) {
    initialPerRoute.set(route, importClosure(scripts, chunks));
  }
  const initialUrls = new Set();
  for (const urls of initialPerRoute.values()) {
    for (const url of urls) initialUrls.add(url);
  }

  // The effect closure starts at every dynamic import reachable from an
  // initial route closure (currently exactly `/element-*.js`) and includes
  // anything the effect itself loads later (three.js is a dynamic import of
  // the element). Chunks already in the initial closure are not double-counted.
  const effectEntries = new Set();
  for (const urls of initialPerRoute.values()) {
    for (const target of dynamicTargets(urls, chunks)) effectEntries.add(target);
  }
  const effectAll = importClosure(effectEntries, chunks, { followDynamic: true });
  const lazyEffect = new Set([...effectAll].filter((url) => !initialUrls.has(url)));
  const lazySize = sizeOf(lazyEffect, chunks);

  const initialSizes = [...initialPerRoute.entries()].map(([route, urls]) => ({
    route,
    ...sizeOf(urls, chunks),
    chunks: urls.size,
  }));
  const heaviestRoute = initialSizes.reduce((left, right) =>
    right.gzip > left.gzip ? right : left,
  );

  const allAppChunks = new Set(chunks.keys());
  const totalSize = sizeOf(allAppChunks, chunks);

  const failures = [];
  if (heaviestRoute.gzip > BUDGETS.initialRoute) {
    failures.push(
      `initial route JS ${formatKiB(heaviestRoute.gzip)} > ${formatKiB(BUDGETS.initialRoute)} (${heaviestRoute.route})`,
    );
  }
  if (lazySize.gzip > BUDGETS.lazyEffect) {
    failures.push(
      `lazy effect JS ${formatKiB(lazySize.gzip)} > ${formatKiB(BUDGETS.lazyEffect)}`,
    );
  }
  if (totalSize.gzip > BUDGETS.total) {
    failures.push(`total JS ${formatKiB(totalSize.gzip)} > ${formatKiB(BUDGETS.total)}`);
  }

  console.log('check-js-budget (gzip -9, 1 KB = 1024 B)');
  console.log('route                                initial raw      initial gzip   chunks');
  for (const entry of initialSizes) {
    console.log(
      `${entry.route.padEnd(36)} ${String(entry.raw).padStart(8)} B  ${formatKiB(entry.gzip).padStart(14)}   ${entry.chunks}`,
    );
  }
  console.log(
    `lazy effect (element + three)         ${String(lazySize.raw).padStart(8)} B  ${formatKiB(lazySize.gzip).padStart(14)}   ${lazyEffect.size}`,
  );
  console.log(
    `total app JS                          ${String(totalSize.raw).padStart(8)} B  ${formatKiB(totalSize.gzip).padStart(14)}   ${allAppChunks.size}`,
  );

  if (verbose) {
    const classify = (urls) =>
      initialUrls.has(urls) ? 'initial' : effectAll.has(urls) ? 'effect' : 'orphan';
    console.log('\nper-asset:');
    for (const [url, info] of [...chunks.entries()].sort((a, b) => b[1].gzip - a[1].gzip)) {
      console.log(
        `${classify(url).padEnd(8)} ${String(info.raw).padStart(8)} B ${formatKiB(info.gzip).padStart(14)}  ${url}`,
      );
    }
  }

  console.log(
    `\nbudgets: initial ≤ ${formatKiB(BUDGETS.initialRoute)}, effect ≤ ${formatKiB(BUDGETS.lazyEffect)}, total ≤ ${formatKiB(BUDGETS.total)}` +
      ' (Pagefind runtime measured separately and excluded)',
  );

  if (failures.length > 0) {
    for (const failure of failures) console.error(`✗ ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log('check-js-budget: PASS.');
}

await main();
