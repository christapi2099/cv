import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  feedLinkTags,
  listSeries,
  seriesSlugFromTagSlug,
  validateSeriesCoverage,
} from '../../src/lib/series';
import type { SeriesDefinition } from '../../src/lib/series';
import type { GhostPost } from '../../src/lib/ghost/types';

function post(slug: string, seriesSlugs: string[]): GhostPost {
  return {
    id: slug,
    slug,
    title: slug,
    html: '<p>Body</p>',
    excerpt: 'Summary',
    featureImage: null,
    featureImageAlt: null,
    featureImageCaption: null,
    publishedAt: '2026-01-02T03:04:05.000Z',
    updatedAt: '2026-01-02T03:04:05.000Z',
    seriesSlugs,
    tagSlugs: seriesSlugs.map((series) => `series-${series}`),
    author: { name: 'Christopher Tapia', url: null },
    readingMinutes: 1,
  };
}

describe('series registry (D11)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalises the Ghost internal tag forms', () => {
    expect(seriesSlugFromTagSlug('series-project-breakdowns')).toBe('project-breakdowns');
    expect(seriesSlugFromTagSlug('#series-project-breakdowns')).toBe('project-breakdowns');
    expect(seriesSlugFromTagSlug('#series: Developer Horror Stories')).toBe(
      'developer-horror-stories',
    );
    expect(seriesSlugFromTagSlug('hash-series-developer-horror-stories')).toBe(
      'developer-horror-stories',
    );
    expect(seriesSlugFromTagSlug('architecture')).toBeNull();
  });

  it('fails the build when a required series has no posts (D11 enforcement)', () => {
    const required: SeriesDefinition[] = [
      { tagSlug: 'series-x', slug: 'x', title: 'X', blurb: '', required: true },
    ];
    expect(() => validateSeriesCoverage([], required)).toThrow(/Required series/);
  });

  it('waived shipped registry (owner 2026-11-15): empty feed warns instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(() => validateSeriesCoverage([])).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/Optional series/),
    );
  });

  it('warns for an unknown series tag but keeps the post standalone', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(() =>
      validateSeriesCoverage([
        post('a', ['developer-horror-stories']),
        post('b', ['project-breakdowns']),
        post('c', ['mystery-series']),
      ]),
    ).not.toThrow();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Unknown series "mystery-series"'));
  });

  it('lists only series with posts and exports the two feed links', () => {
    const listings = listSeries([
      post('a', ['developer-horror-stories']),
      post('b', ['project-breakdowns']),
    ]);

    expect(listings.map((entry) => entry.definition.slug)).toEqual([
      'developer-horror-stories',
      'project-breakdowns',
    ]);

    const links = feedLinkTags('developer-horror-stories');
    expect(links).toHaveLength(2);
    expect(links[0]?.href).toBe('/rss.xml');
    expect(links[1]?.href).toBe('/series/developer-horror-stories/rss.xml');
  });
});
