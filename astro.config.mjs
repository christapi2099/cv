import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';

// SITE_URL is the canonical origin (plan §3 env table). Lane 0B sets it in
// Vercel; local dev falls back to the dev/preview origin.
const DEFAULT_SITE_ORIGIN = 'http://localhost:4321';

function isLocalOrigin(value) {
  let hostname;
  try {
    hostname = new URL(value).hostname;
  } catch {
    return false;
  }
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost')
  );
}

const configuredSite = process.env.SITE_URL?.trim();
const site = configuredSite || DEFAULT_SITE_ORIGIN;

/*
 * Deploy-origin guard (review pass 1). The localhost fallback exists for `dev`
 * only: a CI/Vercel build that silently fell back would ship localhost
 * canonicals, OG URLs, sitemap entries and an unreachable og:image. Fail the
 * build instead — a wrong canonical is worse than a red deploy.
 */
const isDeployedBuild = Boolean(process.env.CI || process.env.VERCEL || process.env.VERCEL_ENV);
if (isDeployedBuild && isLocalOrigin(site)) {
  throw new Error(
    `SITE_URL must be the deployed canonical origin, but the build resolved to "${site}". ` +
      'Set SITE_URL in the CI/Vercel project environment (e.g. https://your-domain.example); ' +
      'the http://localhost:4321 fallback is for local `astro dev` only.',
  );
}

/*
 * Build-id heartbeat (plan §4 Phase 5.1, gate G5). The deployed HTML and
 * `/build-id.json` expose the commit SHA + build timestamp so a monitor can
 * prove a deploy is fresher than the branch head. Prefer Vercel's own commit
 * env when present; otherwise ask git. Never throws — a missing git binary or
 * a source tarball falls back to `unknown` and the heartbeat check will say so.
 */
function resolveBuildSha() {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (fromVercel) return fromVercel.slice(0, 12).toLowerCase();
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim()
      .toLowerCase();
  } catch {
    return 'unknown';
  }
}

const BUILD_SHA = resolveBuildSha();
const BUILD_TIME = new Date().toISOString();
const BUILD_ID = `${BUILD_SHA}.${BUILD_TIME.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`;

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'directory',
  },
  integrations: [svelte(), mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    define: {
      __BUILD_ID__: JSON.stringify(BUILD_ID),
      __BUILD_SHA__: JSON.stringify(BUILD_SHA),
      __BUILD_TIME__: JSON.stringify(BUILD_TIME),
    },
    resolve: {
      // D6 / §3: the vendored wormhole imports the bare specifier 'three'
      // (r170, pinned exact in package.json). Resolve it from local deps —
      // never an import map or CDN.
      alias: {
        three: fileURLToPath(new URL('./node_modules/three/build/three.module.js', import.meta.url)),
      },
    },
  },
});
