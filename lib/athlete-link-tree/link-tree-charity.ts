import { normalizeCauseWebsiteUrl } from "@/lib/athlete-causes/cause-url";
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

type CauseUrlRow = { id: string; websiteUrl: string };

/** Match catalog picker row to an on-page cause link (by cause id or normalized URL). */
export function linkIdForCharityPickerHit(
  sortedLinks: AthleteLinkTreeLink[],
  hit: { charityUrl: string; athleteCauseId: string | null },
  savedCauses: CauseUrlRow[],
): string | null {
  const targetUrl = normalizeCauseWebsiteUrl(hit.charityUrl);
  let causeId = hit.athleteCauseId;

  if (!causeId && targetUrl) {
    causeId =
      savedCauses.find((c) => normalizeCauseWebsiteUrl(c.websiteUrl) === targetUrl)?.id ?? null;
  }

  if (causeId) {
    const byCause = linkIdForAthleteCause(sortedLinks, causeId);
    if (byCause) return byCause;
  }

  if (!targetUrl) return null;

  for (const link of sortedLinks) {
    if (link.isSection) continue;
    if (link.athleteCauseId) {
      const cause = savedCauses.find((c) => c.id === link.athleteCauseId);
      if (cause && normalizeCauseWebsiteUrl(cause.websiteUrl) === targetUrl) {
        return link.id;
      }
    }
    const linkUrl = link.url?.trim();
    if (linkUrl && normalizeCauseWebsiteUrl(linkUrl) === targetUrl) {
      return link.id;
    }
  }

  return null;
}
