/**
 * Ghost Content API client (plan.md §3, D4/R9).
 *
 * Pagination is mandatory (`limit: 'all'` is never used). The client is
 * fixture-testable through the SDK's `makeRequest` seam; live integration is
 * activated at Phase G.
 */
import GhostContentAPI from '@tryghost/content-api';
import type { MakeRequestOptions } from '@tryghost/content-api';
import { mapGhostPost, type GhostApiPostLike } from './mapper';
import { collectAllPages } from './pagination';
import type { GhostAuthor, GhostPost, GhostTag, MediaManifest } from './types';

const PAGE_LIMIT = 100;
const API_VERSION = 'v6.0';

export interface GhostClientConfig {
  url: string;
  key: string;
  version?: string;
  pageLimit?: number;
  maxPages?: number;
  delayMs?: number;
  /** Test seam: replaces the SDK's axios request. */
  makeRequest?: (options: MakeRequestOptions) => Promise<unknown>;
  sleep?: (ms: number) => Promise<void>;
  mediaManifest?: MediaManifest;
}

export interface GhostSite {
  title: string;
  description: string;
}

export interface GhostClient {
  fetchPosts(): Promise<GhostPost[]>;
  fetchTags(): Promise<GhostTag[]>;
  fetchAuthors(): Promise<GhostAuthor[]>;
  fetchSite(): Promise<GhostSite>;
}

export function createGhostClient(config: GhostClientConfig): GhostClient {
  const pageOptions = {
    limit: config.pageLimit ?? PAGE_LIMIT,
    maxPages: config.maxPages,
    delayMs: config.delayMs,
    sleep: config.sleep,
  };

  const api = GhostContentAPI({
    url: config.url,
    key: config.key,
    version: config.version ?? API_VERSION,
    ...(config.makeRequest ? { makeRequest: config.makeRequest } : {}),
  });

  return {
    async fetchPosts(): Promise<GhostPost[]> {
      const { items } = await collectAllPages(async (page) => {
        const posts = await api.posts.browse({
          limit: pageOptions.limit,
          page,
          include: ['authors', 'tags'],
        });
        const pagination = posts.meta.pagination;
        return { items: posts, next: pagination.next, total: pagination.total };
      }, pageOptions);

      return items.map((post) =>
        mapGhostPost(post as GhostApiPostLike, { mediaManifest: config.mediaManifest }),
      );
    },

    async fetchTags(): Promise<GhostTag[]> {
      const { items } = await collectAllPages(async (page) => {
        const tags = await api.tags.browse({ limit: pageOptions.limit, page });
        const pagination = tags.meta.pagination;
        return { items: tags, next: pagination.next, total: pagination.total };
      }, pageOptions);

      return items.map((tag) => ({
        slug: tag.slug,
        name: tag.name ?? tag.slug,
        visibility: tag.visibility === 'internal' ? 'internal' : 'public',
      }));
    },

    async fetchAuthors(): Promise<GhostAuthor[]> {
      const { items } = await collectAllPages(async (page) => {
        const authors = await api.authors.browse({ limit: pageOptions.limit, page });
        const pagination = authors.meta.pagination;
        return { items: authors, next: pagination.next, total: pagination.total };
      }, pageOptions);

      return items.map((author) => ({
        slug: author.slug,
        name: author.name ?? author.slug,
        url: null,
      }));
    },

    async fetchSite(): Promise<GhostSite> {
      const settings = await api.settings.browse();
      return {
        title: settings.title ?? 'Christopher Tapia',
        description: settings.description ?? '',
      };
    },
  };
}

/** Convenience used by the loader and snapshot writer. */
export async function fetchLivePosts(
  credentials: { url: string; key: string },
  options: Omit<GhostClientConfig, 'url' | 'key'> = {},
): Promise<GhostPost[]> {
  return createGhostClient({ ...options, ...credentials }).fetchPosts();
}
