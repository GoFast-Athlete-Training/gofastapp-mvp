export type AthleteCompanyRecord = {
  id: string;
  athleteId: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
};

export type PublicAthleteCompany = {
  name: string;
  slug: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
};

/** Slugify company name for optional public key (not GWM handle). */
export function slugifyAthleteCompanyName(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || 'company';
}

export function toPublicAthleteCompany(
  row: AthleteCompanyRecord | null | undefined
): PublicAthleteCompany | null {
  if (!row?.name?.trim()) return null;
  return {
    name: row.name.trim(),
    slug: row.slug,
    logoUrl: row.logoUrl?.trim() || null,
    websiteUrl: row.websiteUrl?.trim() || null,
  };
}
