/**
 * Derive a URL-safe kebab-case slug from a display name for `workout_catalogue.slug`.
 */
export function generateCatalogueSlug(name: string): string {
  const t = name
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return t.length > 0 ? t : "workout";
}
