import type { MakeRequestOptions } from '@tryghost/content-api';
import { describe, expect, it, vi } from 'vitest';
import { createGhostClient } from '../../src/lib/ghost/client';
import { collectAllPages } from '../../src/lib/ghost/pagination';

function ghostPost(index: number) {
  return {
    id: `post-${index}`,
    slug: `post-${index}`,
    title: `Post ${index}`,
    html: `<p>Body ${index}</p>`,
    excerpt: null,
    custom_excerpt: null,
    plaintext: `Body ${index}`,
    feature_image: null,
    feature_image_alt: null,
    feature_image_caption: null,
    published_at: '2026-01-02T03:04:05.000Z',
    updated_at: '2026-01-02T03:04:05.000Z',
    reading_time: 1,
    tags: [{ slug: 'series-project-breakdowns', name: '#series: Project Breakdowns' }],
    authors: [{ slug: 'christopher-tapia', name: 'Christopher Tapia' }],
  };
}

function fixturePage(page: number) {
  const start = (page - 1) * 100;
  const posts = Array.from({ length: Math.max(0, Math.min(100, 101 - start)) }, (_, offset) =>
    ghostPost(start + offset),
  );
  return {
    data: {
      posts,
      meta: {
        pagination: {
          page,
          limit: 100,
          pages: 2,
          total: 101,
          next: page === 1 ? 2 : null,
          prev: page === 1 ? null : 1,
        },
      },
    },
  };
}

describe('Ghost pagination (101-post fixture)', () => {
  it('follows meta.pagination.next, delays between pages, and asserts the total', async () => {
    const sleep = vi.fn(async () => undefined);
    const calls: number[] = [];

    const result = await collectAllPages(
      async (page) => {
        calls.push(page);
        const fixture = fixturePage(page).data;
        return {
          items: fixture.posts,
          next: fixture.meta.pagination.next,
          total: fixture.meta.pagination.total,
        };
      },
      { sleep, delayMs: 250 },
    );

    expect(calls).toEqual([1, 2]);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(250);
    expect(result.items).toHaveLength(101);
    expect(result.total).toBe(101);
    expect(result.pages).toBe(2);
  });

  it('rejects a next value that skips a page', async () => {
    await expect(
      collectAllPages(
        async () => ({ items: [1], next: 3, total: 2 }),
        { sleep: async () => undefined, delayMs: 0 },
      ),
    ).rejects.toThrow(/expected 2/);
  });

  it('rejects a count that disagrees with the API total', async () => {
    await expect(
      collectAllPages(
        async () => ({ items: [1, 2], next: null, total: 3 }),
        { sleep: async () => undefined, delayMs: 0 },
      ),
    ).rejects.toThrow(/integrity failure/);
  });

  it('stops at the page bound', async () => {
    await expect(
      collectAllPages(
        async (page) => ({ items: [page], next: page + 1, total: 99 }),
        { sleep: async () => undefined, delayMs: 0, maxPages: 2 },
      ),
    ).rejects.toThrow(/safety bound/);
  });
});

describe('Ghost client', () => {
  it('pages the live client with limit=100 and maps all 101 posts', async () => {
    const pages: number[] = [];
    const limits: number[] = [];

    const makeRequest = async (options: MakeRequestOptions): Promise<unknown> => {
      const page = Number(options.params.page ?? 1);
      const limit = Number(options.params.limit);
      pages.push(page);
      limits.push(limit);
      return fixturePage(page);
    };

    const client = createGhostClient({
      url: 'https://ghost.example',
      key: '0123456789abcdef0123456789',
      makeRequest,
      sleep: async () => undefined,
    });

    const posts = await client.fetchPosts();

    expect(pages).toEqual([1, 2]);
    expect(limits).toEqual([100, 100]);
    expect(posts).toHaveLength(101);
    expect(posts.every((post) => post.seriesSlugs.includes('project-breakdowns'))).toBe(true);
    expect(posts[0]?.html).not.toContain('<script');
  });
});
