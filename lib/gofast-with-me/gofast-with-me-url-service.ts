import { runnerPublicLandingUrl } from '@/lib/gofast-with-me/runner-public-url';

/** Normalize handle/slug for public URL lookup (matches load-public-athlete-page). */
export function normalizeGoFastWithMeSlug(raw: string): string {
  let h = (raw || '').trim().toLowerCase();
  if (h.startsWith('@')) h = h.slice(1);
  return h.replace(/[^a-z0-9_]/g, '');
}

export function buildGoFastWithMeUrl(slug: string, baseUrl?: string): string {
  return runnerPublicLandingUrl(slug, baseUrl);
}
