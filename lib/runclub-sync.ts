import { prisma } from "./prisma";

/** Local run club by slug. Prod does not pull club rows from Company. */
export async function findLocalRunClubBySlug(slug: string) {
  const trimmed = slug.trim();
  if (!trimmed) return null;
  return prisma.run_clubs.findUnique({ where: { slug: trimmed } });
}
