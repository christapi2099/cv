#!/usr/bin/env node
/**
 * Pagefind index assertion (review pass 1, m3).
 *
 * `pnpm build` runs `pagefind --site dist` after Astro. A silent Pagefind
 * failure — no `data-pagefind-body` matched, an empty index, a missing entry
 * file — leaves `/search` looking fine while returning nothing. Fail the build
 * instead of shipping a dead search box.
 *
 * Run after `pnpm build` (dist/ must exist).
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PAGEFIND = path.join(ROOT, 'dist', 'pagefind');
const ENTRY = path.join(PAGEFIND, 'pagefind-entry.json');
const INDEX = path.join(PAGEFIND, 'index');

const failures = [];

async function main() {
  let raw;
  try {
    raw = await readFile(ENTRY, 'utf8');
  } catch {
    console.error(
      '✗ dist/pagefind/pagefind-entry.json is missing — `pagefind --site dist` did not run (or found no pages).',
    );
    process.exitCode = 1;
    return;
  }

  let entry;
  try {
    entry = JSON.parse(raw);
  } catch (error) {
    console.error(
      `✗ pagefind-entry.json is not valid JSON (${error instanceof Error ? error.message : String(error)}).`,
    );
    process.exitCode = 1;
    return;
  }

  const languages = entry?.languages;
  if (!languages || typeof languages !== 'object' || Object.keys(languages).length === 0) {
    failures.push('pagefind-entry.json declares no languages');
  }

  let pageCount = 0;
  for (const [language, meta] of Object.entries(languages ?? {})) {
    const count = typeof meta?.page_count === 'number' ? meta.page_count : 0;
    pageCount += count;
    if (count < 1) failures.push(`language "${language}" indexed 0 pages`);
  }
  if (pageCount < 1) failures.push('the Pagefind index contains no pages');

  let indexFiles = [];
  try {
    indexFiles = await readdir(INDEX);
  } catch {
    failures.push('dist/pagefind/index/ is missing');
  }
  if (indexFiles.length === 0) failures.push('dist/pagefind/index/ is empty');

  let indexBytes = 0;
  for (const file of indexFiles) {
    try {
      indexBytes += (await stat(path.join(INDEX, file))).size;
    } catch {
      /* Reported by the empty-directory assertion above. */
    }
  }
  if (indexFiles.length > 0 && indexBytes === 0) failures.push('the Pagefind index is empty');

  if (failures.length > 0) {
    for (const failure of failures) console.error(`✗ ${failure}`);
    console.error('\ncheck-pagefind: the search index is not usable.');
    process.exitCode = 1;
    return;
  }

  console.log(
    `check-pagefind: ${pageCount} indexed page(s), ${indexFiles.length} index file(s), ${indexBytes} bytes.`,
  );
}

void main().catch((error) => {
  console.error(`check-pagefind: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
