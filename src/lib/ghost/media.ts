/**
 * Ghost media mirroring (plan.md §3, D4/R13).
 *
 * The snapshot writer is the ONLY caller that downloads or writes. The build
 * imports these helpers but never invokes them; in seed mode media are
 * repo-local and this module is idle.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { MediaManifest, MediaMirrorEntry } from './types';

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

export interface MirrorOptions {
  /** Origin of the Ghost instance, e.g. `https://blog.example.com`. */
  ghostOrigin: string;
  /** Project `public/` directory. */
  publicDir: string;
  fetchImpl?: typeof fetch;
}

/** True for URLs served by the configured Ghost origin (case-insensitive host). */
export function isGhostHosted(sourceUrl: string, ghostOrigin: string): boolean {
  const candidate = toUrl(sourceUrl);
  const ghost = toUrl(ghostOrigin);
  return candidate !== null && ghost !== null && candidate.host === ghost.host;
}

/**
 * Every image URL referenced by sanitized post HTML: `src`, `srcset` entries,
 * and video `poster` values. External URLs are included here; the writer
 * filters them with `isGhostHosted` before downloading.
 */
export function collectImageUrls(html: string): string[] {
  const urls = new Set<string>();

  for (const match of html.matchAll(/\b(?:src|poster)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const url = (match[1] ?? match[2] ?? '').trim();
    if (url) urls.add(url);
  }

  for (const match of html.matchAll(/\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const value = match[1] ?? match[2] ?? '';
    for (const candidate of value.split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url) urls.add(url);
    }
  }

  return [...urls];
}

/** Download one image and write it under `public/media/<checksum>.<ext>`. */
export async function mirrorImage(
  sourceUrl: string,
  options: MirrorOptions,
): Promise<MediaMirrorEntry> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(sourceUrl);
  if (!response.ok) {
    throw new Error(`Media mirror failed for ${sourceUrl}: HTTP ${response.status}.`);
  }

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? 'application/octet-stream';
  const body = Buffer.from(await response.arrayBuffer());
  const checksum = createHash('sha256').update(body).digest('hex');
  const extension = extensionFor(contentType, sourceUrl);
  const fileName = `${checksum.slice(0, 16)}.${extension}`;
  const mediaDir = path.join(options.publicDir, 'media');

  await mkdir(mediaDir, { recursive: true });
  await writeFile(path.join(mediaDir, fileName), body);

  return {
    sourceUrl,
    publicPath: `/media/${fileName}`,
    checksum,
    contentType,
    bytes: body.byteLength,
  };
}

/** Mirror every Ghost-hosted image in a post set and return the manifest. */
export async function mirrorGhostImages(
  urls: readonly string[],
  options: MirrorOptions,
): Promise<MediaManifest> {
  const manifest: MediaManifest = {};
  const unique = [...new Set(urls)].filter((url) => isGhostHosted(url, options.ghostOrigin));

  for (const sourceUrl of unique) {
    const entry = await mirrorImage(sourceUrl, options);
    manifest[sourceUrl] = entry;
  }

  return manifest;
}

/** `srcset` entries and escaped ampersands are handled by literal replacement. */
export function rewriteMediaReferences(html: string, manifest: MediaManifest): string {
  let result = html;
  for (const entry of Object.values(manifest)) {
    result = result.split(entry.sourceUrl).join(entry.publicPath);
    const escaped = entry.sourceUrl.replace(/&/g, '&amp;');
    if (escaped !== entry.sourceUrl) result = result.split(escaped).join(entry.publicPath);
  }
  return result;
}

export function rewriteMediaUrl(url: string | null, manifest: MediaManifest): string | null {
  if (url === null) return null;
  return manifest[url]?.publicPath ?? manifest[url.replace(/&/g, '&amp;')]?.publicPath ?? url;
}

function extensionFor(contentType: string, sourceUrl: string): string {
  const known = CONTENT_TYPE_EXTENSIONS[contentType.toLowerCase()];
  if (known) return known;

  const pathname = toUrl(sourceUrl)?.pathname ?? '';
  const candidate = pathname.split('.').pop()?.toLowerCase();
  return candidate && /^[a-z0-9]{2,5}$/.test(candidate) ? candidate : 'bin';
}

function toUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
