/**
 * Goal race canon — one explicit primary athlete_races row per athlete.
 * Independent of GoFast plan; plan creation snaps primary to terminal race.
 */

import { prisma } from "@/lib/prisma";
import { TrainingPlanLifecycle } from "@prisma/client";

export type AthleteRaceContext = {
  primaryAthleteRaceId: string | null;
  planAthleteRaceId: string | null;
  activePlanId: string | null;
};

export async function getAthleteRaceContext(athleteId: string): Promise<AthleteRaceContext> {
  const [primaryRow, activePlan] = await Promise.all([
    prisma.athlete_races.findFirst({
      where: { athleteId, isPrimaryRace: true },
      select: { id: true },
    }),
    prisma.training_plans.findFirst({
      where: { athleteId, lifecycleStatus: TrainingPlanLifecycle.ACTIVE },
      orderBy: { updatedAt: "desc" },
      select: { id: true, athleteRaceId: true },
    }),
  ]);

  return {
    primaryAthleteRaceId: primaryRow?.id ?? null,
    planAthleteRaceId: activePlan?.athleteRaceId ?? null,
    activePlanId: activePlan?.id ?? null,
  };
}

/** Mark one row as the athlete's Goal race; clears any previous primary. */
export async function setPrimaryAthleteRace(params: {
  athleteId: string;
  athleteRaceId: string;
}) {
  const row = await prisma.athlete_races.findFirst({
    where: { id: params.athleteRaceId, athleteId: params.athleteId },
    select: { id: true },
  });
  if (!row) {
    throw new Error("Athlete race not found");
  }

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await tx.athlete_races.updateMany({
      where: { athleteId: params.athleteId, isPrimaryRace: true },
      data: { isPrimaryRace: false, updatedAt: now },
    });
    return tx.athlete_races.update({
      where: { id: params.athleteRaceId },
      data: { isPrimaryRace: true, updatedAt: now },
    });
  });
}

/** Clear Goal race flag without removing participation or goal time. */
export async function clearPrimaryAthleteRace(params: {
  athleteId: string;
  athleteRaceId: string;
}) {
  const row = await prisma.athlete_races.findFirst({
    where: {
      id: params.athleteRaceId,
      athleteId: params.athleteId,
      isPrimaryRace: true,
    },
    select: { id: true },
  });
  if (!row) {
    throw new Error("Not the current Goal race");
  }

  return prisma.athlete_races.update({
    where: { id: params.athleteRaceId },
    data: { isPrimaryRace: false, updatedAt: new Date() },
  });
}

/** After plan create/replace/reactivate — snap primary to terminal race. */
export async function snapPrimaryRaceToPlanTerminal(params: {
  athleteId: string;
  athleteRaceId: string;
}) {
  return setPrimaryAthleteRace(params);
}

export async function findPrimaryAthleteRaceRow(athleteId: string) {
  return prisma.athlete_races.findFirst({
    where: { athleteId, isPrimaryRace: true },
    orderBy: { raceDate: "asc" },
  });
}
