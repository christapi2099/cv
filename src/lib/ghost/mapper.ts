/**
 * The one mapper (plan.md §3, Phase 2.3).
 *
 * Ghost HTML and seed Markdown both enter here. Embeds become static link
 * cards BEFORE sanitization; `sanitize-html` then applies the allowlist. The
 * returned `html` is the only string pages pass to `set:html`.
 */
import sanitizeHtml from 'sanitize-html';
import { seriesSlugFromTagSlug } from '../series';
import { rewriteMediaUrl, rewriteMediaReferences } from './media';
import type { GhostPost, MediaManifest } from './types';

/* ------------------------------------------------------------------ */
/* Embed transform (pre-sanitization)                                 */
/* ------------------------------------------------------------------ */

const IFRAME_PATTERN =
  /<iframe\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>(?:[\s\S]*?<\/iframe>)?/gi;
const VIDEO_PATTERN = /<video\b[^>]*>[\s\S]*?<\/video>/gi;
const SELF_CLOSING_VIDEO_PATTERN = /<video\b[^>]*\/>/gi;
const AUDIO_PATTERN = /<audio\b[^>]*>[\s\S]*?<\/audio>/gi;
const SELF_CLOSING_AUDIO_PATTERN = /<audio\b[^>]*\/>/gi;

/**
 * Ghost emits iframe-based embeds and video/audio cards. None of those belong
 * in a static, script-free article: each becomes a plain link card. Bookmark
 * cards are already anchors; the sanitizer strips their Ghost classes and
 * leaves a static linked card.
 */
export function transformEmbedCards(html: string): string {
  let result = html.replace(IFRAME_PATTERN, (_match, doubleQuoted?: string, singleQuoted?: string) => {
    const src = (doubleQuoted ?? singleQuoted ?? '').trim();
    return src ? linkCard('Embedded content', src) : '';
  });

  result = result.replace(VIDEO_PATTERN, (match: string) => {
    const src = firstAttribute(match, 'src');
    return src ? linkCard('Video', src) : '';
  });
  result = result.replace(SELF_CLOSING_VIDEO_PATTERN, (match: string) => {
    const src = firstAttribute(match, 'src');
    return src ? linkCard('Video', src) : '';
  });
  result = result.replace(AUDIO_PATTERN, (match: string) => {
    const src = firstAttribute(match, 'src');
    return src ? linkCard('Audio', src) : '';
  });
  result = result.replace(SELF_CLOSING_AUDIO_PATTERN, (match: string) => {
    const src = firstAttribute(match, 'src');
    return src ? linkCard('Audio', src) : '';
  });

  return result;
}

function linkCard(label: string, rawUrl: string): string {
  return `<p><a href="${escapeAttribute(rawUrl)}">${label}</a></p>`;
}

