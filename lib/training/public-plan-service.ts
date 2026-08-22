/**
 * Athlete-public training plans — promote, discover, and load by slug.
 * Source of truth: training_plans (name + planSchedule + publicSlug).
 */

import {
  PublicTrainingPlanVisibility,
  Prisma,
  PlanCustomWorkoutVisibility,
  TrainingPlanLifecycle,
  WorkoutType,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { metersToMiles } from "@/lib/pace-utils";
import { loadCatalogueTitleByIdForWeekSchedule } from "@/lib/training/catalogue-title-map";
import { planScheduleDaysForWeek } from "@/lib/training/plan-schedule";
import { effectiveTrainingWeekCount, totalWeeksFromDates } from "@/lib/training/plan-utils";
import { resolvePlanTerminalRaceDisplay } from "@/lib/training/plan-race-snapshots";
import { appendSlugSuffix, slugifyPlanSlug } from "@/lib/training/public-plan-slug";
import { goalRacePaceDisplayString, resolveGoalRacePace } from "@/lib/training/goal-pace-calculator";
import { executePlanGenerate } from "@/lib/training/execute-plan-generate";
import { upsertRaceMembershipFromSignup } from "@/lib/race-container-membership";
import { syncAthleteProfileSnapshot } from "@/lib/athlete-profile-snapshot";
import { snapPrimaryRaceToPlanTerminal } from "@/lib/athlete-primary-race";

export { slugifyPlanSlug } from "@/lib/training/public-plan-slug";

export type PublicPlanWeekDay = {
  dateKey: string;
  title: string;
  workoutType: string;
  estimatedDistanceInMeters: number;
  dayAssigned: string | null;
};

export type PublicPlanWeek = {
  weekNumber: number;
  days: PublicPlanWeekDay[];
  totalMiles: number;
};

const authorSelect = {
  id: true,
  firstName: true,
  lastName: true,
  gofastHandle: true,
  photoURL: true,
} as const;

export async function uniqueTrainingPlanPublicSlug(base: string): Promise<string> {
  const cleaned = slugifyPlanSlug(base) || "training-plan";
  for (let i = 0; i < 8; i++) {
    const suffix = i === 0 ? "" : `-${Math.random().toString(36).slice(2, 6)}`;
    const slug = appendSlugSuffix(cleaned, suffix);
    const exists = await prisma.training_plans.findFirst({
      where: { publicSlug: slug },
      select: { id: true },
    });
    if (!exists) return slug;
  }
  return `${cleaned}-${Date.now().toString(36)}`.slice(0, 80);
}

export async function listDiscoverablePublicPlans(limit = 24) {
  return prisma.training_plans.findMany({
    where: { publicVisibility: PublicTrainingPlanVisibility.PUBLIC },
    orderBy: [{ publicPublishedAt: "desc" }, { updatedAt: "desc" }],
    take: limit,
    include: {
      Athlete: { select: authorSelect },
      race_registry: { select: { name: true, distanceLabel: true } },
    },
  });
}

export async function listPublicPlansForAthlete(athleteId: string) {
  return prisma.training_plans.findMany({
    where: {
      athleteId,
      publicVisibility: PublicTrainingPlanVisibility.PUBLIC,
    },
    orderBy: { publicPublishedAt: "desc" },
    select: {
      id: true,
      name: true,
      publicSlug: true,
      publicDescription: true,
      totalWeeks: true,
      publicPublishedAt: true,
      publicVisibility: true,
      race_registry: { select: { distanceLabel: true } },
    },
  });
}

export async function getPublicPlanBySlug(
  rawSlug: string,
  options?: { authorAthleteId?: string }
) {
  const slug = slugifyPlanSlug(rawSlug);
  if (!slug) return null;

  const visibilityFilter: PublicTrainingPlanVisibility[] = [
    PublicTrainingPlanVisibility.PUBLIC,
  ];
  if (options?.authorAthleteId) {
    visibilityFilter.push(PublicTrainingPlanVisibility.DRAFT);
  }

  const plan = await prisma.training_plans.findFirst({
    where: {
      publicSlug: slug,
      publicVisibility: { in: visibilityFilter },
      ...(options?.authorAthleteId ? { athleteId: options.authorAthleteId } : {}),
    },
    include: {
      Athlete: { select: authorSelect },
      race_registry: {
        select: {
          id: true,
          name: true,
          distanceLabel: true,
          raceDate: true,
          distanceMeters: true,
        },
      },
      athlete_race: {
        select: {
          id: true,
          raceRegistryId: true,
          name: true,
          raceDate: true,
          distanceMeters: true,
          distanceLabel: true,
        },
      },
      training_plan_preset: {
        select: {
          id: true,
          title: true,
          publicDescription: true,
        },
      },
    },
  });

  return plan;
}

export type PromotePublicPlanInput = {
  trainingPlanId: string;
  athleteId: string;
  visibility?: PublicTrainingPlanVisibility;
  description?: string | null;
  regenerateSlug?: boolean;
};

export async function promoteTrainingPlanPublic(input: PromotePublicPlanInput) {
  const {
    trainingPlanId,
    athleteId,
    visibility = PublicTrainingPlanVisibility.PUBLIC,
    description,
    regenerateSlug = false,
  } = input;

  const plan = await prisma.training_plans.findFirst({
    where: { id: trainingPlanId, athleteId },
    include: {
      race_registry: { select: { name: true, distanceLabel: true } },
    },
  });

  if (!plan) throw new Error("Training plan not found");
  if (!plan.presetId) {
    throw new Error("Plan must be generated from a preset before publishing");
  }
  if (!plan.planSchedule) {
    throw new Error("Generate your schedule before publishing a public plan");
  }
  const planName = plan.name?.trim();
  if (!planName) throw new Error("Plan must have a name before publishing");

  const now = new Date();
  const publicPublishedAt =
    visibility === PublicTrainingPlanVisibility.PUBLIC
      ? plan.publicPublishedAt ?? now
      : null;

  let publicSlug = plan.publicSlug;
  if (!publicSlug || regenerateSlug) {
    publicSlug = await uniqueTrainingPlanPublicSlug(planName);
  }

  return prisma.training_plans.update({
    where: { id: plan.id },
    data: {
      publicSlug,
      publicVisibility: visibility,
      publicPublishedAt,
      publicDescription:
        description !== undefined ? description?.trim() || null : plan.publicDescription,
      updatedAt: now,
    },
    include: {
      Athlete: { select: authorSelect },
      race_registry: { select: { name: true, distanceLabel: true } },
    },
  });
}

export async function computePublicPlanWeek(params: {
  planSchedule: unknown;
  planStartDate: Date;
  storedTotalWeeks: number;
  weekNumber: number;
  raceDate: Date | null;
  raceName: string | null;
  raceDistanceMiles: number | null;
}): Promise<PublicPlanWeek> {
  const effectiveWeeks = effectiveTrainingWeekCount(
    params.planStartDate,
    params.storedTotalWeeks,
    params.raceDate
  );
  const catalogueTitleById = await loadCatalogueTitleByIdForWeekSchedule(
    params.planSchedule,
    params.weekNumber,
    effectiveWeeks
  );
  const days = planScheduleDaysForWeek({
    planStartDate: params.planStartDate,
    planSchedule: params.planSchedule,
    weekNumber: params.weekNumber,
    raceDate: params.raceDate,
    raceName: params.raceName,
    raceDistanceMiles: params.raceDistanceMiles,
    totalWeeks: effectiveWeeks,
    catalogueTitleById,
  });

  const mapped: PublicPlanWeekDay[] = days.map((d) => ({
    dateKey: d.dateKey,
    title: d.title,
    workoutType: d.workoutType,
    estimatedDistanceInMeters: d.estimatedDistanceInMeters,
    dayAssigned: d.dayAssigned ?? null,
  }));

  const totalMeters = mapped.reduce((s, d) => s + (d.estimatedDistanceInMeters ?? 0), 0);

  return {
    weekNumber: params.weekNumber,
    days: mapped,
    totalMiles: Math.round((totalMeters / 1609.34) * 10) / 10,
  };
}

export async function computeAllPublicPlanWeeks(plan: {
  planSchedule: unknown;
  startDate: Date;
  totalWeeks: number;
  race_registry: {
    name: string;
    raceDate: Date;
    distanceMeters: number | null;
  } | null;
}): Promise<PublicPlanWeek[]> {
  const raceDate = plan.race_registry?.raceDate ?? null;
  const raceName = plan.race_registry?.name ?? null;
  const raceDistanceMiles =
    plan.race_registry?.distanceMeters != null &&
    Number.isFinite(Number(plan.race_registry.distanceMeters))
      ? metersToMiles(Number(plan.race_registry.distanceMeters))
      : null;

  const effectiveWeeks = effectiveTrainingWeekCount(
    plan.startDate,
    plan.totalWeeks,
    raceDate
  );

  const weeks: PublicPlanWeek[] = [];
  for (let wn = 1; wn <= effectiveWeeks; wn++) {
    weeks.push(
      await computePublicPlanWeek({
        planSchedule: plan.planSchedule,
        planStartDate: plan.startDate,
        storedTotalWeeks: plan.totalWeeks,
        weekNumber: wn,
        raceDate,
        raceName,
        raceDistanceMiles,
      })
    );
  }
  return weeks;
}

export function mapPublishedPlanCard(plan: {
  id: string;
  name: string;
  publicSlug: string | null;
  publicDescription: string | null;
  totalWeeks: number;
  publicPublishedAt: Date | null;
  race_registry: { distanceLabel: string | null } | null;
}) {
  return {
    id: plan.id,
    slug: plan.publicSlug ?? "",
    title: plan.name,
    description: plan.publicDescription,
    targetDistanceLabel: plan.race_registry?.distanceLabel ?? null,
    durationWeeks: plan.totalWeeks,
    publishedAt: plan.publicPublishedAt?.toISOString() ?? null,
  };
}

export function mapPublicPlanApiResponse(plan: {
  id: string;
  name: string;
  publicSlug: string | null;
  publicDescription: string | null;
  publicVisibility: PublicTrainingPlanVisibility | null;
  publicPublishedAt: Date | null;
  totalWeeks: number;
  athleteRaceId?: string | null;
  athleteRaceMainSnap?: unknown;
  athlete_race?: {
    id: string;
    raceRegistryId: string;
    name: string;
    raceDate: Date;
    distanceMeters: number | null;
    distanceLabel: string | null;
  } | null;
  Athlete: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    gofastHandle: string | null;
    photoURL: string | null;
  };
  race_registry: {
    id?: string;
    name: string;
    raceDate?: Date;
    distanceMeters?: number | null;
    distanceLabel: string | null;
  } | null;
}) {
  const terminal = resolvePlanTerminalRaceDisplay(
    plan as Parameters<typeof resolvePlanTerminalRaceDisplay>[0]
  );
  return {
    id: plan.id,
    slug: plan.publicSlug,
    title: plan.name,
    description: plan.publicDescription,
    visibility: plan.publicVisibility,
    publishedAt: plan.publicPublishedAt?.toISOString() ?? null,
    durationWeeks: plan.totalWeeks,
    targetDistanceLabel:
      terminal?.distanceLabel ?? plan.race_registry?.distanceLabel ?? null,
    author: plan.Athlete,
    raceName: terminal?.name ?? plan.race_registry?.name ?? null,
    raceRegistryId:
      plan.athlete_race?.raceRegistryId ??
      (plan.race_registry as { id?: string } | null)?.id ??
      null,
    raceDate:
      plan.athlete_race?.raceDate?.toISOString() ??
      plan.race_registry?.raceDate?.toISOString() ??
      null,
  };
}

