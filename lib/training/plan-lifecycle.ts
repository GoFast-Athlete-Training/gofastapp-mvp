/**
 * Plan lifecycle — ACTIVE, PAUSED, ARCHIVED.
 *
 * Pause is an explicit athlete stop (injury, time off). Regenerate rewrites
 * schedule JSON on the same row. A new plan deletes the current row first.
 */

import { TrainingPlanLifecycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rematerializeFuturePlannedWorkoutsForPlan } from "@/lib/training/rematerialize-future-planned-workouts";
import { productTodayKey, resolveRaceDayKey } from "@/lib/plan-calendar-day";
import { raceCalendarBeforeTodayUtc } from "@/lib/training/plan-utils";
import { cleanupFutureGarminSchedulesForPlan } from "@/lib/training/plan-garmin-cleanup";
import { cleanupFutureWorkoutsForRetiredPlan } from "@/lib/training/plan-regenerate-cleanup";
import { cleanupPlanWorkoutsBeforeDelete } from "@/lib/training/plan-delete-cleanup";
import { shouldAutoArchivePlanForRaceDate } from "@/lib/training/race-plan-closeout";

/** Race calendar day strictly before product today — aligns with training hub "past race" treatment. */
export function isRaceCalendarBeforeTodayUtc(
  raceDate: Date | string | null | undefined
): boolean {
  if (raceDate == null) return false;
  if (typeof raceDate === "string") {
    return raceCalendarBeforeTodayUtc(raceDate);
  }
  return raceCalendarBeforeTodayUtc(resolveRaceDayKey({ raceDate, raceDay: null }));
}

/**
 * When a plan is archived: goals live on athlete_races and stay as history.
 * No separate goal status to cascade.
 */
export async function cascadeLinkedGoalAfterPlanArchived(
  _planId: string,
  _athleteId: string
): Promise<void> {
  /* no-op — goal is on athlete_races row */
}

