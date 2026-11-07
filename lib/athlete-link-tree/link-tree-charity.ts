import type { AthleteLinkTreeLink } from "@/lib/content/athlete-link-tree-types";

/** Stable marker in `internalDescription` for charity links from race_registry search. */
export const LINK_TREE_CHARITY_TAG_PREFIX = "linktree:raceRegistryCharity:";

export function charityLinkInternalDescription(raceRegistryId: string): string {
  return `${LINK_TREE_CHARITY_TAG_PREFIX}${raceRegistryId.trim()}`;
}

export function linkIdForCharityRaceRegistry(
  sortedLinks: AthleteLinkTreeLink[],
  raceRegistryId: string,
): string | null {
  const tag = charityLinkInternalDescription(raceRegistryId);
  const hit = sortedLinks.find((l) => !l.isSection && l.internalDescription?.trim() === tag);
  return hit?.id ?? null;
}

export function linkIdForAthleteCause(
  sortedLinks: AthleteLinkTreeLink[],
  athleteCauseId: string,
): string | null {
  const hit = sortedLinks.find((l) => !l.isSection && l.athleteCauseId === athleteCauseId);
  return hit?.id ?? null;
}
