/**
 * Snapshot store (plan.md D4).
 *
 * Read-only from the build; writes happen ONLY in scripts/snapshot-ghost.ts
 * (scheduled CI, activated at cutover). The build never calls `writeSnapshot`.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  GhostAuthor,
  GhostPost,
  GhostSnapshot,
  GhostTag,
  MediaManifest,
} from './types';

export const SNAPSHOT_DIR = 'src/content/ghost-snapshot';
const MAX_VERSIONS = 10;

export interface SnapshotPaths {
  root: string;
  current: string;
  versions: string;
}

export function snapshotPaths(root = process.cwd()): SnapshotPaths {
  const base = path.join(root, SNAPSHOT_DIR);
  return {
    root: base,
    current: path.join(base, 'current.json'),
    versions: path.join(base, 'versions'),
  };
}

/** sha256 over the canonical content payload (posts/tags/authors/site). */
export function computeContentHash(input: {
  posts: readonly GhostPost[];
  tags: readonly GhostTag[];
  authors: readonly GhostAuthor[];
  site: GhostSnapshot['site'];
}): string {
  return createHash('sha256').update(stableStringify(input)).digest('hex');
}

/**
 * Returns null when no snapshot exists. A corrupt snapshot is treated as
 * missing (with a warning) so the build can fail with the cold-start message
 * instead of rendering half-parsed data.
 */
export async function readSnapshot(root = process.cwd()): Promise<GhostSnapshot | null> {
  const { current } = snapshotPaths(root);
  let raw: string;
  try {
    raw = await readFile(current, 'utf8');
  } catch (error) {
    if (isMissingFile(error)) return null;
    console.warn(`[ghost] Could not read ${current}: ${describeError(error)}`);
    return null;
  }

  try {
    return parseSnapshot(JSON.parse(raw));
  } catch (error) {
    console.warn(`[ghost] Ignoring invalid snapshot ${current}: ${describeError(error)}`);
    return null;
  }
}

/** Writer used only by the scheduled script. Never call from a build. */
export async function writeSnapshot(
  snapshot: GhostSnapshot,
  root = process.cwd(),
): Promise<{ current: string; version: string }> {
  const paths = snapshotPaths(root);
  await mkdir(paths.versions, { recursive: true });

  const versionName = `${new Date(snapshot.fetchedAt).toISOString().replace(/[:.]/g, '-')}.json`;
  const version = path.join(paths.versions, versionName);
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;

  await writeFile(version, serialized, 'utf8');
  await writeFile(paths.current, serialized, 'utf8');
  await pruneVersions(paths.versions);

  return { current: paths.current, version };
}

export function parseSnapshot(value: unknown): GhostSnapshot {
  if (!isRecord(value)) throw new Error('snapshot is not an object');
  if (value.schemaVersion !== 1) throw new Error('unsupported snapshot schemaVersion');

  const fetchedAt = requireString(value, 'fetchedAt');
  const contentHash = requireString(value, 'contentHash');
  const posts = requireArray(value, 'posts').map(parsePost);
  const tags = requireArray(value, 'tags').map(parseTag);
  const authors = requireArray(value, 'authors').map(parseAuthor);
  const site = requireRecord(value, 'site');
  const media = value.media === undefined ? {} : parseMedia(value.media);

  return {
    schemaVersion: 1,
    fetchedAt,
    contentHash,
    posts,
    tags,
    authors,
    site: {
      title: requireString(site, 'title'),
      description: requireString(site, 'description'),
    },
    media,
  };
}

async function pruneVersions(versionsDir: string): Promise<void> {
  const entries = (await readdir(versionsDir))
    .filter((name) => name.endsWith('.json'))
    .sort()
    .reverse();

  for (const stale of entries.slice(MAX_VERSIONS)) {
    await unlink(path.join(versionsDir, stale));
  }
}

function parsePost(value: unknown): GhostPost {
  if (!isRecord(value)) throw new Error('snapshot post is not an object');
  const author = requireRecord(value, 'author');
  const featureImage = value.featureImage;
  return {
    id: requireString(value, 'id'),
    slug: requireString(value, 'slug'),
    title: requireString(value, 'title'),
    html: requireString(value, 'html'),
    excerpt: requireString(value, 'excerpt'),
    featureImage: featureImage === null ? null : requireString(value, 'featureImage'),
    featureImageAlt: optionalString(value, 'featureImageAlt'),
    featureImageCaption: optionalString(value, 'featureImageCaption'),
    publishedAt: requireString(value, 'publishedAt'),
    updatedAt: requireString(value, 'updatedAt'),
    seriesSlugs: requireStringArray(value, 'seriesSlugs'),
    tagSlugs: requireStringArray(value, 'tagSlugs'),
    author: {
      name: requireString(author, 'name'),
      url: optionalString(author, 'url'),
    },
    readingMinutes: requireNumber(value, 'readingMinutes'),
  };
}

function parseTag(value: unknown): GhostTag {
  if (!isRecord(value)) throw new Error('snapshot tag is not an object');
  const visibility = value.visibility === 'internal' ? 'internal' : 'public';
  return {
    slug: requireString(value, 'slug'),
    name: requireString(value, 'name'),
    visibility,
  };
}

function parseAuthor(value: unknown): GhostAuthor {
  if (!isRecord(value)) throw new Error('snapshot author is not an object');
  return {
    slug: requireString(value, 'slug'),
    name: requireString(value, 'name'),
    url: optionalString(value, 'url'),
  };
}

function parseMedia(value: unknown): MediaManifest {
  if (!isRecord(value)) throw new Error('snapshot media is not an object');

  const manifest: MediaManifest = {};
  for (const [sourceUrl, entry] of Object.entries(value)) {
    if (!isRecord(entry)) throw new Error('snapshot media entry is not an object');
    manifest[sourceUrl] = {
      sourceUrl,
      publicPath: requireString(entry, 'publicPath'),
      checksum: requireString(entry, 'checksum'),
      contentType: requireString(entry, 'contentType'),
      bytes: requireNumber(entry, 'bytes'),
    };
  }
  return manifest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: Record<string, unknown>, key: string): Record<string, unknown> {
  const found = value[key];
  if (!isRecord(found)) throw new Error(`snapshot field "${key}" is not an object`);
  return found;
}

function requireString(value: Record<string, unknown>, key: string): string {
  const found = value[key];
  if (typeof found !== 'string') throw new Error(`snapshot field "${key}" is not a string`);
  return found;
}

function optionalString(value: Record<string, unknown>, key: string): string | null {
  const found = value[key];
  if (found === undefined || found === null) return null;
  if (typeof found !== 'string') throw new Error(`snapshot field "${key}" is not a string`);
  return found;
}

function requireNumber(value: Record<string, unknown>, key: string): number {
  const found = value[key];
  if (typeof found !== 'number' || !Number.isFinite(found)) {
    throw new Error(`snapshot field "${key}" is not a number`);
  }
  return found;
}

function requireArray(value: Record<string, unknown>, key: string): unknown[] {
  const found = value[key];
  if (!Array.isArray(found)) throw new Error(`snapshot field "${key}" is not an array`);
  return found;
}

function requireStringArray(value: Record<string, unknown>, key: string): string[] {
  return requireArray(value, key).map((entry) => {
    if (typeof entry !== 'string') throw new Error(`snapshot field "${key}" contains a non-string`);
    return entry;
  });
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
