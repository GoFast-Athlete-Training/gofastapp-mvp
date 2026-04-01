import { prisma } from "@/lib/prisma";
import type { RaceMemberRole } from "@prisma/client";

export async function requireRaceMembership(athleteId: string, raceRegistryId: string) {
  return prisma.race_memberships.findUnique({
    where: {
      raceId_athleteId: { raceId: raceRegistryId, athleteId },
    },
  });
}

export async function assertRaceAdmin(athleteId: string, raceRegistryId: string) {
  const m = await requireRaceMembership(athleteId, raceRegistryId);
  if (!m || m.role !== "ADMIN") {
    return null;
  }
  return m;
}

/** Upsert membership when athlete declares a race signup (opens chatter). */
export async function upsertRaceMembershipFromSignup(
  athleteId: string,
  raceRegistryId: string,
  role: RaceMemberRole = "MEMBER"
) {
  return prisma.race_memberships.upsert({
    where: {
      raceId_athleteId: { raceId: raceRegistryId, athleteId },
    },
    create: {
      raceId: raceRegistryId,
      athleteId,
      role,
    },
    update: {},
  });
}
