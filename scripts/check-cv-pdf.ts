#!/usr/bin/env node
/**
 * Gate G4 — verify the CI-generated CV PDF matches the canonical source.
 *
 * Fails when the PDF is missing, is not a PDF, or when the recorded hash does
 * not match a fresh hash of `src/data/cv.ts` (a stale artifact).
 */
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { CV, CV_PDF_BASENAME, CV_PDF_ROUTE } from '../src/data/cv';
import { computeCvHash } from './lib/cv-pdf';

const ROOT = path.resolve(import.meta.dirname, '..');
const PDF_PATH = path.join(ROOT, 'dist', 'cv', `${CV_PDF_BASENAME}.pdf`);
const HASH_PATH = path.join(ROOT, 'dist', 'cv', `${CV_PDF_BASENAME}.hash`);

async function main(): Promise<void> {
  const failures: string[] = [];

  try {
    await stat(PDF_PATH);
  } catch {
    failures.push(`${CV_PDF_ROUTE} is missing — run \`tsx scripts/generate-cv-pdf.ts\` after the build.`);
  }

  if (failures.length === 0) {
    const bytes = await readFile(PDF_PATH);
    if (bytes.length < 1_000) {
      failures.push(`${CV_PDF_ROUTE} is only ${bytes.length} bytes.`);
    }
    if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
      failures.push(`${CV_PDF_ROUTE} does not start with a PDF header.`);
    }
  }

  let recorded: string | null = null;
  try {
    recorded = (await readFile(HASH_PATH, 'utf8')).trim();
  } catch {
    failures.push(
      `${path.relative(ROOT, HASH_PATH)} is missing — the generator writes it alongside the PDF.`,
    );
  }

  const expected = computeCvHash(CV);
  if (recorded !== null && recorded !== expected) {
    failures.push(
      `CV source hash mismatch: recorded ${recorded.slice(0, 12)}…, expected ${expected.slice(0, 12)}… — regenerate the PDF.`,
    );
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`✗ ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log(`✓ ${CV_PDF_ROUTE} exists with a matching source hash (${expected.slice(0, 12)}…).`);
}

void main().catch((error: unknown) => {
  console.error(`check-cv-pdf: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
