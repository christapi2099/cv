/**
 * SEO contract (plan §4 Phase 1.2): one canonical-URL helper, title/description
 * metadata, Open Graph / Twitter cards, and typed JSON-LD builders.
 *
 * Serialization is centralised in `serializeJsonLd()`: callers must render the
 * result inside a `<script type="application/ld+json">` with `set:html` rather
 * than interpolating JSON into a script string by hand.
 */
import type {
  Article,
  BlogPosting,
  BreadcrumbList,
  CollectionPage,
  ListItem,
  Person,
  WebSite,
  WithContext,
} from 'schema-dts';

const DEFAULT_SITE_ORIGIN = 'http://localhost:4321';

export const SITE_NAME = 'Christopher Tapia';
export const SITE_DESCRIPTION =
  'Christopher Tapia is a full-stack engineer, co-founder & CTO of RollTrackApp, and a freelance developer building Stripe Connect, LiveKit, and performance-critical web software.';
export const SITE_LANGUAGE = 'en';

/**
 * Default social card (1200 × 630, `public/brand/og-default.jpg`), cropped from
 * the owner-supplied headshot. Every page that does not pass an explicit
 * `ogImage` gets this, so no route relies on a scraper-invented image; a page
 * with its own image (a post's feature image, a case-study override) wins.
 */
export const DEFAULT_OG_IMAGE_PATH = '/brand/og-default.jpg';
export const DEFAULT_OG_IMAGE_WIDTH = 1200;
export const DEFAULT_OG_IMAGE_HEIGHT = 630;
export const DEFAULT_OG_IMAGE_ALT =
  'Christopher Tapia in a pinstripe suit and glasses, standing outdoors.';

/**
 * Personal profiles only. Company LinkedIn pages belong in `worksFor` /
 * `affiliation`, never in `sameAs` (DESIGN.md / plan Phase 1.2).
 */
export const PERSONAL_PROFILES: readonly string[] = [
  'https://www.linkedin.com/in/christopher-tapia-439897198/',
  'https://github.com/christapi2099',
];

/** Canonical origin from the single env source (`SITE_URL`). */
function siteOrigin(): string {
  const configured =
    typeof process !== 'undefined' ? process.env.SITE_URL?.trim() : undefined;
  return configured ? configured.replace(/\/+$/, '') : DEFAULT_SITE_ORIGIN;
}

/*
 * The localhost fallback above is a dev-only convenience. `astro.config.mjs`
 * throws before any page renders when CI/Vercel resolves a local origin, so a
 * deploy can never ship localhost canonicals; `scripts/check-seo.mjs` then
 * asserts every emitted canonical uses the configured origin.
 */

/**
 * The single URL helper (plan §3): site origin + a path, no trailing slash
 * (matches `trailingSlash: 'never'`). Absolute URLs pass through unchanged.
 */
export function canonicalUrl(pathname = '/'): string {
  const raw = pathname.trim() || '/';
  const url = /^https?:\/\//i.test(raw)
    ? new URL(raw)
    : new URL(raw.startsWith('/') ? raw : `/${raw}`, siteOrigin());
  const pathnamePart = url.pathname.replace(/\/+$/, '') || '/';
  return `${url.origin}${pathnamePart}${url.search}`;
}

export function personId(): string {
  return `${canonicalUrl('/')}#person`;
}

export function webSiteId(): string {
  return `${canonicalUrl('/')}#website`;
}

/* ------------------------------------------------------------------ */
/* Metadata                                                           */
/* ------------------------------------------------------------------ */

export interface MetaTag {
  name?: string;
  property?: string;
  content: string;
}

export interface LinkTag {
  rel: string;
  href: string;
}

export type OpenGraphType = 'website' | 'article';

export interface OpenGraphInput {
  title: string;
  description: string;
  path?: string;
  url?: string;
  type?: OpenGraphType;
  image?: string;
  imageAlt?: string;
  siteName?: string;
  locale?: string;
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tags?: readonly string[];
}

export interface TwitterInput {
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
}

function absoluteAsset(asset: string): string {
  return /^https?:\/\//i.test(asset) ? asset : canonicalUrl(asset);
}

