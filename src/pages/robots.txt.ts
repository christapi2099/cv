import type { APIRoute } from 'astro';
import { canonicalUrl } from '../lib/seo';

/**
 * `/robots.txt` (plan.md §3 "URL policy", Phase 4 routes).
 *
 * Generated from the same site origin as every canonical URL, so the sitemap
 * reference is absolute and can never point at localhost or a Ghost host. The
 * sitemap itself is emitted by `@astrojs/sitemap` as `/sitemap-index.xml`.
 */
export const GET: APIRoute = () =>
  new Response(
    [
      'User-agent: *',
      'Allow: /',
      `Sitemap: ${canonicalUrl('/sitemap-index.xml')}`,
      '',
    ].join('\n'),
    {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
    },
  );
