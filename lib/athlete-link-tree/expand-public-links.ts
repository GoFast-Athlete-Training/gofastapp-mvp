import type { AthleteLinkTreeLink } from "@/lib/content/athlete-link-tree-types";
import type { PublicAthleteLinkTreePayload } from "@/lib/athlete-link-tree/public-payload";
import { isHydratedLinkKind } from "@/lib/athlete-link-tree/link-kinds";
import { AthleteLinkTreeLinkKind } from "@prisma/client";

type PublicLink = PublicAthleteLinkTreePayload["links"][number];

function toPublicCustomLink(link: AthleteLinkTreeLink & { kind: AthleteLinkTreeLinkKind }): PublicLink {
  return {
    id: link.id,
    name: link.name,
    publicLabel: link.publicLabel,
    isSection: link.isSection,
    description: link.description,
    linkLogoUrl: link.linkLogoUrl,
    emoji: link.emoji,
    url: link.url,
    targetSlug: null,
    sortOrder: link.sortOrder,
  };
}

/** Flatten stored rows into public buttons (legacy RACES rows are omitted). */
export async function expandAthleteLinkTreeLinksForPublic(input: {
  athleteId: string;
  links: Array<AthleteLinkTreeLink & { kind: AthleteLinkTreeLinkKind }>;
}): Promise<PublicLink[]> {
  const sorted = input.links.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const out: PublicLink[] = [];

  for (const link of sorted) {
    if (isHydratedLinkKind(link.kind) && !link.isSection) {
      continue;
    }
    out.push(toPublicCustomLink(link));
  }

  return out;
}
