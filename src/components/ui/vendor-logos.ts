/**
 * Monochrome vendor marks (Simple Icons, CC0) in public/brand/, shipped black
 * and recoloured by `.chip-logo` in global.css so they stay greyscale in both
 * themes. Only names with an official mark appear here; everything else
 * renders as a plain text chip.
 */
/**
 * APPROXIMATION, not official art: Simple Icons ships no monday.com mark, so
 * this is a generic three-dot glyph (rising row of dots, nodding at the brand's
 * dot motif) drawn here. Black fill so `.chip-logo` greys it like the others.
 */
const MONDAY_APPROXIMATION =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='5' cy='16' r='3.5'/%3E%3Ccircle cx='12' cy='11' r='3.5'/%3E%3Ccircle cx='19' cy='16' r='3.5'/%3E%3C/svg%3E";

const VENDOR_LOGOS: Readonly<Record<string, string>> = {
  stripe: '/brand/stripe.svg',
  'stripe connect': '/brand/stripe.svg',
  livekit: '/brand/livekit.svg',
  'next.js': '/brand/nextjs.svg',
  django: '/brand/django.svg',
  'monday.com': MONDAY_APPROXIMATION,
  monday: MONDAY_APPROXIMATION,
};

export function vendorLogo(name: string): string | undefined {
  return VENDOR_LOGOS[name.trim().toLowerCase()];
}
