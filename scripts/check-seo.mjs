#!/usr/bin/env node
/**
 * Gate G4 — SEO contract check (plan.md §4 Phase 4, plan §2 scripts list).
 *
 * Walks the built HTML and asserts, per route:
 *   - non-empty <title> and meta description,
 *   - a canonical URL whose pathname matches the emitted route,
 *   - Open Graph + Twitter card metadata,
 *   - the route's applicable JSON-LD types,
 *   - /404 is `noindex, nofollow`.
 *
 * Run after `pnpm build`; the plain production build must not contain
 * /dev/design (that is G0's negative gate, checked elsewhere).
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
/**
 * The canonical origin the build was configured with. `astro.config.mjs`
 * asserts a non-localhost origin for CI/Vercel builds; this check proves every
 * emitted canonical actually uses it (review pass 1: no silent localhost).
 */
const SITE_ORIGIN = new URL(
  process.env.SITE_URL?.trim() || 'http://localhost:4321',
).origin;
const SKIP_DIRS = new Set([
  '_astro',
  'pagefind',
  'fonts',
  'brand',
  'audio',
  'media',
  'dev',
]);

const failures = [];

async function main() {
  const files = await listHtml(DIST);
  if (files.length === 0) {
    console.error('check-seo: no HTML files found under dist/ — run `pnpm build` first.');
    process.exitCode = 1;
    return;
  }

  for (const file of files) {
    await checkPage(file);
  }

  await checkRobots();
  await checkLlmsTxt();

  if (failures.length > 0) {
    for (const failure of failures) console.error(`✗ ${failure}`);
    console.error(`\ncheck-seo: ${failures.length} failure(s).`);
    process.exitCode = 1;
    return;
  }

  console.log(`check-seo: ${files.length} page(s) valid.`);
}

async function listHtml(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...(await listHtml(path.join(directory, entry.name))));
    } else if (entry.name.endsWith('.html')) {
      files.push(path.join(directory, entry.name));
    }
  }

  return files.sort();
}

async function checkPage(file) {
  const relative = path.relative(DIST, file).split(path.sep).join('/');
  const route = routeFor(relative);
  const html = await readFile(file, 'utf8');
  const prefix = `${route}:`;

  const title = firstMatch(html, /<title>([\s\S]*?)<\/title>/i);
  if (!title?.trim()) failures.push(`${prefix} missing a non-empty <title>`);

  const description = metaContent(html, 'description');
  if (!description?.trim()) failures.push(`${prefix} missing a non-empty meta description`);

  const canonical = canonicalHref(html);
  if (!canonical) {
    failures.push(`${prefix} missing <link rel="canonical">`);
  } else {
    const canonicalPath = pathnameOf(canonical);
    if (canonicalPath !== expectedCanonicalPath(route)) {
      failures.push(
        `${prefix} canonical path is "${canonicalPath}", expected "${expectedCanonicalPath(route)}"`,
      );
    }
    const canonicalOrigin = originOf(canonical);
    if (canonicalOrigin !== SITE_ORIGIN) {
      failures.push(
        `${prefix} canonical origin is "${canonicalOrigin}", expected the configured site origin "${SITE_ORIGIN}"`,
      );
    }
  }

  for (const property of ['og:title', 'og:description', 'og:url', 'og:type']) {
    if (!propertyContent(html, property)?.trim()) {
      failures.push(`${prefix} missing ${property}`);
    }
  }
  // Every page must carry an absolute social image: the default card from
  // src/lib/seo.ts, or a page-specific override.
  for (const property of ['og:image', 'og:image:alt']) {
    if (!propertyContent(html, property)?.trim()) {
      failures.push(`${prefix} missing ${property}`);
    }
  }
  const ogImage = propertyContent(html, 'og:image');
  if (ogImage?.trim() && !/^https?:\/\//i.test(ogImage)) {
    failures.push(`${prefix} og:image "${ogImage}" is not an absolute URL`);
  }
  if (!metaContent(html, 'twitter:card')?.trim()) {
    failures.push(`${prefix} missing twitter:card`);
  }
  const twitterImage = metaContent(html, 'twitter:image');
  if (!twitterImage?.trim()) {
    failures.push(`${prefix} missing twitter:image`);
  } else if (!/^https?:\/\//i.test(twitterImage)) {
    failures.push(`${prefix} twitter:image "${twitterImage}" is not an absolute URL`);
  }

  const types = await jsonLdTypes(html, prefix);
  const required = requiredTypes(route);
  for (const requirement of required) {
    if (!requirement.anyOf.some((type) => types.has(type))) {
      failures.push(`${prefix} missing JSON-LD type ${requirement.anyOf.join(' or ')}`);
    }
  }

  if (route === '/404') {
    const robots = metaContent(html, 'robots');
    if (!robots?.toLowerCase().includes('noindex')) {
      failures.push(`${prefix} must render robots noindex on the 404 page`);
    }
  }
}

