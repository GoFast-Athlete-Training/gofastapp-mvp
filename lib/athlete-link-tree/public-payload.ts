import { expandAthleteLinkTreeLinksForPublic } from "@/lib/athlete-link-tree/expand-public-links";
import type { AthleteLinkTreeDetail } from "@/lib/content/athlete-link-tree-types";

/** Public gofastlinks athlete page shape (matches gofast-contentpublic fetch-bio-linktree). */
export type PublicAthleteLinkTreePayload = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  avatarUrl: string | null;
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

export type AthleteLinkTreePublicProfileSnap = {
  firstName: string | null;
  lastName: string | null;
  photoURL: string | null;
};

const TREE_FALLBACK_DISPLAY_NAME = "GoFast Runner";

export function athleteLinkTreeDisplayName(
  athlete: AthleteLinkTreePublicProfileSnap | null | undefined,
): string {
  const parts = [athlete?.firstName?.trim(), athlete?.lastName?.trim()].filter(Boolean);
  return parts.join(" ") || TREE_FALLBACK_DISPLAY_NAME;
}

export async function toPublicAthleteLinkTreePayload(
  tree: AthleteLinkTreeDetail,
  athleteId: string,
  athlete?: AthleteLinkTreePublicProfileSnap | null,
): Promise<PublicAthleteLinkTreePayload> {
  const links = await expandAthleteLinkTreeLinksForPublic({
    athleteId,
    links: tree.links,
  });

  const displayName = athleteLinkTreeDisplayName(athlete);
  const logo = tree.logoUrl?.trim() || null;
  const avatar = logo || athlete?.photoURL?.trim() || null;

  return {
    id: tree.id,
    name: displayName,
    slug: tree.slug,
    logoUrl: tree.logoUrl,
    avatarUrl: avatar,
    publicLabel: tree.publicLabel?.trim() || null,
    publicDescription: tree.publicDescription?.trim() || null,
    isRoot: false,
    links,
  };
}
