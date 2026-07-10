/**
 * Athlete-authored global training plans — publish, discover, adopt.
 * Presets and workout catalogue remain company-owned; this layer wraps materialized plans.
 */

import { randomUUID } from "crypto";
import {
  PlanCustomWorkoutVisibility,
  Prisma,
  PublicTrainingPlanVisibility,
  TrainingPlanLifecycle,
  WorkoutType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { metersToMiles } from "@/lib/pace-utils";
import { goalRacePaceDisplayString, resolveGoalRacePace } from "@/lib/training/goal-pace-calculator";
import { executePlanGenerate } from "@/lib/training/execute-plan-generate";
import { totalWeeksFromDates } from "@/lib/training/plan-utils";
import { upsertRaceMembershipFromSignup } from "@/lib/race-container-membership";
import { syncAthleteProfileSnapshot } from "@/lib/athlete-profile-snapshot";
import {
  buildCustomWorkoutSnapshot,
  buildPreviewSnapshot,
  type PublicPlanCustomWorkoutSnapshot,
  type PublicPlanPreviewSnapshot,
} from "@/lib/training/public-training-plan-snapshots";

export type {
  PublicPlanPreviewSnapshot,
  PublicPlanCustomWorkoutSnapshot,
} from "@/lib/training/public-training-plan-snapshots";
export { buildPreviewSnapshot, buildCustomWorkoutSnapshot } from "@/lib/training/public-training-plan-snapshots";

export type PublishPublicPlanInput = {
  athleteId: string;
  sourceTrainingPlanId: string;
  title: string;
  description?: string | null;
  targetDistanceLabel?: string | null;
  visibility?: PublicTrainingPlanVisibility;
  includeCustomWorkouts?: boolean;
  leaderNotes?: { weekNumber: number; note: string }[];
};

export type AdoptPublicPlanInput = {
  slug: string;
  athleteId: string;
  raceRegistryId: string;
  athleteGoalId: string;
  startDate: Date;
  fiveKPace?: string | null;
  weeklyMileage?: number | null;
  preferredDays?: number[];
  replaceActivePlan?: boolean;
};

export type CreatePlanCustomWorkoutInput = {
  trainingPlanId: string;
  athleteId: string;
  weekNumber: number;
  dow: number;
  title: string;
  description?: string | null;
  workoutType?: WorkoutType;
  content?: unknown;
  leaderNotes?: string | null;
  visibility?: PlanCustomWorkoutVisibility;
};

export type UpdatePlanCustomWorkoutInput = {
  customWorkoutId: string;
  athleteId: string;
  weekNumber?: number;
  dow?: number;
  title?: string;
  description?: string | null;
  workoutType?: WorkoutType;
  content?: unknown;
  leaderNotes?: string | null;
  visibility?: PlanCustomWorkoutVisibility;
};

function slugifyPlanSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniquePublicPlanSlug(base: string): Promise<string> {
  const cleaned = slugifyPlanSlug(base) || "training-plan";
  for (let i = 0; i < 8; i++) {
    const suffix = i === 0 ? "" : `-${Math.random().toString(36).slice(2, 6)}`;
    const slug = `${cleaned}${suffix}`.slice(0, 80);
    const exists = await prisma.public_training_plans.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!exists) return slug;
  }
  return `${cleaned}-${Date.now().toString(36)}`;
}

const authorSelect = {
  id: true,
  firstName: true,
  lastName: true,
  gofastHandle: true,
  photoURL: true,
} as const;

export async function listDiscoverablePublicPlans(limit = 24) {
  return prisma.public_training_plans.findMany({
    where: { visibility: PublicTrainingPlanVisibility.PUBLIC },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: { author: { select: authorSelect } },
  });
}

export async function listAuthorPublicPlans(athleteId: string) {
  return prisma.public_training_plans.findMany({
    where: { authorAthleteId: athleteId },
    orderBy: { updatedAt: "desc" },
    include: { author: { select: authorSelect } },
  });
}

