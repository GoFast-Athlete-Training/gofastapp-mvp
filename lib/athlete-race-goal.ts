/**
 * Goal lives on athlete_races — every claimed race carries its goal.
 */

import { prisma } from "@/lib/prisma";
import { goalAthleteRaceSelect } from "@/lib/goal-race-display";
import {
  deriveGoalPaces,
  metersToMiles,
  normalizeDistanceForPace,
} from "@/lib/pace-utils";
import { MOTIVATION_ICON_SLUGS } from "@/lib/goals-motivation-icons";
import { claimAthleteRace, findAthleteRaceByRegistry } from "@/lib/athlete-races-service";

const MOTIVATION_ICON_SET = new Set<string>(MOTIVATION_ICON_SLUGS);

export const athleteRaceGoalSelect = {
  ...goalAthleteRaceSelect,
  athleteId: true,
  isPrimaryRace: true,
  goalName: true,
  goalDescription: true,
  goalDistance: true,
  goalTime: true,
  goalRacePace: true,
  goalPace5K: true,
  whyGoal: true,
  successLooksLike: true,
  completionFeeling: true,
  motivationIcon: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type AthleteRaceGoalRow = {
  id: string;
  athleteId: string;
  raceRegistryId: string;
  name: string;
  raceDate: Date;
  distanceMeters: number | null;
  distanceLabel: string | null;
  city: string | null;
  state: string | null;
  slug: string | null;
  logoUrl: string | null;
  goalName: string | null;
  goalDescription: string | null;
  goalDistance: string | null;
  goalTime: string | null;
  goalRacePace: number | null;
  goalPace5K: number | null;
  whyGoal: string | null;
  successLooksLike: string | null;
  completionFeeling: string | null;
  motivationIcon: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function normalizeMotivationIcon(raw: string | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  const s = raw.trim().toLowerCase();
  return MOTIVATION_ICON_SET.has(s) ? s : null;
}

function trimText(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  return t === "" ? null : t;
}

/** API compatibility: shape athlete_races row as legacy AthleteGoal. */
export function serializeGoalFromAthleteRace(row: AthleteRaceGoalRow) {
  const athleteRace = {
    id: row.id,
    raceRegistryId: row.raceRegistryId,
    name: row.name,
    raceDate: row.raceDate,
    distanceMeters: row.distanceMeters,
    distanceLabel: row.distanceLabel,
    city: row.city,
    state: row.state,
    slug: row.slug,
    logoUrl: row.logoUrl,
  };

  return {
    id: row.id,
    athleteId: row.athleteId,
    name: row.goalName,
    description: row.goalDescription,
    distance: row.goalDistance ?? "",
    goalTime: row.goalTime,
    goalRacePace: row.goalRacePace,
    goalPace5K: row.goalPace5K,
    targetByDate: row.raceDate,
    athleteRaceId: row.id,
    status: "ACTIVE",
    whyGoal: row.whyGoal,
    successLooksLike: row.successLooksLike,
    completionFeeling: row.completionFeeling,
    motivationIcon: row.motivationIcon,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    athlete_race: athleteRace,
  };
}

export async function listAthleteRaceGoals(athleteId: string) {
  const [rows, activePlan] = await Promise.all([
    prisma.athlete_races.findMany({
      where: {
        athleteId,
        OR: [
          { goalTime: { not: null } },
          { goalDistance: { not: null } },
          { goalName: { not: null } },
        ],
      },
      select: athleteRaceGoalSelect,
      orderBy: { raceDate: "asc" },
    }),
    prisma.training_plans.findFirst({
      where: { athleteId, lifecycleStatus: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      select: { athleteRaceId: true },
    }),
  ]);

  const planRaceId = activePlan?.athleteRaceId ?? null;
  const sorted = [...rows].sort((a, b) => {
    const aPlan = planRaceId && a.id === planRaceId ? 0 : 1;
    const bPlan = planRaceId && b.id === planRaceId ? 0 : 1;
    if (aPlan !== bPlan) return aPlan - bPlan;
    const aPrimary = a.isPrimaryRace ? 0 : 1;
    const bPrimary = b.isPrimaryRace ? 0 : 1;
    if (aPrimary !== bPrimary) return aPrimary - bPrimary;
    return a.raceDate.getTime() - b.raceDate.getTime();
  });

  return sorted.map((r) => serializeGoalFromAthleteRace(r));
}

export async function getAthleteRaceGoalById(athleteId: string, athleteRaceId: string) {
  const row = await prisma.athlete_races.findFirst({
    where: { id: athleteRaceId, athleteId },
    select: athleteRaceGoalSelect,
  });
  return row ? serializeGoalFromAthleteRace(row) : null;
}

/** Primary Goal race: ACTIVE plan terminal, else explicit isPrimaryRace. */
export async function getPrimaryAthleteRaceForAthlete(athleteId: string) {
  const [primaryRow, activePlan] = await Promise.all([
    prisma.athlete_races.findFirst({
      where: { athleteId, isPrimaryRace: true },
      select: athleteRaceGoalSelect,
    }),
    prisma.training_plans.findFirst({
      where: { athleteId, lifecycleStatus: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      select: { athleteRaceId: true },
    }),
  ]);

  if (activePlan?.athleteRaceId) {
    const planRace = await prisma.athlete_races.findFirst({
      where: { id: activePlan.athleteRaceId, athleteId },
      select: athleteRaceGoalSelect,
    });
    if (planRace) return planRace;
  }

  if (primaryRow) return primaryRow;

  return null;
}

export async function getPrimaryGoalForWorkout(athleteId: string) {
  const row = await getPrimaryAthleteRaceForAthlete(athleteId);
  if (!row) return null;

  if (
    row.goalTime?.trim() &&
    (row.goalRacePace == null || row.goalPace5K == null)
  ) {
    try {
      const distanceMiles =
        row.distanceMeters != null ? metersToMiles(row.distanceMeters) : null;
      const distance =
        row.goalDistance?.trim() ||
        normalizeDistanceForPace(row.distanceLabel?.trim() ?? "", distanceMiles);
      const { goalRacePace, goalPace5K } = deriveGoalPaces({
        distance,
        goalTime: row.goalTime,
        distanceMiles,
      });
      if (goalRacePace != null && goalPace5K != null) {
        const updated = await prisma.athlete_races.update({
          where: { id: row.id },
          data: { goalRacePace, goalPace5K, updatedAt: new Date() },
          select: athleteRaceGoalSelect,
        });
        return serializeGoalFromAthleteRace(updated);
      }
    } catch {
      /* keep nulls */
    }
  }

  return serializeGoalFromAthleteRace(row);
}

export type UpsertRaceGoalInput = {
  name?: string | null;
  description?: string | null;
  distance?: string;
  goalTime?: string | null;
  raceRegistryId?: string | null;
  athleteRaceId?: string | null;
  whyGoal?: string | null;
  successLooksLike?: string | null;
  completionFeeling?: string | null;
  motivationIcon?: string | null;
};

async function resolveAthleteRaceForGoal(
  athleteId: string,
  input: Pick<UpsertRaceGoalInput, "athleteRaceId" | "raceRegistryId">
) {
  if (input.athleteRaceId) {
    const row = await prisma.athlete_races.findFirst({
      where: { id: input.athleteRaceId, athleteId },
      select: athleteRaceGoalSelect,
    });
    if (!row) throw new Error("Athlete race not found");
    return row;
  }
  if (input.raceRegistryId) {
    const existing = await findAthleteRaceByRegistry({
      athleteId,
      raceRegistryId: input.raceRegistryId,
    });
    if (existing) {
      return prisma.athlete_races.findUniqueOrThrow({
        where: { id: existing.id },
        select: athleteRaceGoalSelect,
      });
    }
    const claimed = await claimAthleteRace({
      athleteId,
      raceRegistryId: input.raceRegistryId,
    });
    return prisma.athlete_races.findUniqueOrThrow({
      where: { id: claimed.id },
      select: athleteRaceGoalSelect,
    });
  }
  throw new Error("athleteRaceId or raceRegistryId is required");
}

export async function createRaceGoal(athleteId: string, input: UpsertRaceGoalInput) {
  const athleteRace = await resolveAthleteRaceForGoal(athleteId, input);
  return updateRaceGoal(athleteRace.id, athleteId, input);
}

export async function updateRaceGoal(
  athleteRaceId: string,
  athleteId: string,
  patch: UpsertRaceGoalInput
) {
  const existing = await prisma.athlete_races.findFirst({
    where: { id: athleteRaceId, athleteId },
    select: athleteRaceGoalSelect,
  });
  if (!existing) return null;

  let row = existing;
  if (patch.raceRegistryId && patch.raceRegistryId !== existing.raceRegistryId) {
    row = await resolveAthleteRaceForGoal(athleteId, {
      raceRegistryId: patch.raceRegistryId,
    });
    athleteRaceId = row.id;
  }

  const distanceMiles =
    row.distanceMeters != null ? metersToMiles(row.distanceMeters) : null;
  let goalDistance =
    patch.distance !== undefined ? patch.distance.trim() : row.goalDistance?.trim() ?? "";
  if (!goalDistance) {
    goalDistance = normalizeDistanceForPace(
      row.distanceLabel?.trim() ?? "",
      distanceMiles
    );
  }

  const goalTime =
    patch.goalTime !== undefined ? patch.goalTime : row.goalTime;

  const { goalRacePace, goalPace5K } = deriveGoalPaces({
    distance: goalDistance,
    goalTime,
    distanceMiles,
  });

  const updated = await prisma.athlete_races.update({
    where: { id: athleteRaceId },
    data: {
      ...(patch.name !== undefined && {
        goalName: patch.name?.trim() ? patch.name.trim() : null,
      }),
      ...(patch.description !== undefined && {
        goalDescription: trimText(patch.description),
      }),
      ...(patch.distance !== undefined && { goalDistance: goalDistance || null }),
      ...(patch.goalTime !== undefined && {
        goalTime: patch.goalTime?.trim() || null,
      }),
      ...(patch.whyGoal !== undefined && { whyGoal: trimText(patch.whyGoal) }),
      ...(patch.successLooksLike !== undefined && {
        successLooksLike: trimText(patch.successLooksLike),
      }),
      ...(patch.completionFeeling !== undefined && {
        completionFeeling: trimText(patch.completionFeeling),
      }),
      ...(patch.motivationIcon !== undefined && {
        motivationIcon: normalizeMotivationIcon(patch.motivationIcon),
      }),
      goalRacePace,
      goalPace5K,
      updatedAt: new Date(),
    },
    select: athleteRaceGoalSelect,
  });

  return serializeGoalFromAthleteRace(updated);
}

export async function clearRaceGoal(athleteRaceId: string, athleteId: string) {
  const existing = await prisma.athlete_races.findFirst({
    where: { id: athleteRaceId, athleteId },
    select: { id: true },
  });
  if (!existing) return null;

  const updated = await prisma.athlete_races.update({
    where: { id: athleteRaceId },
    data: {
      goalName: null,
      goalDescription: null,
      goalDistance: null,
      goalTime: null,
      goalRacePace: null,
      goalPace5K: null,
      whyGoal: null,
      successLooksLike: null,
      completionFeeling: null,
      motivationIcon: null,
      updatedAt: new Date(),
    },
    select: athleteRaceGoalSelect,
  });

  return serializeGoalFromAthleteRace(updated);
}
