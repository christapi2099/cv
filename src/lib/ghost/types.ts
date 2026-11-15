/**
 * The single content DTO (plan.md §3). Everything a page receives from the
 * content layer — seed Markdown today, Ghost after cutover — has this shape.
 * `html` is sanitizer output and is the only HTML string pages may hand to
 * `set:html`.
 */

export interface GhostPost {
  id: string;
  slug: string;
  title: string;
  /** Sanitized HTML (allowlist applied, embeds transformed to static links). */
  html: string;
  /** Ghost's excerpt when set; otherwise the first 160 chars of plaintext. */
  excerpt: string;
  /** Mirrored `/media/...` URL, or null for the designed no-image card. */
  featureImage: string | null;
  featureImageAlt: string | null;
  featureImageCaption: string | null;
  publishedAt: string;
  updatedAt: string;
  /** Series URL slugs (e.g. `developer-horror-stories`), not tag slugs. */
  seriesSlugs: string[];
  /** Raw tag slugs, including `series-*` internal tags. */
  tagSlugs: string[];
  author: { name: string; url: string | null };
  readingMinutes: number;
}

export interface GhostTag {
  slug: string;
  name: string;
  visibility: 'public' | 'internal';
}

export interface GhostAuthor {
  slug: string;
  name: string;
  url: string | null;
}

/** The snapshot writer's media manifest (media.ts fills this in). */
export interface MediaMirrorEntry {
  sourceUrl: string;
  publicPath: string;
  checksum: string;
  contentType: string;
  bytes: number;
}

export type MediaManifest = Record<string, MediaMirrorEntry>;

export interface GhostSnapshot {
  schemaVersion: 1;
  fetchedAt: string;
  /** sha256 over the canonical snapshot payload (D4). */
  contentHash: string;
  posts: GhostPost[];
  tags: GhostTag[];
  authors: GhostAuthor[];
  site: { title: string; description: string };
  /** Ghost-hosted images mirrored by the snapshot writer; external images absent. */
  media: MediaManifest;
}

/**
 * `unavailable` is the cold-start state: unreachable Ghost and no snapshot.
 * The facade throws in that state — the build fails with setup instructions.
 * `seed` is the v1 mode (D13): no Ghost env vars, content from local Markdown.
 */
export type FeedSource = 'live' | 'snapshot' | 'unavailable' | 'seed';

export interface FeedResult {
  source: FeedSource;
  fetchedAt: string;
  posts: GhostPost[];
}
