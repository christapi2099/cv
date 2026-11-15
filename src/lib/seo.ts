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
 * Personal profiles only. Company LinkedIn pages belong in `worksFor` /
 * `affiliation`, never in `sameAs` (DESIGN.md / plan Phase 1.2).
 */
export const PERSONAL_PROFILES: readonly string[] = [];

/** Canonical origin from the single env source (`SITE_URL`). */
function siteOrigin(): string {
  const configured = process.env.SITE_URL?.trim();
  return configured ? configured.replace(/\/+$/, '') : DEFAULT_SITE_ORIGIN;
}

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
  const tags: MetaTag[] = [
    { property: 'og:site_name', content: input.siteName ?? SITE_NAME },
    { property: 'og:type', content: type },
    { property: 'og:title', content: input.title },
    { property: 'og:description', content: input.description },
    { property: 'og:url', content: url },
    { property: 'og:locale', content: input.locale ?? 'en_US' },
  ];

  if (input.image) {
    tags.push(
      { property: 'og:image', content: absoluteAsset(input.image) },
      { property: 'og:image:alt', content: input.imageAlt ?? input.title },
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
  const tags: MetaTag[] = [
    { name: 'twitter:card', content: input.image ? 'summary_large_image' : 'summary' },
    { name: 'twitter:title', content: input.title },
    { name: 'twitter:description', content: input.description },
  ];
  if (input.image) {
    tags.push(
      { name: 'twitter:image', content: absoluteAsset(input.image) },
      { name: 'twitter:image:alt', content: input.imageAlt ?? input.title },
    );
  }
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

export function buildPersonSchema(options: PersonSchemaOptions = {}): WithContext<Person> {
  const sameAs = options.sameAs ?? PERSONAL_PROFILES;
  const schema: WithContext<Person> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': personId(),
    name: SITE_NAME,
    url: canonicalUrl('/'),
    jobTitle: 'Full-stack engineer',
    description: options.description ?? SITE_DESCRIPTION,
    sameAs: [...sameAs],
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
