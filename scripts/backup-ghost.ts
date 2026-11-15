/**
 * Ghost backup — DORMANT until Phase G.
 *
 * Exports Content API content to a timestamped JSON file. The database dump
 * and off-site upload activate with the cutover runbook (docs/backups.md);
 * this script deliberately does not shell out to provider tooling.
 *
 *   pnpm tsx scripts/backup-ghost.ts --dry-run
 *   BACKUP_DIR=/secure/path pnpm tsx scripts/backup-ghost.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createGhostClient } from '../src/lib/ghost/client';
import { readGhostCredentials } from '../src/lib/ghost/env';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const credentials = readGhostCredentials();

  if (!dryRun && !process.env.BACKUP_DIR?.trim()) {
    throw new Error('BACKUP_DIR is required unless --dry-run is passed.');
  }

  const client = createGhostClient(credentials);
  const [posts, tags, authors, site] = await Promise.all([
    client.fetchPosts(),
    client.fetchTags(),
    client.fetchAuthors(),
    client.fetchSite(),
  ]);

  const payload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    site,
    counts: { posts: posts.length, tags: tags.length, authors: authors.length },
    posts,
    tags,
    authors,
  };

  if (dryRun) {
    console.log(
      `[backup] Dry run: ${posts.length} posts, ${tags.length} tags, ${authors.length} authors. No files written.`,
    );
    return;
  }

  const backupDir = path.resolve(process.cwd(), process.env.BACKUP_DIR?.trim() ?? '');
  await mkdir(backupDir, { recursive: true });
  const fileName = `ghost-content-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const target = path.join(backupDir, fileName);
  await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`[backup] Wrote ${target}`);
}

main().catch((error: unknown) => {
  console.error(`[backup] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
