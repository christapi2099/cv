/**
 * Content Layer configuration (plan.md Phase 2.2, D13).
 *
 * Active in v1: the seed glob loader over src/content/seed/<series>/*.md.
 * Dormant until cutover: the Ghost collection, registered only when both Ghost
 * env vars are present. Mapping is shared (lib/ghost/mapper.ts) — pages see the
 * same GhostPost DTO either way.
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { hasGhostCredentials } from './lib/ghost/env';
import { ghostLoader } from './lib/ghost/loader';

const claimSourceSchema = z.object({
  claim: z.string().min(1),
  source: z.string().min(1),
  checked: z.string().min(1),
});

const seedSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  date: z.coerce.date(),
  featureImage: z.string().nullable().default(null),
  featureImageAlt: z.string().nullable().default(null),
  featureImageCaption: z.string().nullable().default(null),
  draft: z.boolean().default(false),
  /** Explicit: Content Layer has no reserved `slug` field. */
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be kebab-case'),
  tags: z.array(z.string()).default([]),
  claim_source: z.array(claimSourceSchema).default([]),
});

const seed = defineCollection({
  type: 'content_layer',
  schema: seedSchema,
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/seed',
    generateId: ({ entry, data }) => {
      const segments = entry.replace(/\\/g, '/').split('/').filter(Boolean);
      const seriesSlug = segments[0];
      if (!seriesSlug || segments.length < 2) {
        throw new Error(
          `Seed post "${entry}" must live under src/content/seed/<series-slug>/ (D11/D13).`,
        );
      }
      if (typeof data.slug !== 'string' || !data.slug) {
        throw new Error(`Seed post "${entry}" is missing the required frontmatter field "slug".`);
      }
      return `${seriesSlug}/${data.slug}`;
    },
  }),
});

/**
 * Ghost loader is wired but dormant: no Ghost env vars in v1, so the key is
 * absent from the generated collection map. At cutover the same config picks
 * it up without a page change.
 */
export const collections = {
  seed,
  ...(hasGhostCredentials()
    ? {
        ghost: defineCollection({ type: 'content_layer', loader: ghostLoader() }),
      }
    : {}),
};
