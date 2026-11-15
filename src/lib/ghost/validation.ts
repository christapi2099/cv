import type { GhostPost } from './types';

/** Global slug uniqueness is a Ghost invariant; seed mode must not break it. */
export function assertUniqueSlugs(posts: readonly GhostPost[]): void {
  const seen = new Set<string>();
  for (const post of posts) {
    if (seen.has(post.slug)) {
      throw new Error(`Duplicate post slug "${post.slug}" in the content feed.`);
    }
    seen.add(post.slug);
  }
}
