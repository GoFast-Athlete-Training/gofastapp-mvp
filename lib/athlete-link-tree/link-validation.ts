import { isHydratedLinkKind } from "@/lib/athlete-link-tree/link-kinds";
import prisma from "@/lib/prisma";
import { AthleteLinkTreeLinkKind } from "@prisma/client";

export function normalizeLinkDestination(input: {
  url?: string | null;
  kind?: AthleteLinkTreeLinkKind;
}): {
  url: string | null;
  error?: string;
} {
  if (input.kind && isHydratedLinkKind(input.kind)) {
    return { url: null };
  }
  const url = input.url?.trim() || null;
  if (!url) {
    return { url: null, error: "Add a URL" };
  }
  return { url };
}

export async function assertSingleRacesCard(
  treeId: string,
  excludeLinkId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.athlete_link_tree_links.findFirst({
    where: {
      treeId,
      kind: AthleteLinkTreeLinkKind.RACES,
      ...(excludeLinkId ? { id: { not: excludeLinkId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: "This page already has a Races card" };
  }
  return { ok: true };
}
