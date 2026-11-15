import { describe, expect, it } from 'vitest';
import { sanitizeGhostHtml, transformEmbedCards } from '../../src/lib/ghost/mapper';

const HOSTILE_HTML = `
  <p>Safe <strong>text</strong>.</p>
  <script>alert('script')</script>
  <iframe src="javascript:alert('frame')"></iframe>
  <img src="x" onerror="alert('image')" />
  <a href="javascript:alert('link')">bad link</a>
  <a href="https://example.com/article">good link</a>
  <a href="data:text/html;base64,PHNjcmlwdD4=">data link</a>
  <svg onload="alert('svg')"><script>alert('svg script')</script></svg>
  <div style="background:url(javascript:alert('style'))">styled</div>
  <object data="https://evil.example/plugin"></object>
  <form action="javascript:alert('form')"><input name="x" /></form>
  <math><mtext><script>alert('math')</script></mtext></math>
`;

describe('Ghost HTML sanitizer', () => {
  it('renders hostile HTML inert (no script, iframe, svg, or javascript: scheme)', () => {
    const clean = sanitizeGhostHtml(HOSTILE_HTML);

    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/<iframe/i);
    expect(clean).not.toMatch(/<svg/i);
    expect(clean).not.toMatch(/<object/i);
    expect(clean).not.toMatch(/<form/i);
    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).not.toMatch(/onerror/i);
    expect(clean).not.toMatch(/data:text\/html/i);
    expect(clean).not.toMatch(/style=/i);

    expect(clean).toContain('Safe');
    expect(clean).toContain('href="https://example.com/article"');
    expect(clean).toContain('rel="noopener noreferrer"');
  });

  it('only allows http(s) and mailto link schemes', () => {
    const clean = sanitizeGhostHtml(
      '<a href="mailto:hi@example.com">mail</a><a href="//evil.example">relative protocol</a>' +
        '<img srcset="javascript:alert(1) 1x" alt="bad">',
    );

    expect(clean).toContain('href="mailto:hi@example.com"');
    expect(clean).not.toContain('//evil.example');
    expect(clean).not.toContain('javascript:');
  });
});

describe('Ghost embed transform', () => {
  it('turns an iframe embed into a static link card before sanitization', () => {
    const html =
      '<figure class="kg-card kg-embed-card"><iframe src="https://www.youtube.com/embed/abc" title="Video"></iframe></figure>';
    const transformed = transformEmbedCards(html);
    const clean = sanitizeGhostHtml(html);

    expect(transformed).toContain('href="https://www.youtube.com/embed/abc"');
    expect(transformed).not.toContain('<iframe');
    expect(clean).toContain('href="https://www.youtube.com/embed/abc"');
    expect(clean).toContain('Embedded content');
    expect(clean).not.toContain('<iframe');
  });

  it('turns video and audio cards into static link cards', () => {
    const html =
      '<div class="kg-card kg-video-card"><video src="https://cdn.example/video.mp4"></video></div>' +
      '<audio src="https://cdn.example/audio.mp3"></audio>';

    const clean = sanitizeGhostHtml(html);

    expect(clean).toContain('href="https://cdn.example/video.mp4"');
    expect(clean).toContain('href="https://cdn.example/audio.mp3"');
    expect(clean).not.toContain('<video');
    expect(clean).not.toContain('<audio');
  });

  it('leaves a bookmark card as a plain sanitized link', () => {
    const html =
      '<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://example.com/post">' +
      '<div class="kg-bookmark-title">A post</div></a></figure>';

    const clean = sanitizeGhostHtml(html);

    expect(clean).toContain('href="https://example.com/post"');
    expect(clean).toContain('A post');
    expect(clean).not.toContain('kg-bookmark');
  });
});