/**
 * `/robots.txt` (plan.md §3 URL policy): present, permissive, and pointing at
 * the absolute sitemap URL on the configured origin — never a relative path
 * or localhost.
 */
async function checkRobots() {
  const robotsPath = path.join(DIST, 'robots.txt');
  let body;
  try {
    body = await readFile(robotsPath, 'utf8');
  } catch {
    failures.push('/robots.txt: missing — the build must emit it (src/pages/robots.txt.ts)');
    return;
  }

  if (!/^User-agent:\s*\*$/im.test(body)) {
    failures.push('/robots.txt: missing "User-agent: *"');
  }
  if (!/^Allow:\s*\/$/im.test(body)) {
    failures.push('/robots.txt: missing "Allow: /"');
  }

  const sitemap = /^Sitemap:\s*(\S+)\s*$/im.exec(body)?.[1];
  if (!sitemap) {
    failures.push('/robots.txt: missing a "Sitemap:" line');
  } else if (!/^https?:\/\//i.test(sitemap)) {
    failures.push(`/robots.txt: sitemap "${sitemap}" is not an absolute URL`);
  } else if (originOf(sitemap) !== SITE_ORIGIN) {
    failures.push(
      `/robots.txt: sitemap origin is "${originOf(sitemap)}", expected the configured site origin "${SITE_ORIGIN}"`,
    );
  } else if (pathnameOf(sitemap) !== '/sitemap-index.xml') {
    failures.push(`/robots.txt: sitemap path is "${pathnameOf(sitemap)}", expected "/sitemap-index.xml"`);
  }
}

/**
 * `/llms.txt` (llmstxt.org convention, owner request Phase 6-G): present, an H1
 * index, and every markdown link absolute on the configured origin. Same
 * contract as robots.txt — an LLM crawler never receives a relative path,
 * localhost, or a Ghost host.
 */
async function checkLlmsTxt() {
  const llmsPath = path.join(DIST, 'llms.txt');
  let body;
  try {
    body = await readFile(llmsPath, 'utf8');
  } catch {
    failures.push('/llms.txt: missing — the build must emit it (src/pages/llms.txt.ts)');
    return;
  }

  if (!/^# \S/m.test(body)) {
    failures.push('/llms.txt: missing a top-level "# " heading');
  }

  const links = [...new Set([...body.matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1]))];
  if (links.length === 0) {
    failures.push('/llms.txt: no markdown links');
    return;
  }

  for (const link of links) {
    if (!/^https?:\/\//i.test(link)) {
      failures.push(`/llms.txt: link "${link}" is not an absolute URL`);
    } else if (originOf(link) !== SITE_ORIGIN) {
      failures.push(
        `/llms.txt: link origin is "${originOf(link)}", expected the configured site origin "${SITE_ORIGIN}"`,
      );
    }
  }

  for (const pathname of ['/rss.xml', '/sitemap-index.xml']) {
    if (!links.some((link) => pathnameOf(link) === pathname)) {
      failures.push(`/llms.txt: missing a link to "${pathname}"`);
    }
  }
}

