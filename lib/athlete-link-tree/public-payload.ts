import type { AthleteLinkTreeDetail } from "@/lib/content/athlete-link-tree-types";

/** Public athletelinks shape (matches gofast-contentpublic fetch-bio-linktree). */
export type PublicAthleteLinkTreePayload = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  publicLabel: string | null;
  publicDescription: string | null;
  isRoot: boolean;
  links: Array<{
    id: string;
    name: string;
    publicLabel: string | null;
    isSection: boolean;
    description: string | null;
    linkLogoUrl: string | null;
    emoji: string | null;
    url: string | null;
    targetSlug: string | null;
    sortOrder: number;
  }>;
};

export function toPublicAthleteLinkTreePayload(
  tree: AthleteLinkTreeDetail,
): PublicAthleteLinkTreePayload {
  return {
    id: tree.id,
    name: tree.name,
    slug: tree.slug,
    logoUrl: tree.logoUrl,
    publicLabel: tree.publicLabel?.trim() || null,
    publicDescription: tree.publicDescription?.trim() || null,
    isRoot: false,
    links: tree.links.map((link) => ({
      id: link.id,
      name: link.name,
      publicLabel: link.publicLabel?.trim() || null,
      isSection: link.isSection,
      description: link.description?.trim() || null,
      linkLogoUrl: link.linkLogoUrl,
      emoji: link.emoji,
      url: link.url,
      targetSlug: null,
      sortOrder: link.sortOrder,
    })),
  };
}