export async function getPublicPlanBySlug(
  rawSlug: string,
  options?: { allowUnlisted?: boolean; authorAthleteId?: string }
) {
  const slug = slugifyPlanSlug(rawSlug);
  if (!slug) return null;

  const visibilityFilter: PublicTrainingPlanVisibility[] = [
    PublicTrainingPlanVisibility.PUBLIC,
  ];
  if (options?.allowUnlisted) {
    visibilityFilter.push(PublicTrainingPlanVisibility.UNLISTED);
  }
  if (options?.authorAthleteId) {
    visibilityFilter.push(PublicTrainingPlanVisibility.DRAFT);
  }

  const plan = await prisma.public_training_plans.findFirst({
    where: {
      slug,
      visibility: { in: visibilityFilter },
      ...(options?.authorAthleteId
        ? { authorAthleteId: options.authorAthleteId }
        : {}),
    },
    include: {
      author: { select: authorSelect },
      sourceTrainingPlan: {
        select: {
          id: true,
          name: true,
          totalWeeks: true,
          startDate: true,
          race_registry: {
            select: {
              name: true,
              distanceLabel: true,
              raceDate: true,
            },
          },
        },
      },
      sourcePreset: {
        select: {
          id: true,
          title: true,
          targetDistanceLabel: true,
          publicDescription: true,
        },
      },
    },
  });

  return plan;
}

export async function publishPublicTrainingPlan(input: PublishPublicPlanInput) {
  const {
    athleteId,
    sourceTrainingPlanId,
    title,
    description,
    targetDistanceLabel,
    visibility = PublicTrainingPlanVisibility.DRAFT,
    includeCustomWorkouts = true,
    leaderNotes,
  } = input;

  const sourcePlan = await prisma.training_plans.findFirst({
    where: { id: sourceTrainingPlanId, athleteId },
    include: {
      race_registry: { select: { name: true, distanceLabel: true } },
    },
  });

  if (!sourcePlan) {
    throw new Error("Training plan not found");
  }
  if (!sourcePlan.presetId) {
    throw new Error("Plan must be generated from a preset before publishing");
  }
  if (!sourcePlan.planSchedule) {
    throw new Error("Generate your schedule before publishing a public plan");
  }

  const customWorkouts = includeCustomWorkouts
    ? await prisma.plan_custom_workouts.findMany({
        where: {
          trainingPlanId: sourceTrainingPlanId,
          authorAthleteId: athleteId,
          visibility: PlanCustomWorkoutVisibility.PUBLIC_WITH_PLAN,
        },
      })
    : [];

  const previewSnapshot = buildPreviewSnapshot({
    plan: sourcePlan,
    raceName: sourcePlan.race_registry?.name ?? null,
    customWorkouts,
    leaderNotes,
  });
  const customWorkoutSnapshot = includeCustomWorkouts
    ? buildCustomWorkoutSnapshot(customWorkouts)
    : { workouts: [] };

  const slug = await uniquePublicPlanSlug(title);
  const now = new Date();
  const publishedAt =
    visibility === PublicTrainingPlanVisibility.PUBLIC ||
    visibility === PublicTrainingPlanVisibility.UNLISTED
      ? now
      : null;

  return prisma.public_training_plans.create({
    data: {
      slug,
      title: title.trim(),
      description: description?.trim() || null,
      authorAthleteId: athleteId,
      sourceTrainingPlanId,
      sourcePresetId: sourcePlan.presetId,
      visibility,
      targetDistanceLabel:
        targetDistanceLabel?.trim() ||
        sourcePlan.race_registry?.distanceLabel ||
        null,
      durationWeeks: sourcePlan.totalWeeks,
      publishedAt,
      previewSnapshot: previewSnapshot as unknown as Prisma.InputJsonValue,
      customWorkoutSnapshot: customWorkoutSnapshot as unknown as Prisma.InputJsonValue,
      updatedAt: now,
    },
    include: { author: { select: authorSelect } },
  });
}

