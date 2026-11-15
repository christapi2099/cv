import type { APIRoute } from 'astro';
import { BUILD_ID, BUILD_SHA, BUILD_TIME } from '../lib/build-id';

/**
 * Machine-readable build-id heartbeat (plan §4 Phase 5.1, gate G5).
 *
 * Static route emitted at build time. `scripts/check-heartbeat.mjs` fetches
 * this file and compares `sha` against the latest commit on the deploy
 * branch. `cache-control: no-store` keeps a CDN edge from serving a stale
 * identifier after a rollback.
 */
export const GET: APIRoute = () =>
  new Response(
    `${JSON.stringify({ buildId: BUILD_ID, sha: BUILD_SHA, builtAt: BUILD_TIME }, null, 2)}\n`,
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  );
