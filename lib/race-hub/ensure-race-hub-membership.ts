import { prisma } from "@/lib/prisma";
import type { RaceMemberRole } from "@prisma/client";

/** Join hub on first write (message, RSVP, etc.) — idempotent. */
export async function ensureRaceHubMembership(
  athleteId: string,
  raceId: string,
  role: RaceMemberRole = "MEMBER",
) {
  return prisma.race_memberships.upsert({
    where: {
      raceId_athleteId: { raceId, athleteId },
    },
    create: {
      raceId,
      athleteId,
      role,
    },
    update: {},
  });
}
