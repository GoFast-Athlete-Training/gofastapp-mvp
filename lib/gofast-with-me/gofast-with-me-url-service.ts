/** Normalize handle/slug for public URL lookup (matches load-public-athlete-page). */
export function normalizeGoFastWithMeSlug(raw: string): string {
  let h = (raw || '').trim().toLowerCase();
  if (h.startsWith('@')) h = h.slice(1);
  return h.replace(/[^a-z0-9_]/g, '');
}

export function buildGoFastWithMeUrl(slug: string, baseUrl?: string): string {
  const normalized = normalizeGoFastWithMeSlug(slug);
  const origin =
    baseUrl?.replace(/\/$/, '') ||
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_APP_URL : undefined) ||
    '';
  return origin ? `${origin}/u/${normalized}` : `/u/${normalized}`;
}
