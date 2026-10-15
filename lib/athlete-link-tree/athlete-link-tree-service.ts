import type { AthleteLinkTreeDetail, AthleteLinkTreeLink } from "@/lib/content/athlete-link-tree-types";
import prisma from "@/lib/prisma";
import type { athlete_link_tree_links, athlete_link_trees } from "@prisma/client";

const treeInclude = {
  links: {
    orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Parameters<typeof prisma.athlete_link_trees.findUnique>[0]["include"];

type TreeWithLinks = athlete_link_trees & { links: athlete_link_tree_links[] };

function toLinkRow(link: athlete_link_tree_links): AthleteLinkTreeLink {
  return {
    id: link.id,
    name: link.name,
    publicLabel: link.publicLabel,
    internalDescription: link.internalDescription,
    isSection: link.isSection,
    kind: link.kind,
    description: link.description,
    linkLogoUrl: link.linkLogoUrl,
    emoji: link.emoji,
    url: link.url,
    athleteRaceId: link.athleteRaceId,
    sortOrder: link.sortOrder,
  };
}

export function toAthleteLinkTreeDetail(tree: TreeWithLinks): AthleteLinkTreeDetail {
  return {
    id: tree.id,
    name: tree.name,
    slug: tree.slug,
    logoUrl: tree.logoUrl,
    internalDescription: tree.internalDescription,
    publicLabel: tree.publicLabel,
    publicDescription: tree.publicDescription,
    isRoot: false,
    links: tree.links.map(toLinkRow),
  };
}

export async function findAthleteLinkTreeByAthleteId(athleteId: string): Promise<TreeWithLinks | null> {
  return prisma.athlete_link_trees.findUnique({
    where: { athleteId },
    include: treeInclude,
  });
}

export async function reloadAthleteLinkTreeDetail(athleteId: string): Promise<AthleteLinkTreeDetail | null> {
  const tree = await findAthleteLinkTreeByAthleteId(athleteId);
  return tree ? toAthleteLinkTreeDetail(tree) : null;
}

export async function createAthleteLinkTree(input: {
  athleteId: string;
  slug: string;
  name: string;
  publicLabel?: string | null;
}): Promise<TreeWithLinks> {
  return prisma.athlete_link_trees.create({
    data: {
      athleteId: input.athleteId,
      slug: input.slug,
      name: input.name,
      publicLabel: input.publicLabel?.trim() || input.name,
    },
    include: treeInclude,
  });
}

export async function loadEditableAthleteTree(athleteId: string): Promise<
  | { ok: true; tree: TreeWithLinks }
  | { ok: false; status: number; error: string }
> {
  const tree = await findAthleteLinkTreeByAthleteId(athleteId);
  if (!tree) {
    return { ok: false, status: 404, error: "Link tree not found" };
  }
  return { ok: true, tree };
}
