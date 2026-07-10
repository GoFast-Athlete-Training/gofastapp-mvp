/** Pure slug helpers for athlete-public training plans. */

export function slugifyPlanSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function appendSlugSuffix(base: string, suffix: string, maxLen = 80): string {
  return `${base}${suffix}`.slice(0, maxLen);
}
