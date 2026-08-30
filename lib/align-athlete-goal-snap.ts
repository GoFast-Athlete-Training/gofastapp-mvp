/**
 * Sole writer of Athlete.goalRaceName + Athlete.goalRaceTime login snap strings.
 * Source of truth for "which race is the goal" is athlete_races.isPrimaryRace.
 */

import { prisma } from "@/lib/prisma";

export async function alignAthleteGoalSnap(athleteId: string): Promise<void> {
  const primary = await prisma.athlete_races.findFirst({
    where: { athleteId, isPrimaryRace: true },
    select: { name: true, goalTime: true },
    orderBy: { raceDate: "asc" },
  });

  await prisma.athlete.update({
    where: { id: athleteId },
    data: {
      goalRaceName: primary?.name?.trim() || null,
      goalRaceTime: primary?.goalTime?.trim() || null,
      updatedAt: new Date(),
    },
  });
}
