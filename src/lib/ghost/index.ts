/**
 * The typed content facade (plan.md §3, D4, D13).
 *
 *   no GHOST_URL        → seed   (local Markdown via the Content Layer)
 *   GHOST_URL reachable → live   (paginated Content API)
 *   live failure        → snapshot (last committed snapshot)
 *   neither             → throw  (cold start: the build fails with instructions)
 *
 * Pages import ONLY this module; no page talks to Ghost or the seed loader.
 */
import { loadSeedFeed } from '../seed';
import { validateSeriesCoverage } from '../series';
import { createGhostClient } from './client';
import { hasGhostUrl, readGhostCredentials } from './env';
import { readSnapshot } from './snapshot-store';
import type { FeedResult } from './types';
import { assertUniqueSlugs } from './validation';

export type { FeedResult, FeedSource, GhostPost, GhostSnapshot } from './types';

let pendingFeed: Promise<FeedResult> | undefined;

export function fetchFeed(): Promise<FeedResult> {
  // Dev reloads must see edited seed posts immediately; a build gets one fetch.
  if (import.meta.env.DEV) return loadFeed();
  pendingFeed ??= loadFeed();
  return pendingFeed;
}

async function loadFeed(): Promise<FeedResult> {
  if (!hasGhostUrl()) {
    return finalize(await loadSeedFeed());
  }

  let live: FeedResult;
  try {
    live = await loadLiveFeed();
  } catch (error) {
    const snapshot = await readSnapshot();
    if (!snapshot) throw new Error(coldStartMessage(error));

    console.warn(
      `[ghost] Live fetch failed (${describeError(error)}); using snapshot from ${snapshot.fetchedAt}.`,
    );
    return finalize({
      source: 'snapshot',
      fetchedAt: snapshot.fetchedAt,
      posts: snapshot.posts,
    });
  }

  return finalize(live);
}

async function loadLiveFeed(): Promise<FeedResult> {
  const credentials = readGhostCredentials();
  const posts = await createGhostClient(credentials).fetchPosts();
  return {
    source: 'live',
    fetchedAt: new Date().toISOString(),
    posts,
  };
}

function finalize(feed: FeedResult): FeedResult {
  assertUniqueSlugs(feed.posts);
  validateSeriesCoverage(feed.posts);
  return {
    ...feed,
    posts: [...feed.posts].sort(
      (left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt),
    ),
  };
}

function coldStartMessage(error: unknown): string {
  return [
    'Ghost is unreachable and no snapshot is available, so the build cannot render content.',
    `Cause: ${describeError(error)}`,
    'Choose one:',
    '  1. Fix GHOST_URL / GHOST_CONTENT_API_KEY and rebuild (Phase G cutover).',
    '  2. Unset both Ghost variables to build from local seed content (D13 seed mode).',
    '  3. Run `pnpm tsx scripts/snapshot-ghost.ts` against a reachable Ghost, commit the snapshot, and rebuild.',
  ].join('\n');
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
