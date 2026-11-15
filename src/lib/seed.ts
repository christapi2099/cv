/**
 * Seed-mode content (plan.md D13, §5).
 *
 * The glob loader renders Markdown to HTML; this module maps that HTML and
 * frontmatter through the same DTO builder as the Ghost mapper. Frontmatter
 * `slug` is explicit because Content Layer has no reserved slug field.
 */
import { buildGhostPost } from './ghost/mapper';
import type { FeedResult, GhostPost } from './ghost/types';
import { assertUniqueSlugs } from './ghost/validation';
import { seriesTagSlug } from './series';

export interface SeedClaimSource {
  claim: string;
  source: string;
  /** Provenance kind; `owner-confirmation` has no external artifact. */
  source_type?: 'url' | 'document' | 'owner-confirmation';
  checked: string;
}

export interface SeedFrontmatter {
  title: string;
  summary: string;
  date: Date;
  featureImage: string | null;
  featureImageAlt: string | null;
  featureImageCaption: string | null;
  draft: boolean;
  slug: string;
  tags: string[];
  claim_source: SeedClaimSource[];
}

export interface SeedEntryLike {
  /** `<series-slug>/<post-slug>` from the loader's generateId. */
  id: string;
  filePath?: string;
  rendered?: { html: string };
  data: SeedFrontmatter;
}

export function seedEntryToGhostPost(entry: SeedEntryLike): GhostPost {
  const [seriesSlug] = entry.id.split('/');
  if (!seriesSlug) {
    throw new Error(
      `Seed post "${entry.id}" must live under src/content/seed/<series-slug>/ (D11/D13).`,
    );
  }

  const renderedHtml = entry.rendered?.html;
  if (typeof renderedHtml !== 'string') {
    throw new Error(
      `Seed post "${entry.id}" has no rendered HTML. Check the glob loader configuration.`,
    );
  }

  const { data } = entry;
  const publishedAt = data.date.toISOString();

  return buildGhostPost({
    id: entry.id,
    slug: data.slug,
    title: data.title,
    rawHtml: renderedHtml,
    excerpt: data.summary,
    plaintext: null,
    featureImage: data.featureImage,
    featureImageAlt: data.featureImageAlt,
    featureImageCaption: data.featureImageCaption,
    publishedAt,
    updatedAt: publishedAt,
    authorName: 'Christopher Tapia',
    authorUrl: null,
    seriesSlugs: [seriesSlug],
    tagSlugs: [seriesTagSlug(seriesSlug), ...data.tags],
    readingTime: null,
  });
}

export async function loadSeedFeed(): Promise<FeedResult> {
  const { getCollection } = await import('astro:content');
  const entries = await getCollection('seed');
  const showDrafts = import.meta.env.DEV;

  const posts = entries
    .filter((entry) => showDrafts || !entry.data.draft)
    .map((entry) => seedEntryToGhostPost(entry));

  assertUniqueSlugs(posts);

  return {
    source: 'seed',
    fetchedAt: new Date().toISOString(),
    posts,
  };
}