/** Remove one plan row. Completed workouts stay on the log, detached from the plan. */
export async function deleteTrainingPlan(params: {
  athleteId: string;
  planId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.training_plans.findFirst({
    where: { id: params.planId, athleteId: params.athleteId },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Plan not found" };

  await cleanupFutureGarminSchedulesForPlan({
    planId: params.planId,
    athleteId: params.athleteId,
  });
  await cleanupPlanWorkoutsBeforeDelete({
    planId: params.planId,
    athleteId: params.athleteId,
  });
  await prisma.training_plans.delete({ where: { id: params.planId } });
  return { ok: true };
}

export type DeleteActiveForNewPlanResult =
  | { ok: true; deletedPlanId: string | null }
  | {
      ok: false;
      status: "regenerate" | "conflict";
      error: string;
      existingPlanId: string;
    };

/**
 * Starting a new plan deletes the current active row. It never pauses.
 * The same race must regenerate the existing plan instead.
 */
export async function deleteActivePlanForNewPlan(params: {
  athleteId: string;
  replace: boolean;
  sameAthleteRaceId?: string | null;
}): Promise<DeleteActiveForNewPlanResult> {
  const existing = await prisma.training_plans.findFirst({
    where: {
      athleteId: params.athleteId,
      lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
    },
    select: { id: true, athleteRaceId: true },
  });
  if (!existing) return { ok: true, deletedPlanId: null };

  if (
    params.sameAthleteRaceId &&
    existing.athleteRaceId === params.sameAthleteRaceId
  ) {
    return {
      ok: false,
      status: "regenerate",
      existingPlanId: existing.id,
      error:
        "You already have an active plan for this race. Regenerate it instead of creating a new one.",
    };
  }

  if (!params.replace) {
    return {
      ok: false,
      status: "conflict",
      existingPlanId: existing.id,
      error:
        "You already have an active training plan. Delete it before starting a new one.",
    };
  }

  const deleted = await deleteTrainingPlan({
    athleteId: params.athleteId,
    planId: existing.id,
  });
  if (!deleted.ok) {
    return {
      ok: false,
      status: "conflict",
      existingPlanId: existing.id,
      error: deleted.error,
    };
  }
  return { ok: true, deletedPlanId: existing.id };
}

/** Athlete asked to stop the active plan and pick it up later. */
export async function pauseTrainingPlan(params: {
  athleteId: string;
  planId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await prisma.training_plans.findFirst({
    where: {
      id: params.planId,
      athleteId: params.athleteId,
      lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
    },
    select: { id: true },
  });
  if (!row) return { ok: false, error: "Only the active plan can be paused" };

  await prisma.training_plans.update({
    where: { id: params.planId },
    data: {
      lifecycleStatus: TrainingPlanLifecycle.PAUSED,
      updatedAt: new Date(),
    },
  });
  await cleanupFutureGarminSchedulesForPlan({
    planId: params.planId,
    athleteId: params.athleteId,
  });
  await cleanupFutureWorkoutsForRetiredPlan({
    planId: params.planId,
    athleteId: params.athleteId,
  });
  return { ok: true };
}

/** Turn a paused plan back on. Does not pause or archive any other plan. */
export async function resumePausedPlan(params: {
  athleteId: string;
  planId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const paused = await prisma.training_plans.findFirst({
    where: {
      id: params.planId,
      athleteId: params.athleteId,
      lifecycleStatus: TrainingPlanLifecycle.PAUSED,
    },
    select: { id: true },
  });
  if (!paused) return { ok: false, error: "Paused plan not found" };

  const otherActive = await prisma.training_plans.findFirst({
    where: {
      athleteId: params.athleteId,
      lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
      NOT: { id: params.planId },
    },
    select: { id: true },
  });
  if (otherActive) {
    return {
      ok: false,
      error: "Delete or archive your active plan before resuming this one.",
    };
  }

  await prisma.training_plans.update({
    where: { id: params.planId },
    data: {
      lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
      updatedAt: new Date(),
    },
  });
  return { ok: true };
}

/** Archive every ACTIVE plan for this athlete except the given id (if provided). */
export async function archiveOtherActivePlans(
  athleteId: string,
  exceptPlanId?: string | null
): Promise<void> {
  const toArchive = await prisma.training_plans.findMany({
    where: {
      athleteId,
      lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
      ...(exceptPlanId ? { NOT: { id: exceptPlanId } } : {}),
    },
    select: { id: true },
  });

  await prisma.training_plans.updateMany({
    where: {
      athleteId,
      lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
      ...(exceptPlanId ? { NOT: { id: exceptPlanId } } : {}),
    },
    data: {
      lifecycleStatus: TrainingPlanLifecycle.ARCHIVED,
      updatedAt: new Date(),
    },
  });

  await Promise.all(
    toArchive.map(async (p) => {
      await cascadeLinkedGoalAfterPlanArchived(p.id, athleteId);
      await cleanupFutureGarminSchedulesForPlan({
        planId: p.id,
        athleteId,
      });
      await cleanupFutureWorkoutsForRetiredPlan({
        planId: p.id,
        athleteId,
      });
    })
  );
}

/** Archive one ACTIVE plan for this athlete (cleanup + cascade). */
export async function archiveTrainingPlan(
  athleteId: string,
  planId: string
): Promise<boolean> {
  const row = await prisma.training_plans.findFirst({
    where: {
      id: planId,
      athleteId,
      lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
    },
    select: { id: true },
  });
  if (!row) return false;

  await prisma.training_plans.update({
    where: { id: planId },
    data: {
      lifecycleStatus: TrainingPlanLifecycle.ARCHIVED,
      updatedAt: new Date(),
    },
  });

  await cascadeLinkedGoalAfterPlanArchived(planId, athleteId);
  await cleanupFutureGarminSchedulesForPlan({ planId, athleteId });
  await cleanupFutureWorkoutsForRetiredPlan({ planId, athleteId });
  return true;
}

/**
 * Auto-archive ACTIVE plans whose race is past the close-out window (2+ days after race day).
 */
export async function ensureRetiredActivePlansForPastRaces(
  athleteId: string
): Promise<string[]> {
  const activePlans = await prisma.training_plans.findMany({
    where: {
      athleteId,
      lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
    },
    select: {
      id: true,
      athlete_race: { select: { raceDate: true } },
      race_registry: { select: { raceDate: true } },
    },
  });

  const archivedIds: string[] = [];
  for (const plan of activePlans) {
    const raceDate =
      plan.athlete_race?.raceDate ?? plan.race_registry?.raceDate ?? null;
    if (!shouldAutoArchivePlanForRaceDate(raceDate)) continue;
    const ok = await archiveTrainingPlan(athleteId, plan.id);
    if (ok) archivedIds.push(plan.id);
  }
  return archivedIds;
}

/** Rebuild today + future planned workouts from Athlete.fiveKPace. */
export async function syncAthleteFiveKPaceToActivePlan(athleteId: string): Promise<void> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { fiveKPace: true },
  });
  if (!athlete) return;

  const pace = athlete.fiveKPace?.trim() || null;
  if (!pace) return;

  const active = await prisma.training_plans.findFirst({
    where: { athleteId, lifecycleStatus: TrainingPlanLifecycle.ACTIVE },
    select: { id: true },
  });
  if (!active) return;

  try {
    await rematerializeFuturePlannedWorkoutsForPlan({
      athleteId,
      planId: active.id,
      fromDateKey: productTodayKey(),
      refreshFromAthleteFiveK: true,
    });
  } catch (err) {
    console.error("rematerializeFuturePlannedWorkoutsForPlan after 5K sync:", err);
  }
}
