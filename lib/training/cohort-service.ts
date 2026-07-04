/**
 * Training cohort create/join — athlete-hosted group training for a race + preset.
 */

import { randomUUID } from "crypto";
import {
  TrainingPlanLifecycle,
  TrainingCohortRole,
  type TrainingCohortStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createGoal } from "@/lib/goal-service";
import { upsertRaceMembershipFromSignup } from "@/lib/race-container-membership";
import { syncAthleteProfileSnapshot } from "@/lib/athlete-profile-snapshot";
import {
  currentTrainingWeekNumber,
  totalWeeksFromDates,
} from "@/lib/training/plan-utils";
import {
  goalRacePaceDisplayString,
  resolveGoalRacePace,
} from "@/lib/training/goal-pace-calculator";
import { metersToMiles } from "@/lib/pace-utils";
import { executePlanGenerate } from "@/lib/training/execute-plan-generate";

export type PublicCohortPayload = {
  id: string;
  handle: string;
  cohortName: string;
  description: string | null;
  status: TrainingCohortStatus;
  defaultPlanStartDate: string | null;
  currentWeekNumber: number | null;
  totalWeeks: number | null;
  memberCount: number;
  race: {
    id: string;
    name: string;
    slug: string | null;
    raceDate: string;
    city: string | null;
    state: string | null;
    distanceLabel: string | null;
  };
  host: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    gofastHandle: string | null;
    photoURL: string | null;
  } | null;
};

function slugifyHandle(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueCohortHandle(base: string): Promise<string> {
  const cleaned = slugifyHandle(base) || "training-group";
  for (let i = 0; i < 8; i++) {
    const suffix = i === 0 ? "" : `-${Math.random().toString(36).slice(2, 6)}`;
    const handle = `${cleaned}${suffix}`.slice(0, 64);
    const exists = await prisma.training_cohorts.findUnique({
      where: { handle },
      select: { id: true },
    });
    if (!exists) return handle;
  }
  return `${cleaned}-${Date.now().toString(36)}`;
}

function joinCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function getPublicCohortByHandle(
  rawHandle: string
): Promise<PublicCohortPayload | null> {
  const handle = slugifyHandle(rawHandle);
  if (!handle) return null;

  const cohort = await prisma.training_cohorts.findFirst({
    where: {
      handle,
      status: { in: ["OPEN", "ACTIVE"] },
    },
    include: {
      race_registry: {
        select: {
          id: true,
          name: true,
          slug: true,
          raceDate: true,
          city: true,
          state: true,
          distanceLabel: true,
        },
      },
      hostAthlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          gofastHandle: true,
          photoURL: true,
        },
      },
      _count: { select: { memberships: true } },
    },
  });

  if (!cohort?.race_registry) return null;

  let totalWeeks: number | null = null;
  let currentWeekNumber: number | null = null;
  if (cohort.defaultPlanStartDate) {
    totalWeeks = totalWeeksFromDates(
      cohort.defaultPlanStartDate,
      cohort.race_registry.raceDate
    );
    currentWeekNumber = currentTrainingWeekNumber(
      cohort.defaultPlanStartDate,
      totalWeeks
    );
  }

  return {
    id: cohort.id,
    handle: cohort.handle,
    cohortName: cohort.cohortName,
    description: cohort.description,
    status: cohort.status,
    defaultPlanStartDate: cohort.defaultPlanStartDate?.toISOString() ?? null,
    currentWeekNumber,
    totalWeeks,
    memberCount: cohort._count.memberships,
    race: {
      id: cohort.race_registry.id,
      name: cohort.race_registry.name,
      slug: cohort.race_registry.slug,
      raceDate: cohort.race_registry.raceDate.toISOString(),
      city: cohort.race_registry.city,
      state: cohort.race_registry.state,
      distanceLabel: cohort.race_registry.distanceLabel,
    },
    host: cohort.hostAthlete
      ? {
          id: cohort.hostAthlete.id,
          firstName: cohort.hostAthlete.firstName,
          lastName: cohort.hostAthlete.lastName,
          gofastHandle: cohort.hostAthlete.gofastHandle,
          photoURL: cohort.hostAthlete.photoURL,
        }
      : null,
  };
}