function firstAttribute(tagHtml: string, attribute: string): string | null {
  const pattern = new RegExp(`\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const match = pattern.exec(tagHtml);
  return (match?.[1] ?? match?.[2] ?? '').trim() || null;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ------------------------------------------------------------------ */
/* Sanitizer                                                          */
/* ------------------------------------------------------------------ */

type SanitizeOptions = NonNullable<Parameters<typeof sanitizeHtml>[1]>;

function anchorTransformer(
  tagName: string,
  attribs: Record<string, string>,
): { tagName: string; attribs: Record<string, string> } {
  return { tagName, attribs: { ...attribs, rel: 'noopener noreferrer' } };
}

/**
 * Allowlist: article structure, text semantics, links, images, tables. No
 * scripts, styles, iframes, SVG, forms, objects, or event handlers. URL
 * schemes are limited to http(s) and mailto; protocol-relative URLs are off.
 */
export const GHOST_SANITIZE_OPTIONS: SanitizeOptions = {
  allowedTags: [
    'p',
    'br',
    'hr',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'blockquote',
    'pre',
    'code',
    'em',
    'strong',
    'b',
    'i',
    'u',
    's',
    'del',
    'ins',
    'mark',
    'small',
    'sub',
    'sup',
    'a',
    'img',
    'figure',
    'figcaption',
    'div',
    'span',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'caption',
    'dl',
    'dt',
    'dd',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'rel'],
    img: ['src', 'srcset', 'sizes', 'alt', 'width', 'height', 'loading', 'decoding'],
    th: ['colspan', 'rowspan', 'scope'],
    td: ['colspan', 'rowspan'],
    h1: ['id'],
    h2: ['id'],
    h3: ['id'],
    h4: ['id'],
    h5: ['id'],
    h6: ['id'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    a: ['http', 'https', 'mailto'],
    img: ['http', 'https'],
  },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  nonTextTags: ['script', 'style', 'textarea', 'option'],
  transformTags: {
    a: anchorTransformer,
  },
};

export interface SanitizeGhostHtmlOptions {
  mediaManifest?: MediaManifest;
}

export function sanitizeGhostHtml(html: string, options: SanitizeGhostHtmlOptions = {}): string {
  const withLinkCards = transformEmbedCards(html);
  const clean = sanitizeHtml(withLinkCards, GHOST_SANITIZE_OPTIONS);
  return options.mediaManifest ? rewriteMediaReferences(clean, options.mediaManifest) : clean;
}

/* ------------------------------------------------------------------ */
/* Text helpers                                                       */
/* ------------------------------------------------------------------ */

const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

export function htmlToPlainText(html: string): string {
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

export function estimateReadingMinutes(plainText: string): number {
  const words = plainText.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function decodeEntities(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, (entity) => ENTITY_MAP[entity] ?? entity);
}

/* ------------------------------------------------------------------ */
/* DTO construction                                                   */
/* ------------------------------------------------------------------ */

export interface GhostPostInput {
  id: string;
  slug: string;
  title: string;
  rawHtml: string;
  excerpt?: string | null;
  plaintext?: string | null;
  featureImage?: string | null;
  featureImageAlt?: string | null;
  featureImageCaption?: string | null;
  publishedAt: string;
  updatedAt: string;
  authorName: string;
  authorUrl?: string | null;
  seriesSlugs: readonly string[];
  tagSlugs: readonly string[];
  readingTime?: number | null;
  mediaManifest?: MediaManifest;
}

export function buildGhostPost(input: GhostPostInput): GhostPost {
  const html = sanitizeGhostHtml(input.rawHtml, { mediaManifest: input.mediaManifest });
  const plainText = (input.plaintext ?? '').trim() || htmlToPlainText(html);
  const excerpt = (input.excerpt ?? '').trim() || plainText.slice(0, 160).trim();
  const publishedAt = toIso(input.publishedAt);
  const updatedAt = toIso(input.updatedAt);
  const readingMinutes =
    typeof input.readingTime === 'number' && input.readingTime > 0
      ? Math.max(1, Math.ceil(input.readingTime))
      : estimateReadingMinutes(plainText);

  return {
    id: input.id,
    slug: input.slug,
    title: input.title.trim() || 'Untitled',
    html,
    excerpt,
    featureImage: rewriteMediaUrl(input.featureImage ?? null, input.mediaManifest ?? {}),
    featureImageAlt: cleanOptionalText(input.featureImageAlt),
    featureImageCaption: cleanOptionalText(input.featureImageCaption),
    publishedAt,
    updatedAt,
    seriesSlugs: [...new Set(input.seriesSlugs)],
    tagSlugs: [...new Set(input.tagSlugs)],
    author: { name: input.authorName.trim() || 'Christopher Tapia', url: input.authorUrl ?? null },
    readingMinutes,
  };
}

export interface GhostApiTagLike {
  slug: string;
  name?: string | null;
  visibility?: string | null;
}

export interface GhostApiAuthorLike {
  slug?: string | null;
  name?: string | null;
  url?: string | null;
}

/** Structural subset of `@tryghost/content-api`'s PostOrPage. */
export interface GhostApiPostLike {
  id?: string | null;
  slug: string;
  title?: string | null;
  html?: string | null;
  excerpt?: string | null;
  custom_excerpt?: string | null;
  plaintext?: string | null;
  feature_image?: string | null;
  feature_image_alt?: string | null;
  feature_image_caption?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  reading_time?: number | null;
  tags?: readonly GhostApiTagLike[] | null;
  authors?: readonly GhostApiAuthorLike[] | null;
  primary_author?: GhostApiAuthorLike | null;
}

export interface MapGhostPostOptions {
  mediaManifest?: MediaManifest;
}

/**
 * Mapper input is a Ghost API post. Series slugs are derived from the tag
 * list here so seed and Ghost posts go through the identical DTO pipeline.
 */
export function mapGhostPost(
  post: GhostApiPostLike,
  options: MapGhostPostOptions = {},
): GhostPost {
  const publishedAt = post.published_at ?? post.created_at;
  if (!publishedAt) {
    throw new Error(`Ghost post "${post.slug}" has no published_at/created_at timestamp.`);
  }

  const tags = post.tags ?? [];
  const author = post.primary_author ?? post.authors?.[0] ?? null;
  const tagSlugs = tags.map((tag) => tag.slug).filter((slug) => slug.length > 0);

  return buildGhostPost({
    id: post.id ?? post.slug,
    slug: post.slug,
    title: post.title ?? 'Untitled',
    rawHtml: post.html ?? '',
    excerpt: post.custom_excerpt ?? post.excerpt ?? null,
    plaintext: post.plaintext ?? null,
    featureImage: post.feature_image ?? null,
    featureImageAlt: post.feature_image_alt ?? null,
    featureImageCaption: post.feature_image_caption ?? null,
    publishedAt,
    updatedAt: post.updated_at ?? publishedAt,
    authorName: author?.name ?? 'Christopher Tapia',
    authorUrl: null,
    seriesSlugs: extractSeriesSlugsFromTags(tags, tagSlugs),
    tagSlugs,
    readingTime: post.reading_time ?? null,
    mediaManifest: options.mediaManifest,
  });
}

function extractSeriesSlugsFromTags(
  tags: readonly GhostApiTagLike[],
  tagSlugs: readonly string[],
): string[] {
  const fromSlugs = unique(seriesSlugsFromTagList(tagSlugs));
  if (fromSlugs.length > 0) return fromSlugs;

  // Some Ghost internal tags surface their series marker as the display name.
  return unique(seriesSlugsFromTagList(tags.flatMap((tag) => (tag.name ? [tag.name] : []))));
}

function seriesSlugsFromTagList(values: readonly string[]): string[] {
  return values
    .map((value) => seriesSlugFromTagSlug(value))
    .filter((slug): slug is string => slug !== null);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function cleanOptionalText(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function toIso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid content date "${value}".`);
  }
  return date.toISOString();
}
