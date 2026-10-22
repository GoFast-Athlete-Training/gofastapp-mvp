import prisma from "@/lib/prisma";
import { cityRunPublicCardUrl } from "@/lib/city-run-public-card-url";

/** Fix stored link-tree URLs to canonical public run detail (dcruns / Pulse). */
export async function rewriteCityRunLinkTreeUrls(athleteId: string): Promise<void> {
  const tree = await prisma.athlete_link_trees.findUnique({
    where: { athleteId },
    select: { id: true },
  });
  if (!tree) return;

  const links = await prisma.athlete_link_tree_links.findMany({
    where: {
      treeId: tree.id,
      cityRunId: { not: null },
    },
    select: {
      id: true,
      url: true,
      cityRunId: true,
      city_run: {
        select: {
          slug: true,
          citySlug: true,
          id: true,
          cityRunType: true,
          runClub: { select: { slug: true } },
        },
      },
    },
  });

  for (const link of links) {
    const run = link.city_run;
    if (!run) continue;
    const publicKey = run.slug?.trim() || run.id;
    const next = cityRunPublicCardUrl(
      publicKey,
      run.citySlug,
      run.id,
      run.cityRunType,
      run.runClub?.slug ?? null,
    );
    if (link.url?.trim() === next) continue;
    await prisma.athlete_link_tree_links.update({
      where: { id: link.id },
      data: { url: next },
    });
  }
}
