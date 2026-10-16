import type { AthleteLinkTreeLink } from "@/lib/content/athlete-link-tree-types";
import { normalizeLinkUrlForCompare } from "@/lib/athlete-link-tree/athlete-runner-public-links";

/** Links immediately after a section row until the next section. */
export function linksUnderSection(
  sortedLinks: AthleteLinkTreeLink[],
  sectionId: string,
): AthleteLinkTreeLink[] {
  const index = sortedLinks.findIndex((l) => l.id === sectionId && l.isSection);
  if (index < 0) return [];
  const out: AthleteLinkTreeLink[] = [];
  for (let i = index + 1; i < sortedLinks.length; i++) {
    const link = sortedLinks[i]!;
    if (link.isSection) break;
    out.push(link);
  }
  return out;
}

export function sectionOptions(sortedLinks: AthleteLinkTreeLink[]): Array<{ id: string; label: string }> {
  return sortedLinks
    .filter((l) => l.isSection)
    .map((l) => ({ id: l.id, label: l.name.trim() || "Section" }));
}

/** insertAfterId for appending under a section (last child or the section itself). */
export function insertAfterIdForSection(
  sortedLinks: AthleteLinkTreeLink[],
  sectionId: string,
): string | null {
  const byParent = sortedLinks
    .filter((l) => l.parentSectionId === sectionId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  if (byParent.length > 0) return byParent[byParent.length - 1]!.id;

  const under = linksUnderSection(sortedLinks, sectionId);
  if (under.length > 0) return under[under.length - 1]!.id;
  return sectionId;
}

/** insertAfterId for appending at top level (no section parent). */
export function insertAfterIdForTopLevel(sortedLinks: AthleteLinkTreeLink[]): string | null {
  const top = sortedLinks
    .filter((l) => !l.parentSectionId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  if (top.length === 0) return null;
  return top[top.length - 1]!.id;
}

/** POST body placement for adds from the link picker. */
export function linkInsertPayload(
  sortedLinks: AthleteLinkTreeLink[],
  activeSectionId: string | null,
  base: Record<string, unknown>,
): Record<string, unknown> {
  if (activeSectionId) {
    const insertAfterId = insertAfterIdForSection(sortedLinks, activeSectionId);
    return {
      ...base,
      parentSectionId: activeSectionId,
      sectionId: activeSectionId,
      insertAfterId: insertAfterId ?? undefined,
    };
  }
  const insertAfterId = insertAfterIdForTopLevel(sortedLinks);
  return insertAfterId ? { ...base, insertAfterId } : base;
}

export function linkIdForAthleteRace(
  sortedLinks: AthleteLinkTreeLink[],
  athleteRaceId: string,
): string | null {
  const hit = sortedLinks.find((l) => l.athleteRaceId === athleteRaceId);
  return hit?.id ?? null;
}

export function linkIdForCityRun(
  sortedLinks: AthleteLinkTreeLink[],
  cityRunId: string,
): string | null {
  const hit = sortedLinks.find((l) => l.cityRunId === cityRunId);
  return hit?.id ?? null;
}

export function linkIdForUrl(sortedLinks: AthleteLinkTreeLink[], url: string): string | null {
  const norm = normalizeLinkUrlForCompare(url);
  const hit = sortedLinks.find(
    (l) => !l.isSection && l.url?.trim() && normalizeLinkUrlForCompare(l.url) === norm,
  );
  return hit?.id ?? null;
}
