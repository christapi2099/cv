import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';

// SITE_URL is the canonical origin (plan §3 env table). Lane 0B sets it in
// Vercel; local dev and CI fall back to the dev/preview origin.
const site = process.env.SITE_URL ?? 'http://localhost:4321';

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