export function buildTitle(pageTitle?: string): string {
  const title = pageTitle?.trim();
  if (!title || title === SITE_NAME) return `${SITE_NAME} — Full-stack engineer`;
  return `${title} — ${SITE_NAME}`;
}

export function buildOpenGraph(input: OpenGraphInput): MetaTag[] {
  const url = input.url ?? canonicalUrl(input.path ?? '/');
  const type = input.type ?? 'website';
  const image = input.image ?? DEFAULT_OG_IMAGE_PATH;
  const tags: MetaTag[] = [
    { property: 'og:site_name', content: input.siteName ?? SITE_NAME },
    { property: 'og:type', content: type },
    { property: 'og:title', content: input.title },
    { property: 'og:description', content: input.description },
    { property: 'og:url', content: url },
    { property: 'og:locale', content: input.locale ?? 'en_US' },
    { property: 'og:image', content: absoluteAsset(image) },
    {
      property: 'og:image:alt',
      content: input.imageAlt ?? (input.image ? input.title : DEFAULT_OG_IMAGE_ALT),
    },
  ];
  // Only the shipped card's dimensions are known; a per-page image declares
  // nothing rather than something wrong.
  if (!input.image) {
    tags.push(
      { property: 'og:image:width', content: String(DEFAULT_OG_IMAGE_WIDTH) },
      { property: 'og:image:height', content: String(DEFAULT_OG_IMAGE_HEIGHT) },
    );
  }
  if (type === 'article') {
    if (input.publishedTime) {
      tags.push({ property: 'article:published_time', content: input.publishedTime });
    }
    if (input.modifiedTime) {
      tags.push({ property: 'article:modified_time', content: input.modifiedTime });
    }
    if (input.author) tags.push({ property: 'article:author', content: input.author });
    if (input.section) tags.push({ property: 'article:section', content: input.section });
    for (const tag of input.tags ?? []) {
      tags.push({ property: 'article:tag', content: tag });
    }
  }

  return tags;
}

export function buildTwitter(input: TwitterInput): MetaTag[] {
  const image = input.image ?? DEFAULT_OG_IMAGE_PATH;
  const tags: MetaTag[] = [
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: input.title },
    { name: 'twitter:description', content: input.description },
    { name: 'twitter:image', content: absoluteAsset(image) },
    {
      name: 'twitter:image:alt',
      content: input.imageAlt ?? (input.image ? input.title : DEFAULT_OG_IMAGE_ALT),
    },
  ];
  return tags;
}

export interface PageSeoInput extends OpenGraphInput {
  /** Adds `robots: noindex, nofollow` (e.g. 404, dev/review routes). */
  noindex?: boolean;
  jsonLd?: readonly unknown[];
}

export interface PageSeo {
  title: string;
  description: string;
  canonical: string;
  meta: MetaTag[];
  links: LinkTag[];
  jsonLd: readonly unknown[];
}

/** Aggregate helper for layouts: title, canonical link, OG/Twitter, JSON-LD. */
export function buildPageSeo(input: PageSeoInput): PageSeo {
  const title = buildTitle(input.title);
  const canonical = canonicalUrl(input.path ?? '/');
  const meta: MetaTag[] = [
    { name: 'description', content: input.description },
    ...(input.noindex ? [{ name: 'robots', content: 'noindex, nofollow' }] : []),
    ...buildOpenGraph({ ...input, title, url: canonical }),
    ...buildTwitter({
      title,
      description: input.description,
      image: input.image,
      imageAlt: input.imageAlt,
    }),
  ];

  return {
    title,
    description: input.description,
    canonical,
    meta,
    links: [{ rel: 'canonical', href: canonical }],
    jsonLd: input.jsonLd ?? [],
  };
}

/* ------------------------------------------------------------------ */
/* JSON-LD builders                                                   */
/* ------------------------------------------------------------------ */

export interface PersonSchemaOptions {
  sameAs?: readonly string[];
  image?: string;
  description?: string;
}

/** The object branch of schema-dts `Person` (excludes its string variant). */
export type PersonSchemaObject = Extract<WithContext<Person>, { '@type': 'Person' }>;

