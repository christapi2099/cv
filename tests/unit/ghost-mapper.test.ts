import { describe, expect, it } from 'vitest';
import { mapGhostPost, htmlToPlainText } from '../../src/lib/ghost/mapper';
import { seedEntryToGhostPost } from '../../src/lib/seed';

const longBody = `<p>${'word '.repeat(90)}</p><script>alert('x')</script>`;

describe('GhostPost mapper', () => {
  it('maps a Ghost API post to the DTO and sanitizes the body', () => {
    const post = mapGhostPost({
      id: 'ghost-id-1',
      slug: 'a-post',
      title: 'A post',
      html: longBody,
      excerpt: null,
      custom_excerpt: null,
      plaintext: null,
      feature_image: null,
      published_at: '2026-01-02T03:04:05.000Z',
      updated_at: '2026-01-03T03:04:05.000Z',
      reading_time: null,
      tags: [
        { slug: 'series-project-breakdowns', name: '#series: Project Breakdowns' },
        { slug: 'architecture', name: 'Architecture' },
      ],
      authors: [{ slug: 'christopher-tapia', name: 'Christopher Tapia' }],
    });

    expect(post.id).toBe('ghost-id-1');
    expect(post.slug).toBe('a-post');
    expect(post.seriesSlugs).toEqual(['project-breakdowns']);
    expect(post.tagSlugs).toEqual(['series-project-breakdowns', 'architecture']);
    expect(post.author.name).toBe('Christopher Tapia');
    expect(post.html).not.toContain('<script');
    expect(post.excerpt.length).toBeLessThanOrEqual(160);
    expect(post.readingMinutes).toBeGreaterThanOrEqual(1);
    expect(post.featureImage).toBeNull();
  });

  it('prefers Ghost custom_excerpt and maps feature image metadata', () => {
    const post = mapGhostPost({
      id: 'ghost-id-2',
      slug: 'with-image',
      title: 'With image',
      html: '<p>Body</p>',
      custom_excerpt: 'Custom summary',
      feature_image: 'https://cdn.example/hero.jpg',
      feature_image_alt: 'A hero',
      feature_image_caption: 'Caption',
      published_at: '2026-01-02T03:04:05.000Z',
      tags: [],
      authors: [],
    });

    expect(post.excerpt).toBe('Custom summary');
    expect(post.featureImage).toBe('https://cdn.example/hero.jpg');
    expect(post.featureImageAlt).toBe('A hero');
    expect(post.featureImageCaption).toBe('Caption');
    expect(post.author.name).toBe('Christopher Tapia');
  });

  it('rewrites Ghost-hosted media through the snapshot manifest', () => {
    const source = 'https://ghost.example/content/images/hero.jpg';
    const post = mapGhostPost(
      {
        id: 'ghost-id-3',
        slug: 'mirrored',
        title: 'Mirrored',
        html: `<p><img src="${source}" alt="Hero"></p>`,
        feature_image: source,
        published_at: '2026-01-02T03:04:05.000Z',
        tags: [],
        authors: [],
      },
      {
        mediaManifest: {
          [source]: {
            sourceUrl: source,
            publicPath: '/media/abc123.jpg',
            checksum: 'abc123',
            contentType: 'image/jpeg',
            bytes: 10,
          },
        },
      },
    );

    expect(post.html).toContain('src="/media/abc123.jpg"');
    expect(post.featureImage).toBe('/media/abc123.jpg');
  });

  it('rejects a post without a usable date', () => {
    expect(() =>
      mapGhostPost({
        slug: 'undated',
        title: 'Undated',
        html: '<p>x</p>',
        tags: [],
        authors: [],
      }),
    ).toThrow(/published_at/);
  });
});

describe('Seed entry mapper', () => {
  it('produces the identical DTO shape through the shared pipeline', () => {
    const post = seedEntryToGhostPost({
      id: 'developer-horror-stories/the-migration',
      rendered: { html: longBody },
      data: {
        title: 'The migration',
        summary: 'A summary',
        date: new Date('2026-01-02T03:04:05.000Z'),
        featureImage: null,
        featureImageAlt: null,
        featureImageCaption: null,
        draft: false,
        slug: 'the-migration',
        tags: ['migration'],
        claim_source: [],
      },
    });

    expect(post.id).toBe('developer-horror-stories/the-migration');
    expect(post.slug).toBe('the-migration');
    expect(post.seriesSlugs).toEqual(['developer-horror-stories']);
    expect(post.tagSlugs).toEqual(['series-developer-horror-stories', 'migration']);
    expect(post.publishedAt).toBe('2026-01-02T03:04:05.000Z');
    expect(post.excerpt).toBe('A summary');
    expect(post.html).not.toContain('<script');
  });
});

describe('plaintext helpers', () => {
  it('strips tags and collapses whitespace', () => {
    expect(htmlToPlainText('<p>Hello <strong>world</strong></p>\n<p>again</p>')).toBe(
      'Hello world again',
    );
  });
});
