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
  /**
   * Provenance kind (review pass 1): a link, a repo document, or an owner
   * confirmation with no external artifact behind it. Optional so existing
   * ledgers stay valid.
   */
  source_type: z.enum(['url', 'document', 'owner-confirmation']).optional(),
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
 * Case studies are static MDX (plan §4 Phase 4.3). This collection is
 * deliberately separate from the Ghost-shaped `seed` collection: case-study
 * copy ships with the site, while blog content can cut over to Ghost without
 * touching `/work`.
 */
const workStackEntrySchema = z.object({
  name: z.string().min(1),
  artifact: z.string().min(1),
  /** D-C: ledger-only stack names never render in the UI. */
  hidden: z.boolean().default(false),
});

const workChapterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
});

const workSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be kebab-case'),
  date: z.coerce.date(),
  role: z.string().min(1),
  period: z.string().min(1),
  brand: z.enum(['rolltrack', 'saha', 'kokoro']),
  logo: z.string().min(1),
  logoAlt: z.string().min(1),
  order: z.number().int().default(0),
  draft: z.boolean().default(false),
  chapters: z.array(workChapterSchema).default([]),
  stack: z.array(workStackEntrySchema).default([]),
  claim_source: z.array(claimSourceSchema).default([]),
});

const work = defineCollection({
  type: 'content_layer',
  schema: workSchema,
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/work',
  }),
});

/**
 * Ghost loader is wired but dormant: no Ghost env vars in v1, so the key is
 * absent from the generated collection map. At cutover the same config picks
 * it up without a page change.
 */
export const collections = {
  seed,
  work,
  ...(hasGhostCredentials()
    ? {
        ghost: defineCollection({ type: 'content_layer', loader: ghostLoader() }),
      }
    : {}),
};
