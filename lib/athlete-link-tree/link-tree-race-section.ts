import type { AthleteLinkTreeLink } from "@/lib/content/athlete-link-tree-types";

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
  const under = linksUnderSection(sortedLinks, sectionId);
  if (under.length > 0) return under[under.length - 1]!.id;
  return sectionId;
}

export function linkIdForAthleteRace(
  sortedLinks: AthleteLinkTreeLink[],
  athleteRaceId: string,
): string | null {
  const hit = sortedLinks.find((l) => l.athleteRaceId === athleteRaceId);
  return hit?.id ?? null;
}
