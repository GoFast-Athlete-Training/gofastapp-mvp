import { prisma } from "@/lib/prisma";
import { distanceMilesToPaceRaceKey } from "@/lib/workout-generator/pace-calculator";
import { deriveGoalPaces } from "@/lib/pace-utils";

export { deriveGoalPaces } from "@/lib/pace-utils";

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