function routeFor(relative) {
  if (relative === 'index.html') return '/';
  if (relative === '404.html') return '/404';
  if (relative.endsWith('/index.html')) {
    return `/${relative.slice(0, -'index.html'.length).replace(/\/+$/, '')}`;
  }
  return `/${relative.replace(/\.html$/, '')}`;
}

function expectedCanonicalPath(route) {
  return route === '/' ? '/' : route.replace(/\/+$/, '');
}

function pathnameOf(url) {
  try {
    return new URL(url).pathname.replace(/\/+$/, '') || '/';
  } catch {
    return url;
  }
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function requiredTypes(route) {
  if (route === '/') {
    return [{ anyOf: ['Person'] }, { anyOf: ['WebSite'] }];
  }
  if (route === '/cv' || route === '/about') {
    return [{ anyOf: ['Person'] }];
  }
  if (route === '/work') {
    return [{ anyOf: ['CollectionPage'] }];
  }
  if (route.startsWith('/work/')) {
    return [{ anyOf: ['Article', 'BlogPosting'] }];
  }
  if (route === '/blog') {
    return [{ anyOf: ['CollectionPage'] }];
  }
  if (route.startsWith('/blog/')) {
    return [{ anyOf: ['Article', 'BlogPosting'] }];
  }
  if (route === '/series' || route.startsWith('/series/')) {
    return [{ anyOf: ['CollectionPage'] }];
  }
  return [];
}

async function jsonLdTypes(html, prefix) {
  const types = new Set();
  const pattern =
    /<script\b[^>]*type\s*=\s*("|')application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(pattern)) {
    const payload = match[2]?.trim();
    if (!payload) {
      failures.push(`${prefix} has an empty application/ld+json script`);
      continue;
    }
    try {
      collectTypes(JSON.parse(payload), types);
    } catch (error) {
      failures.push(
        `${prefix} has invalid JSON-LD (${error instanceof Error ? error.message : String(error)})`,
      );
    }
  }

  return types;
}

function collectTypes(value, types) {
  if (Array.isArray(value)) {
    for (const item of value) collectTypes(item, types);
    return;
  }
  if (!value || typeof value !== 'object') return;

  const type = value['@type'];
  if (typeof type === 'string') {
    types.add(type);
  } else if (Array.isArray(type)) {
    for (const entry of type) {
      if (typeof entry === 'string') types.add(entry);
    }
  }

  if (Array.isArray(value['@graph'])) collectTypes(value['@graph'], types);

  for (const [key, child] of Object.entries(value)) {
    if (key === '@context' || key === '@type' || key === '@graph') continue;
    if (child && typeof child === 'object') collectTypes(child, types);
  }
}

function canonicalHref(html) {
  for (const tag of tags(html, 'link')) {
    const rel = attribute(tag, 'rel');
    if (rel && rel.toLowerCase().split(/\s+/).includes('canonical')) {
      return attribute(tag, 'href');
    }
  }
  return null;
}

function metaContent(html, name) {
  for (const tag of tags(html, 'meta')) {
    if (attribute(tag, 'name')?.toLowerCase() === name.toLowerCase()) {
      return attribute(tag, 'content');
    }
  }
  return null;
}

function propertyContent(html, property) {
  for (const tag of tags(html, 'meta')) {
    if (attribute(tag, 'property')?.toLowerCase() === property.toLowerCase()) {
      return attribute(tag, 'content');
    }
  }
  return null;
}

function tags(html, tagName) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, 'gi'))].map((match) => match[0]);
}

function attribute(tag, name) {
  const pattern = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i',
  );
  const match = pattern.exec(tag);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? '';
}

function firstMatch(html, pattern) {
  const match = pattern.exec(html);
  return match?.[1] ?? null;
}

void main().catch((error) => {
  console.error(`check-seo: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
