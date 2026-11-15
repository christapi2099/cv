/**
 * Monochrome vendor marks (Simple Icons, CC0) in public/brand/, shipped black
 * and recoloured by `.chip-logo` in global.css so they stay greyscale in both
 * themes. Only names with an official mark appear here; everything else
 * renders as a plain text chip.
 */
const VENDOR_LOGOS: Readonly<Record<string, string>> = {
  stripe: '/brand/stripe.svg',
  'stripe connect': '/brand/stripe.svg',
  livekit: '/brand/livekit.svg',
  'next.js': '/brand/nextjs.svg',
  django: '/brand/django.svg',
};

export function vendorLogo(name: string): string | undefined {
  return VENDOR_LOGOS[name.trim().toLowerCase()];
}
