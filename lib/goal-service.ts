import { prisma } from "@/lib/prisma";
import { MOTIVATION_ICON_SLUGS } from "@/lib/goals-motivation-icons";
import { distanceMilesToPaceRaceKey } from "@/lib/workout-generator/pace-calculator";
import { deriveGoalPaces } from "@/lib/pace-utils";

export { deriveGoalPaces } from "@/lib/pace-utils";

const MOTIVATION_ICON_SET = new Set<string>(MOTIVATION_ICON_SLUGS);

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
  name?: string | null;
  description?: string | null;
  distance: string;
  goalTime?: string | null;
  targetByDate: Date;
  raceRegistryId?: string | null;
  status?: string;
  whyGoal?: string | null;
  successLooksLike?: string | null;
  completionFeeling?: string | null;
  motivationIcon?: string | null;
};

export async function createGoal(athleteId: string, input: CreateGoalInput) {
  await prisma.athleteGoal.updateMany({
    where: { athleteId, status: "ACTIVE" },
    data: { status: "ARCHIVED", updatedAt: new Date() },
  });

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
    distance = "";
  }

  const { goalRacePace, goalPace5K } = deriveGoalPaces({
    distance,
    goalTime: input.goalTime,
    distanceMiles,
  });

  const nameTrimmed = input.name?.trim() ? input.name!.trim() : null;
  const description = trimText(input.description);
  const whyGoal = trimText(input.whyGoal);
  const successLooksLike = trimText(input.successLooksLike);
  const completionFeeling = trimText(input.completionFeeling);
  const motivationIcon = normalizeMotivationIcon(input.motivationIcon);

  return prisma.athleteGoal.create({
    data: {
      athleteId,
      name: nameTrimmed,
      description,
      distance,
      goalTime: input.goalTime?.trim() || null,
      goalRacePace,
      goalPace5K,
      targetByDate,
      raceRegistryId: input.raceRegistryId ?? null,
      status: input.status ?? "ACTIVE",
      whyGoal,
      successLooksLike,
      completionFeeling,
      motivationIcon,
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
  name: string | null;
  description: string | null;
  distance: string;
  goalTime: string | null;
  targetByDate: Date;
  raceRegistryId: string | null;
  status: string;
  whyGoal: string | null;
  successLooksLike: string | null;
  completionFeeling: string | null;
  motivationIcon: string | null;
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
      ...(patch.name !== undefined && {
        name: patch.name?.trim() ? patch.name.trim() : null,
      }),
      ...(patch.description !== undefined && {
        description: trimText(patch.description),
      }),
      ...(patch.distance !== undefined && { distance: patch.distance }),
      ...(patch.goalTime !== undefined && { goalTime: patch.goalTime?.trim() || null }),
      ...(patch.targetByDate !== undefined && { targetByDate: patch.targetByDate }),
      ...(patch.raceRegistryId !== undefined && {
        raceRegistryId: patch.raceRegistryId,
      }),
      ...(patch.status !== undefined && { status: patch.status }),
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
