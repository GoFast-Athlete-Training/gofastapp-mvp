import { prisma } from "@/lib/prisma";
import { isRaceRegistryUuid } from "@/lib/race-hub-urls";

const activeWhere = {
  isActive: true,
  isCancelled: false,
} as const;

/** Resolve active race_registry by public slug or registry UUID. */
export async function resolveActiveRaceBySlugOrId(raw: string) {
  const slug = raw?.trim();
  if (!slug) return null;

  if (isRaceRegistryUuid(slug)) {
    const byId = await prisma.race_registry.findFirst({
      where: { id: slug, ...activeWhere },
    });
    if (byId) return byId;
  }

  const exact = await prisma.race_registry.findFirst({
    where: { slug, ...activeWhere },
  });
  if (exact) return exact;

  return prisma.race_registry.findFirst({
    where: {
      slug: { equals: slug, mode: "insensitive" },
      ...activeWhere,
    },
  });
}
