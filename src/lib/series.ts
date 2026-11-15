/**
 * Series registry (plan.md D11).
 *
 * A series is identified by an internal Ghost tag slug (`series-<url-slug>`).
 * URLs come from this registry, never from tag data. Required series must have
 * at least one post at build time; an unknown `series-*` tag is a warning and
 * leaves the post standalone.
 */
import type { GhostPost } from './ghost/types';

export interface SeriesDefinition {
  /** Ghost tag slug (the registry key). */
  tagSlug: string;
  /** URL slug under `/series/`. */
  slug: string;
  title: string;
  blurb: string;
  required: boolean;
}

export const SERIES: readonly SeriesDefinition[] = [
  {
    tagSlug: 'series-developer-horror-stories',
    slug: 'developer-horror-stories',
    title: 'Developer Horror Stories',
    blurb:
      'War stories from production: the incidents, migrations, and bugs that taught me something the hard way.',
    /*
     * Owner decisions 2026-11-15: both posts in this series' history are
     * withdrawn to `draft: true` — the migration story is unfinished, and the
     * owner is rewriting the scheduler material as a Developer Horror Stories
     * article. Temporarily `required: false`; flip back to `required: true`
     * when a rewritten story ships.
     */
    required: false,
  },
  {
    tagSlug: 'series-project-breakdowns',
    slug: 'project-breakdowns',
    title: 'Project Breakdowns',
    blurb:
      'How the systems actually work — architecture decisions, cost trade-offs, and the parts that are not in the demo.',
    /*
     * Owner decision 2026-11-15 (second amendment): the only post in this
     * series is withdrawn to `draft: true` so the owner can rewrite the
     * material as a Developer Horror Stories article. Temporarily
     * `required: false`; flip back to `required: true` when the rewritten
     * story ships.
     */
    required: false,
  },
] as const;

const BY_SLUG = new Map(SERIES.map((series) => [series.slug, series]));
const BY_TAG_SLUG = new Map(SERIES.map((series) => [series.tagSlug, series]));

export function seriesTagSlug(seriesSlug: string): string {
  return `series-${seriesSlug}`;
}

export function getSeriesBySlug(seriesSlug: string): SeriesDefinition | undefined {
  return BY_SLUG.get(seriesSlug);
}

export function getSeriesByTagSlug(tagSlug: string): SeriesDefinition | undefined {
  return BY_TAG_SLUG.get(tagSlug);
}

/**
 * Normalise the tag forms Ghost may emit for the internal series tag:
 * `series-x`, `#series-x`, `#series: x`, and the legacy `hash-series-x`.
 * Returns null for ordinary topical tags.
 */
export function seriesSlugFromTagSlug(tagSlug: string): string | null {
  const normalized = tagSlug
    .trim()
    .toLowerCase()
    .replace(/^#\s*/, '')
    .replace(/^hash-series-/, 'series-');

  if (!/^series(?:[:\-_]|\s)/.test(normalized)) return null;

  const rest = normalized
    .replace(/^series\s*[:\-_]\s*/, '')
    .replace(/^series\s+-?\s*/, '')
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return rest || null;
}

export function extractSeriesSlugs(tagSlugs: readonly string[]): string[] {
  const slugs = new Set<string>();
  for (const tagSlug of tagSlugs) {
    const slug = seriesSlugFromTagSlug(tagSlug);
    if (slug) slugs.add(slug);
  }
  return [...slugs];
}

export function postsInSeries(
  posts: readonly GhostPost[],
  definition: SeriesDefinition,
): GhostPost[] {
  return posts
    .filter((post) => post.seriesSlugs.includes(definition.slug))
    .sort(byPublishedDescending);
}

export interface SeriesListing {
  definition: SeriesDefinition;
  posts: GhostPost[];
}

/** Series with at least one post. Required-empty is handled by validation. */
export function listSeries(posts: readonly GhostPost[]): SeriesListing[] {
  return SERIES.map((definition) => ({
    definition,
    posts: postsInSeries(posts, definition),
  })).filter((listing) => listing.posts.length > 0);
}

/**
 * D11 drift policy, called from the facade on every feed:
 * - unknown `series-*` → WARN and the post stays standalone;
 * - required series with zero posts → build failure;
 * - non-required empty series → WARN and no page.
 */
export function validateSeriesCoverage(
  posts: readonly GhostPost[],
  registry: readonly SeriesDefinition[] = SERIES,
): void {
  const known = new Set(registry.map((series) => series.slug));
  const warnedUnknown = new Set<string>();

  for (const post of posts) {
    for (const seriesSlug of post.seriesSlugs) {
      if (known.has(seriesSlug) || warnedUnknown.has(seriesSlug)) continue;
      warnedUnknown.add(seriesSlug);
      console.warn(
        `[series] Unknown series "${seriesSlug}" on /blog/${post.slug}. ` +
          'Treating the post as standalone; add the series to src/lib/series.ts.',
      );
    }
  }

  for (const definition of registry) {
    const count = posts.filter((post) => post.seriesSlugs.includes(definition.slug)).length;
    if (count > 0) continue;

    if (definition.required) {
      throw new Error(
        `Required series "${definition.tagSlug}" has no published posts (D11). ` +
          `Add a seed post under src/content/seed/${definition.slug}/ or mark the series optional.`,
      );
    }

    console.warn(
      `[series] Optional series "${definition.tagSlug}" is empty; no page will be generated.`,
    );
  }
}

export const SITE_FEED_PATH = '/rss.xml';

export function seriesFeedPath(seriesSlug: string): string {
  return `/series/${seriesSlug}/rss.xml`;
}

export interface FeedLinkTag {
  rel: 'alternate';
  type: 'application/rss+xml';
  title: string;
  href: string;
}

/**
 * The two `<link rel="alternate">` tags BaseLayout needs in `<head>`.
 * BaseLayout is owned by another lane, so pages cannot inject them here.
 */
export function feedLinkTags(seriesSlug?: string): FeedLinkTag[] {
  const links: FeedLinkTag[] = [
    {
      rel: 'alternate',
      type: 'application/rss+xml',
      title: 'Christopher Tapia — All posts',
      href: SITE_FEED_PATH,
    },
  ];

  if (seriesSlug) {
    const definition = BY_SLUG.get(seriesSlug);
    links.push({
      rel: 'alternate',
      type: 'application/rss+xml',
      title: `${definition?.title ?? seriesSlug} — Christopher Tapia`,
      href: seriesFeedPath(seriesSlug),
    });
  }

  return links;
}

function byPublishedDescending(a: GhostPost, b: GhostPost): number {
  return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
}
