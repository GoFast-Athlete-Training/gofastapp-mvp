import { syncAthleteProfileSnapshot } from "@/lib/athlete-profile-snapshot";
import { claimAthleteRace, findAthleteRaceByRegistry } from "@/lib/athlete-races-service";
import { prisma } from "@/lib/prisma";
import { MOTIVATION_ICON_SLUGS } from "@/lib/goals-motivation-icons";
import {
  deriveGoalPaces,
  metersToMiles,
  normalizeDistanceForPace,
} from "@/lib/pace-utils";

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
      athlete_race: {
        select: {
          id: true,
          name: true,
          distanceLabel: true,
          distanceMeters: true,
          raceDate: true,
          city: true,
          state: true,
          raceRegistryId: true,
        },
      },
      race_registry: {
        select: {
          id: true,
          name: true,
          distanceLabel: true,
          distanceMeters: true,
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
      athlete_race: { select: { distanceMeters: true } },
      race_registry: { select: { distanceMeters: true } },
    },
  });

  const g = goals[0];
  if (!g) return null;

  if (
    g.goalTime?.trim() &&
    (g.goalRacePace == null || g.goalPace5K == null)
  ) {
    try {
      const regM =
        g.athlete_race?.distanceMeters ??
        g.race_registry?.distanceMeters ??
        null;
      const { goalRacePace, goalPace5K } = deriveGoalPaces({
        distance: g.distance,
        goalTime: g.goalTime,
        distanceMiles: regM != null ? metersToMiles(regM) : null,
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
  athleteRaceId?: string | null;
  status?: string;
  whyGoal?: string | null;
  successLooksLike?: string | null;
  completionFeeling?: string | null;
  motivationIcon?: string | null;
};

async function resolveAthleteRaceForGoal(
  athleteId: string,
  input: Pick<CreateGoalInput, "athleteRaceId" | "raceRegistryId">
) {
  if (input.athleteRaceId) {
    return prisma.athlete_races.findFirst({
      where: { id: input.athleteRaceId, athleteId },
    });
  }
  if (input.raceRegistryId) {
    const existing = await findAthleteRaceByRegistry({
      athleteId,
      raceRegistryId: input.raceRegistryId,
    });
    if (existing) return existing;
    return claimAthleteRace({ athleteId, raceRegistryId: input.raceRegistryId });
  }
  return null;
}

export async function createGoal(athleteId: string, input: CreateGoalInput) {
  let targetByDate = input.targetByDate;
  let distance = input.distance.trim();
  let distanceMiles: number | null = null;
  let athleteRaceId: string | null = input.athleteRaceId ?? null;
  let raceRegistryId: string | null = input.raceRegistryId ?? null;

  const athleteRace = await resolveAthleteRaceForGoal(athleteId, input);
  if (athleteRace) {
    athleteRaceId = athleteRace.id;
    raceRegistryId = athleteRace.raceRegistryId;
    distanceMiles =
      athleteRace.distanceMeters != null
        ? metersToMiles(athleteRace.distanceMeters)
        : null;
    if (!distance) {
      distance = normalizeDistanceForPace(
        athleteRace.distanceLabel?.trim() ?? "",
        distanceMiles
      );
    }
    targetByDate = athleteRace.raceDate;
  } else if (input.raceRegistryId) {
    const race = await prisma.race_registry.findUnique({
      where: { id: input.raceRegistryId },
      select: { raceDate: true, distanceMeters: true, distanceLabel: true },
    });
    if (race) {
      distanceMiles =
        race.distanceMeters != null ? metersToMiles(race.distanceMeters) : null;
      if (!distance) {
        distance = normalizeDistanceForPace(
          race.distanceLabel?.trim() ?? "",
          distanceMiles
        );
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

  const goal = await prisma.athleteGoal.create({
    data: {
      athleteId,
      name: nameTrimmed,
      description,
      distance,
      goalTime: input.goalTime?.trim() || null,
      goalRacePace,
      goalPace5K,
      targetByDate,
      athleteRaceId,
      raceRegistryId,
      status: input.status ?? "ACTIVE",
      whyGoal,
      successLooksLike,
      completionFeeling,
      motivationIcon,
      updatedAt: new Date(),
    },
    include: {
      athlete_race: {
        select: {
          id: true,
          name: true,
          distanceLabel: true,
          distanceMeters: true,
          raceDate: true,
          city: true,
          state: true,
          raceRegistryId: true,
        },
      },
      race_registry: {
        select: {
          id: true,
          name: true,
          distanceLabel: true,
          distanceMeters: true,
          raceDate: true,
          city: true,
          state: true,
        },
      },
    },
  });

  await syncAthleteProfileSnapshot(athleteId);
  return goal;
}

export type UpdateGoalInput = Partial<{
  name: string | null;
  description: string | null;
  distance: string;
  goalTime: string | null;
  targetByDate: Date;
  raceRegistryId: string | null;
  athleteRaceId: string | null;
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
    include: {
      athlete_race: { select: { distanceMeters: true, raceDate: true, distanceLabel: true } },
      race_registry: {
        select: { distanceMeters: true, raceDate: true, distanceLabel: true },
      },
    },
  });
  if (!existing) return null;

  const distance = patch.distance ?? existing.distance;
  const goalTime =
    patch.goalTime !== undefined ? patch.goalTime : existing.goalTime;
  let distanceMiles =
    existing.athlete_race?.distanceMeters != null
      ? metersToMiles(existing.athlete_race.distanceMeters)
      : existing.race_registry?.distanceMeters != null
        ? metersToMiles(existing.race_registry.distanceMeters)
        : null;

  let athleteRaceId = patch.athleteRaceId;
  let raceRegistryId = patch.raceRegistryId;

  if (patch.athleteRaceId !== undefined) {
    if (patch.athleteRaceId) {
      const ar = await prisma.athlete_races.findFirst({
        where: { id: patch.athleteRaceId, athleteId },
      });
      if (ar) {
        athleteRaceId = ar.id;
        raceRegistryId = ar.raceRegistryId;
        distanceMiles =
          ar.distanceMeters != null ? metersToMiles(ar.distanceMeters) : null;
      }
    } else {
      athleteRaceId = null;
    }
  } else if (patch.raceRegistryId !== undefined) {
    if (patch.raceRegistryId) {
      const race = await prisma.race_registry.findUnique({
        where: { id: patch.raceRegistryId },
        select: { distanceMeters: true, raceDate: true },
      });
      distanceMiles =
        race?.distanceMeters != null ? metersToMiles(race.distanceMeters) : null;
    } else {
      distanceMiles = null;
    }
  }

  const { goalRacePace, goalPace5K } = deriveGoalPaces({
    distance,
    goalTime,
    distanceMiles,
  });

  const goal = await prisma.athleteGoal.update({
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
      ...(raceRegistryId !== undefined && { raceRegistryId }),
      ...(athleteRaceId !== undefined && { athleteRaceId }),
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
      athlete_race: {
        select: {
          id: true,
          name: true,
          distanceLabel: true,
          distanceMeters: true,
          raceDate: true,
          city: true,
          state: true,
          raceRegistryId: true,
        },
      },
      race_registry: {
        select: {
          id: true,
          name: true,
          distanceLabel: true,
          distanceMeters: true,
          raceDate: true,
          city: true,
          state: true,
        },
      },
    },
  });

  await syncAthleteProfileSnapshot(athleteId);
  return goal;
}
