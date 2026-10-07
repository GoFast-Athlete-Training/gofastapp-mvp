/** Match Content slugifyBioLinkTreeHandle for gofastHandle → public slug. */
export function athleteLinkTreeSlugFromHandle(handle: string): string {
  return handle
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidAthleteLinkTreeSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 2 && slug.length <= 64;
}