export async function listAuthorPublicPlans(athleteId: string) {
  const plans = await prisma.training_plans.findMany({
    where: {
      athleteId,
      publicVisibility: { not: null },
    },
    orderBy: [{ publicPublishedAt: "desc" }, { updatedAt: "desc" }],
    include: {
      Athlete: { select: authorSelect },
      race_registry: { select: { name: true, distanceLabel: true } },
    },
  });
  return plans.map(mapPublicPlanApiResponse);
}

export type UpdatePublicPlanInput = {
  description?: string | null;
  visibility?: PublicTrainingPlanVisibility;
  name?: string;
  regenerateSlug?: boolean;
};

export async function updatePublicTrainingPlanBySlug(
  slug: string,
  athleteId: string,
  input: UpdatePublicPlanInput
) {
  const existing = await getPublicPlanBySlug(slug, { authorAthleteId: athleteId });
  if (!existing || existing.athleteId !== athleteId) {
    throw new Error("Plan not found");
  }

  const data: Prisma.training_plansUpdateInput = { updatedAt: new Date() };

  if (input.description !== undefined) {
    data.publicDescription =
      typeof input.description === "string" ? input.description.trim() || null : null;
  }

  if (input.name !== undefined && input.name.trim()) {
    data.name = input.name.trim();
    if (input.regenerateSlug) {
      data.publicSlug = await uniqueTrainingPlanPublicSlug(input.name.trim());
    }
  }

  if (input.visibility) {
    data.publicVisibility = input.visibility;
    if (input.visibility === PublicTrainingPlanVisibility.PUBLIC) {
      data.publicPublishedAt = existing.publicPublishedAt ?? new Date();
    } else {
      data.publicPublishedAt = null;
    }
  }

  return prisma.training_plans.update({
    where: { id: existing.id },
    data,
    include: {
      Athlete: { select: authorSelect },
      race_registry: { select: { name: true, distanceLabel: true } },
    },
  });
}

