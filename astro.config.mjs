import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';

// SITE_URL is the canonical origin (plan §3 env table). Lane 0B sets it in
// Vercel; local dev and CI fall back to the dev/preview origin.
const site = process.env.SITE_URL ?? 'http://localhost:4321';

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