export function buildPersonSchema(options: PersonSchemaOptions = {}): PersonSchemaObject {
  const sameAs = options.sameAs ?? PERSONAL_PROFILES;
  const schema: PersonSchemaObject = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': personId(),
    name: SITE_NAME,
    url: canonicalUrl('/'),
    jobTitle: 'Full-stack engineer',
    description: options.description ?? SITE_DESCRIPTION,
    worksFor: {
      '@type': 'Organization',
      name: 'RollTrackApp',
      url: 'https://rolltrackapp.com',
      sameAs: 'https://www.linkedin.com/company/rolltrackapp/',
    },
    affiliation: {
      '@type': 'Organization',
      name: 'SAHA Collective',
      sameAs: 'https://www.linkedin.com/company/sahadotcollective/',
    },
    alumniOf: {
      '@type': 'CollegeOrUniversity',
      name: 'University of California, Irvine',
      url: 'https://uci.edu',
    },
  };
  if (sameAs.length > 0) schema.sameAs = [...sameAs];
  if (options.image) schema.image = absoluteAsset(options.image);
  return schema;
}

interface SearchActionSchema {
  '@type': 'SearchAction';
  target: string;
  'query-input': string;
}

type WebSiteLeaf = Extract<WebSite, { '@type': 'WebSite' }>;
export type WebSiteSchema = WithContext<
  Omit<WebSiteLeaf, 'potentialAction'> & { potentialAction: SearchActionSchema }
>;

export function buildWebsiteSchema(): WebSiteSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': webSiteId(),
    name: SITE_NAME,
    url: canonicalUrl('/'),
    description: SITE_DESCRIPTION,
    inLanguage: SITE_LANGUAGE,
    publisher: { '@type': 'Person', '@id': personId(), name: SITE_NAME },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${canonicalUrl('/search')}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export interface ArticleSchemaInput {
  title: string;
  path: string;
  datePublished: string;
  dateModified?: string;
  description?: string;
  image?: string;
  keywords?: readonly string[];
  section?: string;
  type?: 'Article' | 'BlogPosting';
}

export function buildArticleSchema(
  input: ArticleSchemaInput,
): WithContext<Article | BlogPosting> {
  const url = canonicalUrl(input.path);
  const author = { '@type': 'Person' as const, '@id': personId(), name: SITE_NAME };
  const schema: WithContext<Article | BlogPosting> = {
    '@context': 'https://schema.org',
    '@type': input.type ?? 'BlogPosting',
    '@id': `${url}#article`,
    headline: input.title,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    author,
    publisher: author,
    inLanguage: SITE_LANGUAGE,
  };
  if (input.description) schema.description = input.description;
  if (input.image) schema.image = absoluteAsset(input.image);
  if (input.keywords?.length) schema.keywords = input.keywords.join(', ');
  if (input.section) schema.articleSection = input.section;
  return schema;
}

export interface BreadcrumbEntry {
  name: string;
  path: string;
}

export function buildBreadcrumbSchema(
  entries: readonly BreadcrumbEntry[],
): WithContext<BreadcrumbList> {
  const itemListElement: ListItem[] = entries.map((entry, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: entry.name,
    item: canonicalUrl(entry.path),
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement,
  };
}

export interface CollectionPageInput {
  name: string;
  path: string;
  description?: string;
}

export function buildCollectionPageSchema(
  input: CollectionPageInput,
): WithContext<CollectionPage> {
  const url = canonicalUrl(input.path);
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#collection`,
    name: input.name,
    url,
    inLanguage: SITE_LANGUAGE,
    isPartOf: { '@type': 'WebSite', '@id': webSiteId() },
    ...(input.description ? { description: input.description } : {}),
  };
}

/**
 * Safe JSON-LD serialization. `<`, `>`, `&` and the JS line separators are
 * escaped so a CMS-provided string can never close the script element.
 */
export function serializeJsonLd(value: unknown): string {
  const json = JSON.stringify(value);
  if (json === undefined) throw new Error('JSON-LD payload is not serializable');

  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
