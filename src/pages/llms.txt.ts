import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { CV } from '../data/cv';
import { canonicalUrl } from '../lib/seo';
import { SERIES } from '../lib/series';

/**
 * `/llms.txt` (llmstxt.org convention, owner request Phase 6-G).
 *
 * A markdown index for LLM crawlers: one-line intro from the canonical CV data,
 * then absolute links to every public surface. Built from `canonicalUrl()` like
 * every other emitted URL, so the origin is the configured `SITE_URL` and can
 * never point at localhost or a Ghost host. Case studies come from the `work`
 * collection (draft entries excluded), series from the D11 registry.
 */
const oneLine = (value: string): string => value.replace(/\s+/g, ' ').trim();

export const GET: APIRoute = async () => {
  const studies = (await getCollection('work'))
    .filter((entry) => !entry.data.draft)
    .sort((left, right) => left.data.order - right.data.order);

  const lines = [
    `# ${CV.name}`,
    '',
    `> ${oneLine(`${CV.headline} — ${CV.positioning}`)}.`,
    '',
    '## Pages',
    `- [Home](${canonicalUrl('/')}): Portfolio home — selected work, writing, and background.`,
    `- [Work](${canonicalUrl('/work')}): Case studies with the numbers and trade-offs behind them.`,
    `- [Blog](${canonicalUrl('/blog')}): Writing on production incidents and architecture decisions.`,
    `- [Series](${canonicalUrl('/series')}): Long-form series of related posts.`,
    `- [CV](${canonicalUrl('/cv')}): Full CV — experience, education, certifications, skills.`,
    `- [Contact](${canonicalUrl('/contact')}): Contact details and the email form.`,
    '',
    '## Case studies',
    ...studies.map(
      (study) =>
        `- [${oneLine(study.data.title)}](${canonicalUrl(`/work/${study.data.slug}`)}): ${oneLine(study.data.summary)}`,
    ),
    '',
    '## Series',
    ...SERIES.map(
      (series) =>
        `- [${oneLine(series.title)}](${canonicalUrl(`/series/${series.slug}`)}): ${oneLine(series.blurb)}`,
    ),
    '',
    '## Feeds and indexes',
    `- [RSS](${canonicalUrl('/rss.xml')}): Site-wide feed of published posts.`,
    `- [Sitemap](${canonicalUrl('/sitemap-index.xml')}): Full URL index for crawlers.`,
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  });
};
