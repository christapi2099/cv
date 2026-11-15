import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GhostPost } from '../../src/lib/ghost/types';

/**
 * Content facade state machine (plan.md §3, D4/D13; review pass 1, M2).
 *
 *   1. no GHOST_URL          → seed
 *   2. GHOST_URL reachable   → live
 *   3. live failure          → snapshot (with a warning)
 *   4. neither               → throw the cold-start instructions
 *   5. GHOST_URL without key → the config error is surfaced, never swallowed
 *
 * `finalize()` invariants (global slug uniqueness, D11 series coverage) are
 * asserted through the same facade because every source funnels through it.
 */

interface FeedState {
  seedPosts: GhostPost[];
  livePosts: GhostPost[] | null;
  liveError: Error | null;
  snapshot: { fetchedAt: string; posts: GhostPost[] } | null;
}

const state = vi.hoisted<FeedState>(() => ({
  seedPosts: [],
  livePosts: null,
  liveError: null,
  snapshot: null,
}));

vi.mock('../../src/lib/seed', () => ({
  loadSeedFeed: async () => ({
    source: 'seed',
    fetchedAt: '2026-01-01T00:00:00.000Z',
    posts: state.seedPosts,
  }),
}));

vi.mock('../../src/lib/ghost/client', () => ({
  createGhostClient: () => ({
    fetchPosts: async () => {
      if (state.liveError) throw state.liveError;
      return state.livePosts ?? [];
    },
  }),
}));

vi.mock('../../src/lib/ghost/snapshot-store', () => ({
  readSnapshot: async () => state.snapshot,
}));

const SNAPSHOT_FETCHED_AT = '2026-02-01T00:00:00.000Z';

/** A complete DTO; every required series is represented unless overridden. */
function post(slug: string, seriesSlugs: string[], publishedAt: string): GhostPost {
  return {
    id: slug,
    slug,
    title: slug,
    html: '<p>Body</p>',
    excerpt: 'Summary',
    featureImage: null,
    featureImageAlt: null,
    featureImageCaption: null,
    publishedAt,
    updatedAt: publishedAt,
    seriesSlugs,
    tagSlugs: seriesSlugs.map((series) => `series-${series}`),
    author: { name: 'Christopher Tapia', url: null },
    readingMinutes: 1,
  };
}

const HORROR = 'developer-horror-stories';
const BREAKDOWNS = 'project-breakdowns';

function horrorPost(publishedAt = '2026-01-02T00:00:00.000Z'): GhostPost {
  return post('migration', [HORROR], publishedAt);
}

function breakdownPost(publishedAt = '2026-01-03T00:00:00.000Z'): GhostPost {
  return post('scheduler', [BREAKDOWNS], publishedAt);
}

async function loadFeed() {
  vi.resetModules();
  return import('../../src/lib/ghost/index');
}

beforeEach(() => {
  state.seedPosts = [horrorPost(), breakdownPost()];
  state.livePosts = null;
  state.liveError = null;
  state.snapshot = null;
  vi.stubEnv('GHOST_URL', '');
  vi.stubEnv('GHOST_CONTENT_API_KEY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('fetchFeed — seed mode', () => {
  it('serves the seed feed when GHOST_URL is unset', async () => {
    const { fetchFeed } = await loadFeed();
    const feed = await fetchFeed();

    expect(feed.source).toBe('seed');
    expect(feed.posts.map((entry) => entry.slug)).toEqual(['scheduler', 'migration']);
  });

  it('rejects duplicate slugs with a readable error', async () => {
    state.seedPosts = [horrorPost(), breakdownPost(), horrorPost('2026-01-04T00:00:00.000Z')];
    const { fetchFeed } = await loadFeed();

    await expect(fetchFeed()).rejects.toThrow(/Duplicate post slug "migration"/);
  });

  it('rejects a feed where a required series has no posts (D11)', async () => {
    state.seedPosts = [horrorPost()];
    const { fetchFeed } = await loadFeed();

    await expect(fetchFeed()).rejects.toThrow(/Required series "series-project-breakdowns"/);
  });
});

describe('fetchFeed — live mode', () => {
  it('serves the live feed when Ghost answers', async () => {
    vi.stubEnv('GHOST_URL', 'https://ghost.example');
    vi.stubEnv('GHOST_CONTENT_API_KEY', 'test-key');
    state.livePosts = [horrorPost(), breakdownPost()];

    const { fetchFeed } = await loadFeed();
    const feed = await fetchFeed();

    expect(feed.source).toBe('live');
    expect(feed.posts).toHaveLength(2);
    // Fetched now, not from the seed or snapshot clock.
    expect(feed.fetchedAt).not.toBe('2026-01-01T00:00:00.000Z');
    expect(Number.isNaN(Date.parse(feed.fetchedAt))).toBe(false);
  });

  it('falls back to the committed snapshot when the live fetch fails', async () => {
    vi.stubEnv('GHOST_URL', 'https://ghost.example');
    vi.stubEnv('GHOST_CONTENT_API_KEY', 'test-key');
    state.liveError = new Error('getaddrinfo ENOTFOUND ghost.example');
    state.snapshot = {
      fetchedAt: SNAPSHOT_FETCHED_AT,
      posts: [horrorPost('2025-12-01T00:00:00.000Z'), breakdownPost()],
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { fetchFeed } = await loadFeed();
    const feed = await fetchFeed();

    expect(feed.source).toBe('snapshot');
    expect(feed.fetchedAt).toBe(SNAPSHOT_FETCHED_AT);
    expect(feed.posts).toHaveLength(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('using snapshot from'));
    expect(warn.mock.calls.flat().join(' ')).toContain('ENOTFOUND');
  });

  it('fails with cold-start instructions when live is down and no snapshot exists', async () => {
    vi.stubEnv('GHOST_URL', 'https://ghost.example');
    vi.stubEnv('GHOST_CONTENT_API_KEY', 'test-key');
    state.liveError = new Error('socket hang up');

    const { fetchFeed } = await loadFeed();

    const error = await fetchFeed().then(
      () => {
        throw new Error('fetchFeed resolved but should have rejected');
      },
      (reason: unknown) => reason as Error,
    );
    expect(error.message).toMatch(/Ghost is unreachable and no snapshot is available/);
    expect(error.message).toMatch(/socket hang up/);
    expect(error.message).toMatch(/Unset both Ghost variables to build from local seed content/);
  });
});

describe('fetchFeed — incomplete Ghost configuration', () => {
  it('surfaces the missing-key config error instead of a generic network failure', async () => {
    vi.stubEnv('GHOST_URL', 'https://ghost.example');

    const { fetchFeed } = await loadFeed();

    await expect(fetchFeed()).rejects.toThrow(/GHOST_CONTENT_API_KEY is missing/);
  });

  it('still uses the snapshot when the key is missing, and says why', async () => {
    vi.stubEnv('GHOST_URL', 'https://ghost.example');
    state.snapshot = { fetchedAt: SNAPSHOT_FETCHED_AT, posts: [horrorPost(), breakdownPost()] };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { fetchFeed } = await loadFeed();
    const feed = await fetchFeed();

    expect(feed.source).toBe('snapshot');
    expect(warn.mock.calls.flat().join(' ')).toContain('GHOST_CONTENT_API_KEY is missing');
  });
});
