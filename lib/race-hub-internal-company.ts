import { prisma } from "@/lib/prisma";

/**
 * Resolve active race_registry for GoFastCompany races.id (companyRaceId).
 * Same lookup intent as public resolve-by-company-race, with id fallback like race-registry/update.
 */
export async function resolveActiveRaceByCompanyRaceId(companyRaceId: string) {
  const id = companyRaceId.trim();
  let race = await prisma.race_registry.findFirst({
    where: {
      companyRaceId: id,
      parentRaceId: null,
      isActive: true,
      isCancelled: false,
    },
  });
  if (!race) {
    race = await prisma.race_registry.findFirst({
      where: {
        id,
        isActive: true,
        isCancelled: false,
      },
    });
  }
  return race;
}