/** Joinable cohort hosted by athlete for public profile CTA. */
export async function getJoinableCohortForHost(
  hostAthleteId: string
): Promise<PublicCohortPayload | null> {
  const cohort = await prisma.training_cohorts.findFirst({
    where: {
      hostAthleteId,
      status: { in: ["OPEN", "ACTIVE"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { handle: true },
  });
  if (!cohort?.handle) return null;
  return getPublicCohortByHandle(cohort.handle);
}

export type CreateCohortFromPlanResult = {
  cohort: PublicCohortPayload;
  joinPath: string;
};

/** Host opens group training from their active plan. */
export async function createCohortFromHostPlan(
  hostAthleteId: string,
  opts?: { description?: string | null; open?: boolean }
): Promise<CreateCohortFromPlanResult> {
  const host = await prisma.athlete.findUnique({
    where: { id: hostAthleteId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gofastHandle: true,
      city: true,
      state: true,
    },
  });
  if (!host) {
    throw new Error("Athlete not found");
  }

  const plan = await prisma.training_plans.findFirst({
    where: {
      athleteId: hostAthleteId,
      lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
    },
    orderBy: { updatedAt: "desc" },
    include: {
      race_registry: {
        select: {
          id: true,
          name: true,
          slug: true,
          raceDate: true,
          city: true,
          state: true,
          distanceLabel: true,
          distanceMeters: true,
        },
      },
    },
  });

  if (!plan?.race_registry || !plan.presetId) {
    throw new Error(
      "You need an active training plan with a race and training preset before opening group training."
    );
  }

  const existing = await prisma.training_cohorts.findFirst({
    where: {
      hostAthleteId,
      raceId: plan.race_registry.id,
      status: { in: ["DRAFT", "OPEN", "ACTIVE"] },
    },
    select: { handle: true },
  });
  if (existing?.handle) {
    const pub = await getPublicCohortByHandle(existing.handle);
    if (pub) {
      return { cohort: pub, joinPath: `/join/training/${encodeURIComponent(pub.handle)}` };
    }
  }

  const race = plan.race_registry;
  const hostLabel =
    host.firstName?.trim() ||
    (host.gofastHandle ? `@${host.gofastHandle}` : "Runner");
  const cohortName = `${race.name} training with ${hostLabel}`;
  const baseHandle = host.gofastHandle
    ? `${host.gofastHandle}-${race.slug ?? "race"}`
    : `${hostLabel}-${race.slug ?? plan.id.slice(0, 8)}`;
  const handle = await uniqueCohortHandle(baseHandle);

  const shouldOpen = opts?.open !== false;
  const now = new Date();

  const cohort = await prisma.training_cohorts.create({
    data: {
      raceId: race.id,
      presetId: plan.presetId,
      cohortName,
      handle,
      joinCode: joinCode(),
      description:
        opts?.description?.trim() ||
        `Group training for ${race.name}. Same plan structure — your own schedule and paces.`,
      defaultPlanStartDate: plan.startDate,
      hostAthleteId: host.id,
      city: host.city ?? race.city,
      state: host.state ?? race.state,
      status: shouldOpen ? "OPEN" : "DRAFT",
      updatedAt: now,
    },
  });

  await prisma.training_plans.update({
    where: { id: plan.id },
    data: { cohortId: cohort.id, updatedAt: now },
  });

  await prisma.training_cohort_memberships.upsert({
    where: {
      cohortId_athleteId: { cohortId: cohort.id, athleteId: host.id },
    },
    create: {
      cohortId: cohort.id,
      raceId: race.id,
      athleteId: host.id,
      role: "ADMIN" as TrainingCohortRole,
      trainingPlanId: plan.id,
    },
    update: {
      trainingPlanId: plan.id,
      role: "ADMIN" as TrainingCohortRole,
    },
  });

  const pub = await getPublicCohortByHandle(cohort.handle);
  if (!pub) {
    throw new Error("Failed to load created cohort");
  }

  return {
    cohort: pub,
    joinPath: `/join/training/${encodeURIComponent(pub.handle)}`,
  };
}

export type JoinCohortInput = {
  cohortId: string;
  athleteId: string;
  goalTime?: string | null;
  replaceActivePlan?: boolean;
};

export type JoinCohortResult = {
  membershipId: string;
  trainingPlanId: string;
  goalId: string;
  alreadyMember: boolean;
};

/** Join cohort: membership + race signup + goal + personal plan + schedule generation. */
export async function joinTrainingCohort(
  input: JoinCohortInput
): Promise<JoinCohortResult> {
  const { cohortId, athleteId, goalTime, replaceActivePlan } = input;

  const cohort = await prisma.training_cohorts.findUnique({
    where: { id: cohortId },
    include: {
      race_registry: true,
      training_plan_preset: { select: { id: true, targetDistanceLabel: true } },
    },
  });

  if (!cohort || (cohort.status !== "OPEN" && cohort.status !== "ACTIVE")) {
    throw new Error("Training group not found or not accepting members");
  }
  if (!cohort.defaultPlanStartDate || !cohort.presetId) {
    throw new Error("This training group is not fully configured yet");
  }

  const race = cohort.race_registry;
  if (!race) {
    throw new Error("Race not found for this training group");
  }

  const existingMember = await prisma.training_cohort_memberships.findUnique({
    where: { cohortId_athleteId: { cohortId, athleteId } },
  });
  if (existingMember?.trainingPlanId) {
    return {
      membershipId: existingMember.id,
      trainingPlanId: existingMember.trainingPlanId,
      goalId: "",
      alreadyMember: true,
    };
  }

  const athlete = await prisma.athlete.findUnique({ where: { id: athleteId } });
  if (!athlete) {
    throw new Error("Athlete not found");
  }

  const gt = goalTime?.trim() || null;
  if (!gt) {
    throw new Error("goalTime is required to build your training plan");
  }

  const startDate = cohort.defaultPlanStartDate;
  const totalWeeks = totalWeeksFromDates(startDate, race.raceDate);

  const raceDistanceMiles =
    race.distanceMeters != null && Number.isFinite(Number(race.distanceMeters))
      ? metersToMiles(Number(race.distanceMeters))
      : 26.21875;
  const resolvedGoalPace = resolveGoalRacePace({
    goalTime: gt,
    dbGoalRacePaceSecPerMile: null,
    distanceMeters: race.distanceMeters ?? null,
    distanceLabel: race.distanceLabel ?? null,
    goalDistance: race.distanceLabel ?? null,
  });
  const imprintedGoalPace =
    resolvedGoalPace.goalPaceDisplay ??
    goalRacePaceDisplayString(gt, raceDistanceMiles);

  const prefs = await prisma.trainingPreferences.findUnique({
    where: { athleteId },
  });
  const preferredDays = prefs?.preferredDays?.length ? prefs.preferredDays : [];
  const fiveKPace = athlete.fiveKPace ?? null;
  const weeklyResolved = athlete.weeklyMileage ?? null;

  const planName = `${race.name} — group training`;

  const result = await prisma.$transaction(async (tx) => {
    await tx.athlete_race_signups.upsert({
      where: {
        athleteId_raceRegistryId: { athleteId, raceRegistryId: race.id },
      },
      create: { athleteId, raceRegistryId: race.id },
      update: {},
    });

    const goal = await createGoal(athleteId, {
      name: `${race.name} goal`,
      distance: race.distanceLabel ?? "Marathon",
      goalTime: gt,
      targetByDate: race.raceDate,
      raceRegistryId: race.id,
      status: "ACTIVE",
    });

    const existingActive = await tx.training_plans.findFirst({
      where: {
        athleteId,
        lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
      },
      select: { id: true },
    });

    if (existingActive && !replaceActivePlan) {
      throw new Error(
        "You already have an active training plan. Confirm replace to join this group plan."
      );
    }

    if (existingActive) {
      await tx.training_plans.updateMany({
        where: { athleteId, lifecycleStatus: TrainingPlanLifecycle.ACTIVE },
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
        athleteId,
        raceId: race.id,
        athleteGoalId: goal.id,
        cohortId: cohort.id,
        name: planName,
        startDate,
        totalWeeks,
        currentWeeklyMileage: weeklyResolved,
        weeklyMileageTarget: null,
        currentFiveKPace: fiveKPace,
        goalRaceTime: gt,
        ...(imprintedGoalPace ? { goalRacePace: imprintedGoalPace } : {}),
        lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
        preferredDays,
        presetId: cohort.presetId,
        updatedAt: now,
      },
    });

    const member = await tx.training_cohort_memberships.upsert({
      where: { cohortId_athleteId: { cohortId, athleteId } },
      create: {
        cohortId,
        raceId: race.id,
        athleteId,
        role: "MEMBER" as TrainingCohortRole,
        trainingPlanId: plan.id,
      },
      update: { trainingPlanId: plan.id },
    });

    return { plan, member, goalId: goal.id };
  });

  await upsertRaceMembershipFromSignup(athleteId, race.id);
  await syncAthleteProfileSnapshot(athleteId);

  const weeklyMileageTarget = prefs?.weeklyMileageTarget ?? 45;
  await executePlanGenerate({
    athleteId,
    athleteFiveKPace: athlete.fiveKPace,
    athleteWeeklyMileage: athlete.weeklyMileage,
    plan: {
      id: result.plan.id,
      presetId: cohort.presetId,
      startDate: result.plan.startDate,
      preferredDays: result.plan.preferredDays ?? [],
      preferredLongRunDow: result.plan.preferredLongRunDow ?? null,
      preferredTempoDow: result.plan.preferredTempoDow ?? null,
      preferredIntervalDow: result.plan.preferredIntervalDow ?? null,
      currentFiveKPace: result.plan.currentFiveKPace,
      weeklyMileageTarget: result.plan.weeklyMileageTarget,
    },
    weeklyMileageTarget,
    minWeeklyMiles: 40,
  });

  return {
    membershipId: result.member.id,
    trainingPlanId: result.plan.id,
    goalId: result.goalId,
    alreadyMember: false,
  };
}