export type AdoptPublishedPlanInput = {
  slug: string;
  athleteId: string;
  athleteRaceId: string;
  startDate: Date;
  goalTime: string;
  fiveKPace?: string | null;
  weeklyMileage?: number | null;
  replaceActivePlan?: boolean;
};

export type AdoptPublishedPlanResult = {
  trainingPlanId: string;
  athleteRaceId: string;
  copiedCustomWorkoutCount: number;
};

function resolveSourceRaceRegistryId(plan: {
  raceId: string | null;
  athlete_race: { raceRegistryId: string } | null;
}): string | null {
  return plan.athlete_race?.raceRegistryId ?? plan.raceId ?? null;
}

export async function adoptPublishedPlanBySlug(
  input: AdoptPublishedPlanInput
): Promise<AdoptPublishedPlanResult> {
  const sourcePlan = await getPublicPlanBySlug(input.slug);
  if (
    !sourcePlan ||
    sourcePlan.publicVisibility !== PublicTrainingPlanVisibility.PUBLIC
  ) {
    throw new Error("Public training plan not found or not adoptable");
  }
  if (!sourcePlan.presetId) {
    throw new Error("Public training plan not found or not adoptable");
  }
  if (!sourcePlan.planSchedule) {
    throw new Error("Published plan has no schedule to adopt");
  }
  if (sourcePlan.athleteId === input.athleteId) {
    throw new Error("You cannot adopt your own published plan");
  }

  const sourceRaceRegistryId = resolveSourceRaceRegistryId(sourcePlan);
  if (!sourceRaceRegistryId) {
    throw new Error("Published plan is missing a target race");
  }

  const race = await prisma.race_registry.findUnique({
    where: { id: sourceRaceRegistryId },
    select: {
      id: true,
      name: true,
      raceDate: true,
      distanceMeters: true,
      distanceLabel: true,
    },
  });
  if (!race) throw new Error("Race not found");

  const goalTime = input.goalTime?.trim();
  if (!goalTime) throw new Error("Goal time is required");

  const athleteRace = await prisma.athlete_races.findFirst({
    where: {
      id: input.athleteRaceId,
      athleteId: input.athleteId,
      raceRegistryId: race.id,
    },
  });
  if (!athleteRace) {
    throw new Error("You must add this race to My Races before adopting this plan");
  }

  const startDate = input.startDate;
  if (Number.isNaN(startDate.getTime())) throw new Error("Invalid start date");
  if (startDate >= race.raceDate) {
    throw new Error("Plan start date must be before race date");
  }

  const athlete = await prisma.athlete.findUnique({ where: { id: input.athleteId } });
  if (!athlete) throw new Error("Athlete not found");

  const prefs = await prisma.trainingPreferences.findUnique({
    where: { athleteId: input.athleteId },
  });

  const preferredDays = sourcePlan.preferredDays?.length
    ? sourcePlan.preferredDays
    : prefs?.preferredDays?.length
      ? prefs.preferredDays
      : [];

  const fiveKPace = input.fiveKPace?.trim() || athlete.fiveKPace || null;
  const weeklyResolved =
    input.weeklyMileage ?? athlete.weeklyMileage ?? null;
  const totalWeeks = totalWeeksFromDates(startDate, race.raceDate);

  const raceDistanceMiles =
    race.distanceMeters != null && Number.isFinite(Number(race.distanceMeters))
      ? metersToMiles(Number(race.distanceMeters))
      : 26.21875;
  const resolvedGoalPace = resolveGoalRacePace({
    goalTime,
    dbGoalRacePaceSecPerMile: athleteRace.goalRacePace ?? null,
    distanceMeters: race.distanceMeters ?? null,
    distanceLabel: race.distanceLabel ?? null,
    goalDistance: athleteRace.goalDistance ?? null,
  });
  const imprintedGoalPace =
    resolvedGoalPace.goalPaceDisplay ??
    goalRacePaceDisplayString(goalTime, raceDistanceMiles);

  const sourceCustomWorkouts = await prisma.plan_custom_workouts.findMany({
    where: { trainingPlanId: sourcePlan.id },
    orderBy: [{ weekNumber: "asc" }, { dow: "asc" }],
  });

  const planName = `${sourcePlan.name} — my build`;

  const result = await prisma.$transaction(async (tx) => {
    const athleteRaceRow = await tx.athlete_races.update({
      where: { id: athleteRace.id },
      data: {
        goalTime,
        goalRacePace: resolvedGoalPace.goalPaceSecPerMile ?? athleteRace.goalRacePace,
        updatedAt: new Date(),
      },
    });

    const existingActive = await tx.training_plans.findFirst({
      where: {
        athleteId: input.athleteId,
        lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
      },
      select: { id: true },
    });

    if (existingActive && !input.replaceActivePlan) {
      throw new Error(
        "You already have an active training plan. Confirm replace to adopt this plan."
      );
    }

    if (existingActive) {
      await tx.training_plans.updateMany({
        where: {
          athleteId: input.athleteId,
          lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
        },
        data: {
          lifecycleStatus: TrainingPlanLifecycle.PARKED,
          updatedAt: new Date(),
        },
      });
    }

    const now = new Date();
    const plan = await tx.training_plans.create({
      data: {
        id: randomUUID(),
        athleteId: input.athleteId,
        raceId: race.id,
        athleteRaceId: athleteRaceRow.id,
        name: planName,
        startDate,
        totalWeeks,
        currentWeeklyMileage: weeklyResolved,
        weeklyMileageTarget: prefs?.weeklyMileageTarget ?? null,
        currentFiveKPace: fiveKPace,
        goalRaceTime: goalTime,
        ...(imprintedGoalPace ? { goalRacePace: imprintedGoalPace } : {}),
        lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
        preferredDays,
        preferredLongRunDow: sourcePlan.preferredLongRunDow,
        preferredTempoDow: sourcePlan.preferredTempoDow,
        preferredIntervalDow: sourcePlan.preferredIntervalDow,
        preferredQualityDays: sourcePlan.preferredQualityDays ?? [],
        presetId: sourcePlan.presetId,
        updatedAt: now,
      },
    });

    let copiedCount = 0;
    for (const w of sourceCustomWorkouts) {
      await tx.plan_custom_workouts.create({
        data: {
          trainingPlanId: plan.id,
          authorAthleteId: input.athleteId,
          sourceCustomWorkoutId: w.id,
          weekNumber: w.weekNumber,
          dow: w.dow,
          title: w.title,
          description: w.description,
          workoutType: w.workoutType as WorkoutType,
          content: (w.content ?? null) as Prisma.InputJsonValue,
          leaderNotes: w.leaderNotes,
          visibility: PlanCustomWorkoutVisibility.PRIVATE,
          updatedAt: now,
        },
      });
      copiedCount += 1;
    }

    return { plan, copiedCount, athleteRaceId: athleteRaceRow.id };
  });

  if (fiveKPace || weeklyResolved != null) {
    await prisma.athlete.update({
      where: { id: input.athleteId },
      data: {
        ...(fiveKPace ? { fiveKPace } : {}),
        ...(weeklyResolved != null ? { weeklyMileage: weeklyResolved } : {}),
        updatedAt: new Date(),
      },
    });
  }

  await upsertRaceMembershipFromSignup(input.athleteId, race.id);
  await syncAthleteProfileSnapshot(input.athleteId);
  await snapPrimaryRaceToPlanTerminal({
    athleteId: input.athleteId,
    athleteRaceId: result.athleteRaceId,
  });

  const preset = await prisma.training_plan_preset.findUnique({
    where: { id: sourcePlan.presetId! },
    select: { minWeeklyMiles: true },
  });

  const weeklyMileageTarget = prefs?.weeklyMileageTarget ?? 45;
  await executePlanGenerate({
    athleteId: input.athleteId,
    athleteFiveKPace: fiveKPace,
    athleteWeeklyMileage: weeklyResolved,
    plan: {
      id: result.plan.id,
      presetId: sourcePlan.presetId!,
      startDate: result.plan.startDate,
      preferredDays: result.plan.preferredDays ?? [],
      preferredLongRunDow: result.plan.preferredLongRunDow ?? null,
      preferredTempoDow: result.plan.preferredTempoDow ?? null,
      preferredIntervalDow: result.plan.preferredIntervalDow ?? null,
      currentFiveKPace: result.plan.currentFiveKPace,
      weeklyMileageTarget: result.plan.weeklyMileageTarget,
    },
    weeklyMileageTarget,
    minWeeklyMiles: preset?.minWeeklyMiles ?? 40,
  });

  return {
    trainingPlanId: result.plan.id,
    athleteRaceId: result.athleteRaceId,
    copiedCustomWorkoutCount: result.copiedCount,
  };
}
