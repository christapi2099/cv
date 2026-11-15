import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { fetchFeed } from '../lib/ghost';
import { SITE_DESCRIPTION, SITE_NAME, canonicalUrl } from '../lib/seo';

/**
 * Site-wide feed (plan.md §4 Phase 4.5): summaries only — never full bodies.
 * Links and guids resolve against the site origin, never a Ghost URL.
 */
export const GET: APIRoute = async (context) => {
  const feed = await fetchFeed();

  return rss({
    title: `${SITE_NAME} — Writing`,
    description: SITE_DESCRIPTION,
    site: context.site ?? canonicalUrl('/'),
    trailingSlash: false,
    customData: '<language>en</language>',
    items: feed.posts.map((post) => ({
      title: post.title,
      description: post.excerpt,
      pubDate: new Date(post.publishedAt),
      link: `/blog/${post.slug}`,
      categories: post.tagSlugs,
    })),
  });
};