export async function updatePublicTrainingPlan(
  planId: string,
  athleteId: string,
  patch: {
    title?: string;
    description?: string | null;
    targetDistanceLabel?: string | null;
    visibility?: PublicTrainingPlanVisibility;
    includeCustomWorkouts?: boolean;
    leaderNotes?: { weekNumber: number; note: string }[];
  }
) {
  const existing = await prisma.public_training_plans.findFirst({
    where: { id: planId, authorAthleteId: athleteId },
  });
  if (!existing) throw new Error("Public plan not found");

  const sourcePlan = await prisma.training_plans.findUnique({
    where: { id: existing.sourceTrainingPlanId },
    include: {
      race_registry: { select: { name: true, distanceLabel: true } },
    },
  });
  if (!sourcePlan) throw new Error("Source training plan not found");

  const includeCustom = patch.includeCustomWorkouts ?? true;
  const customWorkouts = includeCustom
    ? await prisma.plan_custom_workouts.findMany({
        where: {
          trainingPlanId: existing.sourceTrainingPlanId,
          authorAthleteId: athleteId,
          visibility: PlanCustomWorkoutVisibility.PUBLIC_WITH_PLAN,
        },
      })
    : [];

  const previewSnapshot = buildPreviewSnapshot({
    plan: sourcePlan,
    raceName: sourcePlan.race_registry?.name ?? null,
    customWorkouts,
    leaderNotes: patch.leaderNotes,
  });
  const customWorkoutSnapshot = includeCustom
    ? buildCustomWorkoutSnapshot(customWorkouts)
    : { workouts: [] };

  const visibility = patch.visibility ?? existing.visibility;
  const publishedAt =
    visibility === PublicTrainingPlanVisibility.PUBLIC ||
    visibility === PublicTrainingPlanVisibility.UNLISTED
      ? existing.publishedAt ?? new Date()
      : null;

  return prisma.public_training_plans.update({
    where: { id: planId },
    data: {
      title: patch.title?.trim() ?? existing.title,
      description:
        patch.description !== undefined
          ? patch.description?.trim() || null
          : existing.description,
      targetDistanceLabel:
        patch.targetDistanceLabel !== undefined
          ? patch.targetDistanceLabel?.trim() || null
          : existing.targetDistanceLabel,
      visibility,
      publishedAt,
      previewSnapshot: previewSnapshot as unknown as Prisma.InputJsonValue,
      customWorkoutSnapshot: customWorkoutSnapshot as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
    include: { author: { select: authorSelect } },
  });
}

export async function listPlanCustomWorkouts(trainingPlanId: string, athleteId: string) {
  const plan = await prisma.training_plans.findFirst({
    where: { id: trainingPlanId, athleteId },
    select: { id: true },
  });
  if (!plan) throw new Error("Training plan not found");

  return prisma.plan_custom_workouts.findMany({
    where: { trainingPlanId },
    orderBy: [{ weekNumber: "asc" }, { dow: "asc" }],
  });
}

export async function createPlanCustomWorkout(input: CreatePlanCustomWorkoutInput) {
  const plan = await prisma.training_plans.findFirst({
    where: { id: input.trainingPlanId, athleteId: input.athleteId },
    select: { id: true },
  });
  if (!plan) throw new Error("Training plan not found");

  const now = new Date();
  return prisma.plan_custom_workouts.create({
    data: {
      trainingPlanId: input.trainingPlanId,
      authorAthleteId: input.athleteId,
      weekNumber: input.weekNumber,
      dow: input.dow,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      workoutType: input.workoutType ?? WorkoutType.Easy,
      content: (input.content ?? null) as Prisma.InputJsonValue,
      leaderNotes: input.leaderNotes?.trim() || null,
      visibility: input.visibility ?? PlanCustomWorkoutVisibility.PRIVATE,
      updatedAt: now,
    },
  });
}

export async function updatePlanCustomWorkout(input: UpdatePlanCustomWorkoutInput) {
  const existing = await prisma.plan_custom_workouts.findFirst({
    where: { id: input.customWorkoutId, authorAthleteId: input.athleteId },
  });
  if (!existing) throw new Error("Custom workout not found");

  return prisma.plan_custom_workouts.update({
    where: { id: input.customWorkoutId },
    data: {
      weekNumber: input.weekNumber ?? existing.weekNumber,
      dow: input.dow ?? existing.dow,
      title: input.title?.trim() ?? existing.title,
      description:
        input.description !== undefined
          ? input.description?.trim() || null
          : existing.description,
      workoutType: input.workoutType ?? existing.workoutType,
      content:
        input.content !== undefined
          ? (input.content as Prisma.InputJsonValue)
          : existing.content === null
            ? Prisma.JsonNull
            : existing.content,
      leaderNotes:
        input.leaderNotes !== undefined
          ? input.leaderNotes?.trim() || null
          : existing.leaderNotes,
      visibility: input.visibility ?? existing.visibility,
      updatedAt: new Date(),
    },
  });
}

export async function deletePlanCustomWorkout(customWorkoutId: string, athleteId: string) {
  const existing = await prisma.plan_custom_workouts.findFirst({
    where: { id: customWorkoutId, authorAthleteId: athleteId },
  });
  if (!existing) throw new Error("Custom workout not found");
  await prisma.plan_custom_workouts.delete({ where: { id: customWorkoutId } });
}

export type AdoptPublicPlanResult = {
  trainingPlanId: string;
  goalId: string;
  copiedCustomWorkoutCount: number;
};

export async function adoptPublicTrainingPlan(
  input: AdoptPublicPlanInput
): Promise<AdoptPublicPlanResult> {
  const publicPlan = await prisma.public_training_plans.findFirst({
    where: {
      slug: slugifyPlanSlug(input.slug),
      visibility: {
        in: [
          PublicTrainingPlanVisibility.PUBLIC,
          PublicTrainingPlanVisibility.UNLISTED,
        ],
      },
    },
  });

  if (!publicPlan?.sourcePresetId) {
    throw new Error("Public training plan not found or not adoptable");
  }

  const race = await prisma.race_registry.findUnique({
    where: { id: input.raceRegistryId },
  });
  if (!race) throw new Error("Race not found");

  const goal = await prisma.athleteGoal.findFirst({
    where: { id: input.athleteGoalId, athleteId: input.athleteId },
  });
  if (!goal) throw new Error("Goal not found");
  if (goal.raceRegistryId !== race.id) {
    throw new Error("Goal must match the selected race");
  }
  const gt = goal.goalTime?.trim();
  if (!gt) throw new Error("Goal must have a goal time");

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

  const preferredDays =
    input.preferredDays?.length
      ? input.preferredDays.filter((n) => n >= 1 && n <= 7)
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
    goalTime: gt,
    dbGoalRacePaceSecPerMile: goal.goalRacePace ?? null,
    distanceMeters: race.distanceMeters ?? null,
    distanceLabel: race.distanceLabel ?? null,
    goalDistance: goal.distance ?? null,
  });
  const imprintedGoalPace =
    resolvedGoalPace.goalPaceDisplay ??
    goalRacePaceDisplayString(gt, raceDistanceMiles);

  const planName = `${publicPlan.title} — my build`;
  const snapshot = publicPlan.customWorkoutSnapshot as PublicPlanCustomWorkoutSnapshot | null;

  const result = await prisma.$transaction(async (tx) => {
    await tx.athlete_race_signups.upsert({
      where: {
        athleteId_raceRegistryId: {
          athleteId: input.athleteId,
          raceRegistryId: race.id,
        },
      },
      create: { athleteId: input.athleteId, raceRegistryId: race.id },
      update: {},
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
          lifecycleStatus: TrainingPlanLifecycle.OLD_PLAN_UNUSED,
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
        athleteGoalId: goal.id,
        name: planName,
        startDate,
        totalWeeks,
        currentWeeklyMileage: weeklyResolved,
        weeklyMileageTarget: prefs?.weeklyMileageTarget ?? null,
        currentFiveKPace: fiveKPace,
        goalRaceTime: gt,
        ...(imprintedGoalPace ? { goalRacePace: imprintedGoalPace } : {}),
        lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
        preferredDays,
        presetId: publicPlan.sourcePresetId,
        updatedAt: now,
      },
    });

    let copiedCount = 0;
    if (snapshot?.workouts?.length) {
      for (const w of snapshot.workouts) {
        await tx.plan_custom_workouts.create({
          data: {
            trainingPlanId: plan.id,
            authorAthleteId: input.athleteId,
            sourcePublicPlanId: publicPlan.id,
            sourceCustomWorkoutId: w.sourceId,
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
    }

    return { plan, copiedCount, goalId: goal.id };
  });

  await upsertRaceMembershipFromSignup(input.athleteId, race.id);
  await syncAthleteProfileSnapshot(input.athleteId);

  const preset = await prisma.training_plan_preset.findUnique({
    where: { id: publicPlan.sourcePresetId },
    select: { minWeeklyMiles: true },
  });

  const weeklyMileageTarget = prefs?.weeklyMileageTarget ?? 45;
  await executePlanGenerate({
    athleteId: input.athleteId,
    athleteFiveKPace: fiveKPace,
    athleteWeeklyMileage: weeklyResolved,
    plan: {
      id: result.plan.id,
      presetId: publicPlan.sourcePresetId,
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
    goalId: result.goalId,
    copiedCustomWorkoutCount: result.copiedCount,
  };
}

export async function listPublishedPlansForAthlete(athleteId: string) {
  return prisma.public_training_plans.findMany({
    where: {
      authorAthleteId: athleteId,
      visibility: {
        in: [
          PublicTrainingPlanVisibility.PUBLIC,
          PublicTrainingPlanVisibility.UNLISTED,
        ],
      },
    },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      targetDistanceLabel: true,
      durationWeeks: true,
      publishedAt: true,
      visibility: true,
    },
  });
}
