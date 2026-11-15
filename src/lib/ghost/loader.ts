/**
 * Content Layer Ghost loader (plan.md Phase 2.2).
 *
 * Registered only when GHOST_URL + GHOST_CONTENT_API_KEY are both set
 * (content.config.ts), so the collection is dormant in seed mode. Pages do not
 * consume this collection in v1; the facade reads seed Markdown directly. The
 * loader is the cutover path and shares the exact mapper with the facade.
 */
import type { Loader } from 'astro/loaders';
import { fetchLivePosts } from './client';
import { readGhostCredentials } from './env';

export function ghostLoader(): Loader {
  return {
    name: 'ghost-content-api',
    load: async ({ store, logger, parseData, generateDigest }) => {
      const credentials = readGhostCredentials();
      const posts = await fetchLivePosts(credentials);

      for (const post of posts) {
        const data = await parseData({ id: post.slug, data: { ...post } });
        store.set({ id: post.slug, data, digest: generateDigest({ ...post }) });
      }

      logger.info(`Loaded ${posts.length} Ghost posts into the content collection.`);
    },
  };
}
