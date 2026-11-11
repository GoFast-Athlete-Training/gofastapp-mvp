import type { AthleteLinkTreeLink } from "@/lib/content/athlete-link-tree-types";

export type LinkTreeSectionBlock = {
  type: "section";
  section: AthleteLinkTreeLink;
  children: AthleteLinkTreeLink[];
};

export type LinkTreeRootLinkBlock = {
  type: "link";
  link: AthleteLinkTreeLink;
};

export type LinkTreeEditorBlock = LinkTreeSectionBlock | LinkTreeRootLinkBlock;

function sortLinks(links: AthleteLinkTreeLink[]): AthleteLinkTreeLink[] {
  return links.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

/** Build nested editor blocks from flat link rows (uses parentSectionId when set). */
export function buildLinkTreeEditorBlocks(links: AthleteLinkTreeLink[]): LinkTreeEditorBlock[] {
  const sorted = sortLinks(links);
  const topLevel = sorted.filter((l) => !l.parentSectionId);
  const childrenBySection = new Map<string, AthleteLinkTreeLink[]>();

  for (const link of sorted) {
    if (!link.parentSectionId) continue;
    const bucket = childrenBySection.get(link.parentSectionId) ?? [];
    bucket.push(link);
    childrenBySection.set(link.parentSectionId, bucket);
  }

  const blocks: LinkTreeEditorBlock[] = [];

  const sectionIds = new Set(topLevel.filter((l) => l.isSection).map((l) => l.id));

  for (const item of topLevel) {
    if (item.isSection) {
      blocks.push({
        type: "section",
        section: item,
        children: sortLinks(childrenBySection.get(item.id) ?? []),
      });
    } else {
      blocks.push({ type: "link", link: item });
    }
  }

  /** Rows with a missing section parent are still in the tree — show them at root so they can be fixed. */
  for (const link of sorted) {
    if (link.isSection || !link.parentSectionId) continue;
    if (sectionIds.has(link.parentSectionId)) continue;
    blocks.push({ type: "link", link });
  }

  return blocks;
}

export type LinkTreeDeleteRow = {
  id: string;
  parentSectionId: string | null;
  isSection: boolean;
};

/** Ids to delete: section heading plus every link with parentSectionId = that section. */
export function linkIdsForAthleteTreeDelete(
  rows: LinkTreeDeleteRow[],
  linkId: string,
  isSection: boolean,
): string[] {
  if (!isSection) return [linkId];
  const childIds = rows.filter((l) => l.parentSectionId === linkId).map((l) => l.id);
  return [linkId, ...childIds];
}

/** Infer parentSectionId for legacy rows without FK (nearest preceding section). */
export function inferParentSectionId(
  link: AthleteLinkTreeLink,
  sortedLinks: AthleteLinkTreeLink[],
): string | null {
  if (link.parentSectionId) return link.parentSectionId;
  if (link.isSection) return null;
  const index = sortedLinks.findIndex((l) => l.id === link.id);
  if (index < 0) return null;
  for (let i = index - 1; i >= 0; i--) {
    const prev = sortedLinks[i]!;
    if (prev.isSection) return prev.id;
  }
  return null;
}
