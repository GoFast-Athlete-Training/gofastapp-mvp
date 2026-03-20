import { prisma } from "@/lib/prisma";
import {
  RACE_DISTANCES_MILES,
  distanceMilesToPaceRaceKey,
  parseRaceTimeToSeconds,
  raceTimeToGoalPaceSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";

const MILES_5K = RACE_DISTANCES_MILES["5k"];

/** Normalize stored distance string to pace-calculator key */
export function normalizeDistanceForPace(
  distance: string,
  distanceMiles?: number | null
): string {
  const d = distance.toLowerCase().trim().replace(/\s+/g, "");
  if (d === "halfmarathon" || d === "half") return "half";
  if (d === "10k" || d === "10km") return "10k";
  if (d === "5k" || d === "5km") return "5k";
  if (d === "marathon" || d === "full" || d === "mara") return "marathon";
  if (d === "mile" || d === "1mile" || d === "1mi") return "mile";
  if (d === "ultra") {
    return "ultra";
  }
  if (RACE_DISTANCES_MILES[distance.toLowerCase().trim()]) {
    return distance.toLowerCase().trim();
  }
  if (distanceMiles != null) {
    return distanceMilesToPaceRaceKey(distanceMiles);
  }
  return "5k";
}

/**
 * Riegel-style equivalent 5K time at same fitness, then average pace (sec/mile) for 5K.
 */
export function equivalent5KPaceSecondsPerMile(
  raceTimeSeconds: number,
  eventMiles: number
): number {
  const t5kSec = raceTimeSeconds * Math.pow(MILES_5K / eventMiles, 1.06);
  return Math.max(1, Math.round(t5kSec / MILES_5K));
}

export function deriveGoalPaces(params: {
  distance: string;
  goalTime: string | null | undefined;
  distanceMiles?: number | null;
}): { goalRacePace: number | null; goalPace5K: number | null } {
  if (!params.goalTime?.trim()) {
    return { goalRacePace: null, goalPace5K: null };
  }

  const paceKey = normalizeDistanceForPace(params.distance, params.distanceMiles);
  const totalSeconds = parseRaceTimeToSeconds(params.goalTime.trim());

  let goalRacePace: number;
  let eventMiles: number;

  if (RACE_DISTANCES_MILES[paceKey] != null) {
    eventMiles = RACE_DISTANCES_MILES[paceKey];
    goalRacePace = raceTimeToGoalPaceSecondsPerMile(totalSeconds, paceKey);
  } else if (params.distanceMiles != null && params.distanceMiles > 0) {
    eventMiles = params.distanceMiles;
    goalRacePace = Math.round(totalSeconds / params.distanceMiles);
  } else {
    throw new Error(
      `Cannot derive pace for distance "${params.distance}" without distanceMiles`
    );
  }

  const goalPace5K =
    paceKey === "5k" ? goalRacePace : equivalent5KPaceSecondsPerMile(totalSeconds, eventMiles);

  return { goalRacePace, goalPace5K };
}

export async function getActiveGoals(athleteId: string) {
  return prisma.athleteGoal.findMany({
    where: { athleteId, status: "ACTIVE" },
    orderBy: { targetByDate: "asc" },
    include: {
      race_registry: {
        select: {
          id: true,
          name: true,
          raceType: true,
          distanceMiles: true,
          raceDate: true,
          city: true,
          state: true,
        },
      },
    },
  });
}

/**
 * First ACTIVE goal by targetByDate. Lazily computes and persists goalRacePace/goalPace5K when missing.
 */
export async function getPrimaryGoalForWorkout(athleteId: string) {
  const goals = await prisma.athleteGoal.findMany({
    where: { athleteId, status: "ACTIVE" },
    orderBy: { targetByDate: "asc" },
    take: 1,
    include: {
      race_registry: { select: { distanceMiles: true } },
    },
  });

  const g = goals[0];
  if (!g) return null;

  if (
    g.goalTime?.trim() &&
    (g.goalRacePace == null || g.goalPace5K == null)
  ) {
    try {
      const { goalRacePace, goalPace5K } = deriveGoalPaces({
        distance: g.distance,
        goalTime: g.goalTime,
        distanceMiles: g.race_registry?.distanceMiles ?? null,
      });
      if (goalRacePace != null && goalPace5K != null) {
        return prisma.athleteGoal.update({
          where: { id: g.id },
          data: { goalRacePace, goalPace5K, updatedAt: new Date() },
        });
      }
    } catch {
      /* keep nulls */
    }
  }

  return g;
}

export type CreateGoalInput = {
  distance: string;
  goalTime?: string | null;
  targetByDate: Date;
  raceRegistryId?: string | null;
  status?: string;
};

export async function createGoal(athleteId: string, input: CreateGoalInput) {
  let targetByDate = input.targetByDate;
  let distance = input.distance.trim();
  let distanceMiles: number | null = null;

  if (input.raceRegistryId) {
    const race = await prisma.race_registry.findUnique({
      where: { id: input.raceRegistryId },
      select: { raceDate: true, distanceMiles: true, raceType: true },
    });
    if (race) {
      distanceMiles = race.distanceMiles;
      if (!distance) {
        distance = race.raceType?.trim() || distanceMilesToPaceRaceKey(race.distanceMiles);
      }
      targetByDate = race.raceDate;
    }
  }

  if (!distance) {
    throw new Error("distance is required (or attach raceRegistryId with raceType)");
  }

  const { goalRacePace, goalPace5K } = deriveGoalPaces({
    distance,
    goalTime: input.goalTime,
    distanceMiles,
  });

  return prisma.athleteGoal.create({
    data: {
      athleteId,
      distance,
      goalTime: input.goalTime?.trim() || null,
      goalRacePace,
      goalPace5K,
      targetByDate,
      raceRegistryId: input.raceRegistryId ?? null,
      status: input.status ?? "ACTIVE",
      updatedAt: new Date(),
    },
    include: {
      race_registry: {
        select: {
          id: true,
          name: true,
          raceType: true,
          distanceMiles: true,
          raceDate: true,
          city: true,
          state: true,
        },
      },
    },
  });
}

export type UpdateGoalInput = Partial<{
  distance: string;
  goalTime: string | null;
  targetByDate: Date;
  raceRegistryId: string | null;
  status: string;
}>;

export async function updateGoal(
  goalId: string,
  athleteId: string,
  patch: UpdateGoalInput
) {
  const existing = await prisma.athleteGoal.findFirst({
    where: { id: goalId, athleteId },
    include: { race_registry: { select: { distanceMiles: true, raceDate: true, raceType: true } } },
  });
  if (!existing) return null;

  const distance = patch.distance ?? existing.distance;
  const goalTime =
    patch.goalTime !== undefined ? patch.goalTime : existing.goalTime;
  let distanceMiles = existing.race_registry?.distanceMiles ?? null;

  if (patch.raceRegistryId !== undefined) {
    if (patch.raceRegistryId) {
      const race = await prisma.race_registry.findUnique({
        where: { id: patch.raceRegistryId },
        select: { distanceMiles: true, raceDate: true },
      });
      distanceMiles = race?.distanceMiles ?? null;
    } else {
      distanceMiles = null;
    }
  }

  const { goalRacePace, goalPace5K } = deriveGoalPaces({
    distance,
    goalTime,
    distanceMiles,
  });

  return prisma.athleteGoal.update({
    where: { id: goalId },
    data: {
      ...(patch.distance !== undefined && { distance: patch.distance }),
      ...(patch.goalTime !== undefined && { goalTime: patch.goalTime?.trim() || null }),
      ...(patch.targetByDate !== undefined && { targetByDate: patch.targetByDate }),
      ...(patch.raceRegistryId !== undefined && {
        raceRegistryId: patch.raceRegistryId,
      }),
      ...(patch.status !== undefined && { status: patch.status }),
      goalRacePace,
      goalPace5K,
      updatedAt: new Date(),
    },
    include: {
      race_registry: {
        select: {
          id: true,
          name: true,
          raceType: true,
          distanceMiles: true,
          raceDate: true,
          city: true,
          state: true,
        },
      },
    },
  });
}
