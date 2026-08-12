/**
 * Plan-scoped race events: primary goal race + secondary calendar races.
 */

import {
  TrainingPlanRaceEventInclusion,
  TrainingPlanRaceEventRole,
  TrainingPlanRaceEventSource,
  TrainingPlanLifecycle,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { utcDateOnly } from "@/lib/training/plan-utils";
import {
  filterSignupsInPlanWindow,
  loadHydratedRaceCalendar,
  type HydratedRaceCalendarSignup,
} from "@/lib/training/race-calendar-hydrate";

export type PlanRaceEventRow = {
  id: string;
  trainingPlanId: string;
  raceRegistryId: string;
  athleteRaceSignupId: string | null;
  role: TrainingPlanRaceEventRole;
  source: TrainingPlanRaceEventSource;
  inclusion: TrainingPlanRaceEventInclusion;
  raceName: string;
  raceDate: Date;
  distanceMeters: number | null;
  distanceLabel: string | null;
};

export async function syncPlanRaceEventsFromCalendar(params: {
  trainingPlanId: string;
  athleteId: string;
  /** Secondary signup IDs to include; omitted = all in-window calendar races except primary */
  includedSecondarySignupIds?: string[] | null;
}): Promise<PlanRaceEventRow[]> {
  const plan = await prisma.training_plans.findFirst({
    where: { id: params.trainingPlanId, athleteId: params.athleteId },
    include: {
      race_registry: { select: { id: true, name: true, raceDate: true, distanceMeters: true, distanceLabel: true } },
      athlete_goal: { select: { raceRegistryId: true } },
    },
  });
  if (!plan?.race_registry) {
    throw new Error("Plan not found or has no primary race");
  }

  const calendar = await loadHydratedRaceCalendar(params.athleteId);
  const inWindow = filterSignupsInPlanWindow(
    calendar.signups,
    plan.startDate,
    plan.race_registry.raceDate
  );

  const primaryRaceId = plan.raceId ?? plan.race_registry.id;
  const includedSet =
    params.includedSecondarySignupIds != null
      ? new Set(params.includedSecondarySignupIds)
      : null;

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.training_plan_race_events.deleteMany({
      where: { trainingPlanId: plan.id },
    });

    await tx.training_plan_race_events.create({
      data: {
        trainingPlanId: plan.id,
        raceRegistryId: primaryRaceId,
        role: TrainingPlanRaceEventRole.PRIMARY,
        source: TrainingPlanRaceEventSource.GOAL,
        inclusion: TrainingPlanRaceEventInclusion.INCLUDED,
        updatedAt: now,
      },
    });

    for (const signup of inWindow) {
      if (signup.raceRegistryId === primaryRaceId) continue;
      const inclusion =
        includedSet == null || includedSet.has(signup.signupId)
          ? TrainingPlanRaceEventInclusion.INCLUDED
          : TrainingPlanRaceEventInclusion.EXCLUDED;
      await tx.training_plan_race_events.create({
        data: {
          trainingPlanId: plan.id,
          raceRegistryId: signup.raceRegistryId,
          athleteRaceSignupId: signup.signupId,
          role: TrainingPlanRaceEventRole.SECONDARY,
          source: TrainingPlanRaceEventSource.CALENDAR,
          inclusion,
          updatedAt: now,
        },
      });
    }
  });

  return loadPlanRaceEvents(params.trainingPlanId);
}

export async function loadPlanRaceEvents(trainingPlanId: string): Promise<PlanRaceEventRow[]> {
  const rows = await prisma.training_plan_race_events.findMany({
    where: { trainingPlanId },
    include: {
      race_registry: {
        select: {
          name: true,
          raceDate: true,
          distanceMeters: true,
          distanceLabel: true,
        },
      },
    },
    orderBy: { race_registry: { raceDate: "asc" } },
  });

  return rows.map((r) => ({
    id: r.id,
    trainingPlanId: r.trainingPlanId,
    raceRegistryId: r.raceRegistryId,
    athleteRaceSignupId: r.athleteRaceSignupId,
    role: r.role,
    source: r.source,
    inclusion: r.inclusion,
    raceName: r.race_registry.name,
    raceDate: r.race_registry.raceDate,
    distanceMeters: r.race_registry.distanceMeters,
    distanceLabel: r.race_registry.distanceLabel,
  }));
}

export async function loadIncludedPlanRaceEventsForGeneration(
  trainingPlanId: string
): Promise<{ primary: PlanRaceEventRow | null; secondary: PlanRaceEventRow[] }> {
  const all = await loadPlanRaceEvents(trainingPlanId);
  const included = all.filter((e) => e.inclusion === TrainingPlanRaceEventInclusion.INCLUDED);
  const primary = included.find((e) => e.role === TrainingPlanRaceEventRole.PRIMARY) ?? null;
  const secondary = included.filter((e) => e.role === TrainingPlanRaceEventRole.SECONDARY);
  return { primary, secondary };
}

export async function listSecondaryCandidatesForPlan(params: {
  athleteId: string;
  planStart: Date;
  primaryRaceDate: Date;
}): Promise<HydratedRaceCalendarSignup[]> {
  const calendar = await loadHydratedRaceCalendar(params.athleteId);
  return filterSignupsInPlanWindow(calendar.signups, params.planStart, params.primaryRaceDate).filter(
    (s) => s.calendarRole === "OTHER"
  );
}

export async function findActivePlanForAthlete(athleteId: string) {
  return prisma.training_plans.findFirst({
    where: { athleteId, lifecycleStatus: TrainingPlanLifecycle.ACTIVE },
    orderBy: { updatedAt: "desc" },
    include: {
      race_registry: {
        select: { id: true, name: true, raceDate: true, distanceMeters: true, distanceLabel: true },
      },
    },
  });
}

/** Whether a newly added signup falls inside an active plan window. */
export async function signupAffectsActivePlan(params: {
  athleteId: string;
  raceRegistryId: string;
  raceDate: Date;
}): Promise<{
  affectsPlan: boolean;
  planId: string | null;
  weekNumber: number | null;
  planName: string | null;
}> {
  const plan = await findActivePlanForAthlete(params.athleteId);
  if (!plan?.race_registry) {
    return { affectsPlan: false, planId: null, weekNumber: null, planName: null };
  }
  if (params.raceRegistryId === plan.raceId) {
    return { affectsPlan: false, planId: plan.id, weekNumber: null, planName: plan.name };
  }
  const raceMs = utcDateOnly(params.raceDate).getTime();
  const startMs = utcDateOnly(plan.startDate).getTime();
  const endMs = utcDateOnly(plan.race_registry.raceDate).getTime();
  if (raceMs < startMs || raceMs > endMs) {
    return { affectsPlan: false, planId: plan.id, weekNumber: null, planName: plan.name };
  }

  const { currentTrainingWeekNumber } = await import("@/lib/training/plan-utils");
  const weekNumber = currentTrainingWeekNumber(plan.startDate, plan.totalWeeks, params.raceDate);
  return {
    affectsPlan: true,
    planId: plan.id,
    weekNumber,
    planName: plan.name,
  };
}
