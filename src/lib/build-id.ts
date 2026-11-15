/**
 * Deployed build identifier (plan §4 Phase 5.1, gate G5).
 *
 * The values are injected by Vite `define` in `astro.config.mjs` at build
 * start: the commit SHA (Vercel's env when available, else `git rev-parse`)
 * and the build timestamp. The identifier is rendered as
 * `<meta name="build-id">` in BaseLayout and served as `/build-id.json`, so
 * `scripts/check-heartbeat.mjs` can prove a deploy is fresher than the branch
 * head.
 *
 * `typeof` guards keep this module importable outside a Vite build (unit
 * tests, plain Node): an un-replaced identifier reads as `unknown`/`dev`
 * instead of throwing a ReferenceError.
 */
declare const __BUILD_ID__: string | undefined;
declare const __BUILD_SHA__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

function injected(value: string | undefined, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

/** Short commit SHA, or `unknown` when git/Vercel metadata was unavailable. */
export const BUILD_SHA = injected(
  typeof __BUILD_SHA__ === 'undefined' ? undefined : __BUILD_SHA__,
  'unknown',
);

/** ISO-8601 build timestamp. */
export const BUILD_TIME = injected(
  typeof __BUILD_TIME__ === 'undefined' ? undefined : __BUILD_TIME__,
  'unknown',
);

/** `<sha>.<compact timestamp>`, e.g. `abc1234def56.20261114T205500Z`. */
export const BUILD_ID = injected(
  typeof __BUILD_ID__ === 'undefined' ? undefined : __BUILD_ID__,
  `dev.${BUILD_TIME === 'unknown' ? 'unknown' : BUILD_TIME}`,
);
