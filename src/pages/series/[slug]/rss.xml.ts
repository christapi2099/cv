import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { fetchFeed } from '../../../lib/ghost';
import { canonicalUrl, SITE_NAME } from '../../../lib/seo';
import { listSeries } from '../../../lib/series';

export async function getStaticPaths() {
  const feed = await fetchFeed();
  return listSeries(feed.posts).map(({ definition }) => ({
    params: { slug: definition.slug },
  }));
}

/**
 * Series feed (plan.md §4 Phase 4.5). Summaries only; site-origin links.
 */
export const GET: APIRoute = async (context) => {
  const slug = context.params.slug;
  if (!slug) return new Response('Not found', { status: 404 });

  const feed = await fetchFeed();
  const listing = listSeries(feed.posts).find(({ definition }) => definition.slug === slug);
  if (!listing) return new Response('Not found', { status: 404 });

  return rss({
    title: `${listing.definition.title} — ${SITE_NAME}`,
    description: listing.definition.blurb,
    /*
     * The channel <link> is this series' page, not the site root (review pass
     * 1): `@astrojs/rss` resolves the channel link from `site`. Item links are
     * absolute paths, so they still resolve to `/blog/<slug>` on the origin.
     */
    site: canonicalUrl(`/series/${listing.definition.slug}`),
    trailingSlash: false,
    customData: '<language>en</language>',
    items: listing.posts.map((post) => ({
      title: post.title,
      description: post.excerpt,
      pubDate: new Date(post.publishedAt),
      link: `/blog/${post.slug}`,
      categories: post.tagSlugs,
    })),
  });
};
