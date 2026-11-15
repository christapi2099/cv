/**
 * Snapshot writer — DORMANT until Phase G.
 *
 * This is the only code path allowed to download Ghost media or write a
 * snapshot. It is never imported by the build; the scheduled CI job invokes:
 *
 *   pnpm tsx scripts/snapshot-ghost.ts [--dry-run]
 *
 * It writes current.json + versions/<ISO>.json (last 10) and stops there.
 * Opening the PR is the CI job's job — this script never commits or pushes.
 */
import path from 'node:path';
import { createGhostClient } from '../src/lib/ghost/client';
import { readGhostCredentials } from '../src/lib/ghost/env';
import {
  collectImageUrls,
  mirrorGhostImages,
  rewriteMediaReferences,
  rewriteMediaUrl,
} from '../src/lib/ghost/media';
import {
  computeContentHash,
  readSnapshot,
  writeSnapshot,
} from '../src/lib/ghost/snapshot-store';
import type { GhostSnapshot } from '../src/lib/ghost/types';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const credentials = readGhostCredentials();
  const client = createGhostClient(credentials);

  const [posts, tags, authors, site] = await Promise.all([
    client.fetchPosts(),
    client.fetchTags(),
    client.fetchAuthors(),
    client.fetchSite(),
  ]);

  const imageUrls = posts.flatMap((post) => [
    ...(post.featureImage ? [post.featureImage] : []),
    ...collectImageUrls(post.html),
  ]);

  const media = dryRun
    ? {}
    : await mirrorGhostImages(imageUrls, {
        ghostOrigin: credentials.url,
        publicDir: path.resolve(process.cwd(), 'public'),
      });

  const mirroredPosts = posts.map((post) => ({
    ...post,
    html: rewriteMediaReferences(post.html, media),
    featureImage: rewriteMediaUrl(post.featureImage, media),
  }));

  const contentHash = computeContentHash({ posts: mirroredPosts, tags, authors, site });
  const snapshot: GhostSnapshot = {
    schemaVersion: 1,
    fetchedAt: new Date().toISOString(),
    contentHash,
    posts: mirroredPosts,
    tags,
    authors,
    site,
    media,
  };

  const existing = await readSnapshot();
  if (existing?.contentHash === contentHash) {
    console.log(`[snapshot] Content hash unchanged (${contentHash.slice(0, 12)}). No files written.`);
    return;
  }

  if (dryRun) {
    console.log(
      `[snapshot] Dry run: ${posts.length} posts, ${tags.length} tags, ${authors.length} authors, ` +
        `${Object.keys(media).length} mirrored images. No files written.`,
    );
    return;
  }

  const written = await writeSnapshot(snapshot);
  console.log(`[snapshot] Wrote ${written.current}`);
  console.log(`[snapshot] Wrote ${written.version}`);
  console.log(
    '[snapshot] Next: commit both files on a branch and open a PR. This script never commits or pushes.',
  );
}

main().catch((error: unknown) => {
  console.error(`[snapshot] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
