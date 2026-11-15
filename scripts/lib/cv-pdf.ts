/**
 * Shared CV hashing + print rendering for the CI PDF (plan.md Phase 4.6).
 *
 * `computeCvHash` is the source-content hash: both the PDF generator and the
 * verifier derive it from `src/data/cv.ts`, so a stale PDF fails CI instead of
 * silently drifting from the `/cv` route.
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CvData, CvLink } from '../../src/data/cv';

export interface RenderCvOptions {
  /** Absolute path to `public/fonts`; the print document loads local woff2 files. */
  fontDir: string;
  /** Optional canonical origin used to absolutise internal links. */
  siteOrigin?: string;
}

export function computeCvHash(cv: CvData): string {
  return createHash('sha256').update(stableStringify(cv)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

export function renderCvHtml(cv: CvData, options: RenderCvOptions): string {
  const font = (file: string): string =>
    pathToFileURL(path.join(options.fontDir, file)).href;
  const link = (href: string): string => absoluteHref(href, options.siteOrigin);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(cv.name)} — CV</title>
<style>
  @font-face {
    font-family: "Michroma";
    font-style: normal;
    font-weight: 400;
    src: url("${font('michroma-400.woff2')}") format("woff2");
  }
  @font-face {
    font-family: "Space Grotesk";
    font-style: normal;
    font-weight: 500;
    src: url("${font('space-grotesk-500.woff2')}") format("woff2");
  }
  @font-face {
    font-family: "Space Grotesk";
    font-style: normal;
    font-weight: 600;
    src: url("${font('space-grotesk-600.woff2')}") format("woff2");
  }
  @font-face {
    font-family: "Space Grotesk";
    font-style: normal;
    font-weight: 700;
    src: url("${font('space-grotesk-700.woff2')}") format("woff2");
  }
  @font-face {
    font-family: "Inter";
    font-style: normal;
    font-weight: 400;
    src: url("${font('inter-400.woff2')}") format("woff2");
  }
  @font-face {
    font-family: "Inter";
    font-style: normal;
    font-weight: 500;
    src: url("${font('inter-500.woff2')}") format("woff2");
  }
  @font-face {
    font-family: "JetBrains Mono";
    font-style: normal;
    font-weight: 400;
    src: url("${font('jetbrains-mono-400.woff2')}") format("woff2");
  }

  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #1d2f3d;
    background: #ffffff;
    font-family: "Inter", sans-serif;
    font-size: 9.6pt;
    line-height: 1.42;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1, h2, h3 { font-family: "Space Grotesk", sans-serif; margin: 0; }
  h1 {
    font-family: "Michroma", sans-serif;
    font-size: 18pt;
    font-weight: 400;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: #05080d;
  }
  h2 {
    margin-top: 11pt;
    padding-bottom: 2pt;
    border-bottom: 1px solid #a1b1a4;
    font-size: 10.5pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #193330;
  }
  h3 { font-size: 10pt; font-weight: 700; color: #05080d; }
  p { margin: 0; }
  ul { margin: 2pt 0 0; padding-left: 12pt; }
  li { margin: 0 0 2.5pt; }
  a { color: #155dfc; text-decoration: none; }
  .header {
    display: flex;
    justify-content: space-between;
    gap: 18pt;
    padding-bottom: 7pt;
    border-bottom: 2px solid #05080d;
  }
  .headline {
    margin-top: 3pt;
    font-family: "Space Grotesk", sans-serif;
    font-size: 9.5pt;
    font-weight: 600;
    color: #193330;
  }
  .positioning {
    margin-top: 2pt;
    font-family: "Space Grotesk", sans-serif;
    font-size: 8.2pt;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #535f55;
  }
  .contact {
    min-width: 34%;
    text-align: right;
    font-size: 8.6pt;
    line-height: 1.5;
  }
  .summary { margin-top: 7pt; }
  .entry { margin-top: 7pt; break-inside: avoid; }
  .entry-head { display: flex; justify-content: space-between; gap: 12pt; }
  .meta { color: #535f55; font-size: 8.6pt; }
  .tech {
    margin-top: 2pt;
    color: #535f55;
    font-family: "JetBrains Mono", monospace;
    font-size: 7.8pt;
  }
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12pt;
  }
  .skill-group { margin-top: 4pt; break-inside: avoid; }
  .skill-label {
    font-family: "Space Grotesk", sans-serif;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #193330;
  }
  .footer {
    margin-top: 12pt;
    padding-top: 4pt;
    border-top: 1px solid #a1b1a4;
    color: #535f55;
    font-size: 7.8pt;
  }
</style>
</head>
<body>
  <header class="header">
    <div>
      <h1>${escapeHtml(cv.name)}</h1>
      <p class="headline">${escapeHtml(cv.headline)}</p>
      <p class="positioning">${escapeHtml(cv.positioning)}</p>
    </div>
    <div class="contact">
      <p>${escapeHtml(cv.location)}</p>
      <p><a href="mailto:${escapeHtml(cv.email)}">${escapeHtml(cv.email)}</a></p>
      ${cv.links.map((item) => `<p>${renderLink(item, link)}</p>`).join('')}
    </div>
  </header>

  <p class="summary">${escapeHtml(cv.summary)}</p>

  <h2>Experience</h2>
  ${cv.experience.map((entry) => renderExperience(entry, link)).join('')}

  <h2>Education</h2>
  ${cv.education
    .map(
      (entry) => `<div class="entry">
        <div class="entry-head">
          <h3>${escapeHtml(entry.degree)} — ${escapeHtml(entry.institution)}</h3>
          <span class="meta">${escapeHtml(entry.period)}</span>
        </div>
        <p>${escapeHtml(entry.detail)}</p>
      </div>`,
    )
    .join('')}

  <h2>Certifications</h2>
  ${cv.certifications.map((entry) => renderCertification(entry, link)).join('')}

  <h2>Skills</h2>
  <div class="two-col">
    ${cv.skills.map((group) => renderSkillGroup(group)).join('')}
  </div>

  <h2>Selected work</h2>
  ${cv.selectedWork
    .map(
      (entry) => `<div class="entry">
        <div class="entry-head">
          <h3>${renderHref(entry.href, entry.title, link)}</h3>
        </div>
        <p>${escapeHtml(entry.summary)}</p>
      </div>`,
    )
    .join('')}

  <p class="footer">Updated ${escapeHtml(cv.updated)}. Generated from src/data/cv.ts — never hand-edited.</p>
</body>
</html>`;
}

function renderExperience(
  entry: CvData['experience'][number],
  link: (href: string) => string,
): string {
  return `<div class="entry">
    <div class="entry-head">
      <h3>${escapeHtml(entry.role)} — ${renderHref(entry.href, entry.company, link)}</h3>
      <span class="meta">${escapeHtml(entry.period)}${
        entry.location ? ` · ${escapeHtml(entry.location)}` : ''
      }</span>
    </div>
    <p>${escapeHtml(entry.summary)}</p>
    <ul>${entry.highlights.map((highlight) => `<li>${escapeHtml(highlight)}</li>`).join('')}</ul>
    <p class="tech">${entry.technologies.map(escapeHtml).join(' · ')}</p>
  </div>`;
}

function renderCertification(
  entry: CvData['certifications'][number],
  link: (href: string) => string,
): string {
  return `<div class="entry">
    <div class="entry-head">
      <h3>${renderHref(entry.url, entry.name, link)}</h3>
      <span class="meta">${escapeHtml(entry.issuer)} · ${escapeHtml(entry.date)}</span>
    </div>
    <p>${escapeHtml(entry.note)}</p>
  </div>`;
}

function renderSkillGroup(group: CvData['skills'][number]): string {
  return `<div class="skill-group">
    <p class="skill-label">${escapeHtml(group.label)}</p>
    <p>${group.items.map(escapeHtml).join(' · ')}</p>
  </div>`;
}

function renderLink(item: CvLink, link: (href: string) => string): string {
  return renderHref(item.href, item.label, link);
}

function renderHref(
  href: string | undefined,
  label: string,
  link: (href: string) => string,
): string {
  const escapedLabel = escapeHtml(label);
  if (!href) return escapedLabel;
  return `<a href="${escapeHtml(link(href))}">${escapedLabel}</a>`;
}

function absoluteHref(href: string, siteOrigin: string | undefined): string {
  if (/^https?:\/\//i.test(href) || href.startsWith('mailto:')) return href;
  const origin = siteOrigin?.trim().replace(/\/+$/, '');
  return origin ? `${origin}${href.startsWith('/') ? href : `/${href}`}` : href;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
