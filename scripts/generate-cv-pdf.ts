#!/usr/bin/env node
/**
 * Build-time CV PDF (plan.md Phase 4.6).
 *
 * Renders the canonical `src/data/cv.ts` to an HTML print document, then
 * prints it to `dist/cv/tapia-resume.pdf` with Playwright's Chromium. Also
 * writes `dist/cv/tapia-resume.hash` — the SHA-256 of the canonical CV data —
 * so `scripts/check-cv-pdf.ts` can prove the PDF was generated from the same
 * source the /cv route renders.
 *
 * Writes to dist/ only: never src/, never tracked files by itself.
 *
 * Serving: the Vercel build does not run this script (no Chromium in the
 * build image; plan.md:182 renders it in CI). The deployed copy is a
 * committed build artifact at `public/cv/tapia-resume.pdf` (+ `.hash`),
 * copied from dist/ after regeneration. When `src/data/cv.ts` changes,
 * regenerate and refresh that committed copy — the CI `check-cv-pdf` hash
 * gate fails otherwise.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { CV, CV_PDF_BASENAME, CV_PDF_ROUTE } from '../src/data/cv';
import { computeCvHash, renderCvHtml } from './lib/cv-pdf';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT_DIR = path.join(DIST, 'cv');
const PDF_PATH = path.join(OUT_DIR, `${CV_PDF_BASENAME}.pdf`);
const HASH_PATH = path.join(OUT_DIR, `${CV_PDF_BASENAME}.hash`);
const FONT_DIR = path.join(ROOT, 'public', 'fonts');
const TEMP_ROOT = process.env.TMPDIR?.trim() || os.tmpdir();

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  const html = renderCvHtml(CV, {
    fontDir: FONT_DIR,
    siteOrigin: process.env.SITE_URL,
  });

  const tempDir = await mkdtemp(path.join(TEMP_ROOT, 'cv-pdf-'));
  const htmlPath = path.join(tempDir, 'resume.html');
  const browser = await chromium.launch({ headless: true });

  try {
    await writeFile(htmlPath, html, 'utf8');
    const page = await browser.newPage();
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: PDF_PATH,
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '0.55in',
        bottom: '0.55in',
        left: '0.62in',
        right: '0.62in',
      },
    });
  } finally {
    await browser.close();
    await rm(tempDir, { recursive: true, force: true });
  }

  const hash = computeCvHash(CV);
  await writeFile(HASH_PATH, `${hash}\n`, 'utf8');

  console.log(`generate-cv-pdf: wrote ${path.relative(ROOT, PDF_PATH)} (${CV_PDF_ROUTE})`);
  console.log(`generate-cv-pdf: source hash ${hash}`);
}

void main().catch((error: unknown) => {
  console.error(
    `generate-cv-pdf: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
