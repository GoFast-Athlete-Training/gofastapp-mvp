/**
 * Plan lifecycle — ACTIVE, PARKED, ARCHIVED.
 */

import { TrainingPlanLifecycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rematerializeFuturePlannedWorkoutsForPlan } from "@/lib/training/rematerialize-future-planned-workouts";
import { utcDateOnly } from "@/lib/training/plan-utils";
import { cleanupFutureGarminSchedulesForPlan } from "@/lib/training/plan-garmin-cleanup";
import { cleanupFutureWorkoutsForRetiredPlan } from "@/lib/training/plan-regenerate-cleanup";

/** Race calendar day strictly before today (UTC) — aligns with training hub "past race" treatment. */
export function isRaceCalendarBeforeTodayUtc(raceDate: Date | null | undefined): boolean {
  if (!raceDate) return false;
  const raceDay = utcDateOnly(raceDate);
  const today = utcDateOnly(new Date());
  return raceDay.getTime() < today.getTime();
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

/** Mark every ACTIVE plan for this athlete as PARKED (explicit replace, not archive). */
export async function parkOtherActivePlans(
  athleteId: string,
  exceptPlanId?: string | null
): Promise<void> {
  const toPark = await prisma.training_plans.findMany({
    where: {
      athleteId,
      lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
      ...(exceptPlanId ? { NOT: { id: exceptPlanId } } : {}),
    },
    select: { id: true },
  });

  if (toPark.length === 0) return;

  await prisma.training_plans.updateMany({
    where: {
      athleteId,
      lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
      ...(exceptPlanId ? { NOT: { id: exceptPlanId } } : {}),
    },
    data: {
      lifecycleStatus: TrainingPlanLifecycle.PARKED,
      updatedAt: new Date(),
    },
  });

  await Promise.all(
    toPark.map(async (p) => {
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

/** @deprecated use parkOtherActivePlans */
export const markOtherActivePlansAsUnused = parkOtherActivePlans;

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

export type RetireActivePlanMode = "park" | "archive";

/** Retire the current ACTIVE plan when replacing with a new one. */
export async function retireActivePlanForReplace(
  athleteId: string,
  mode: RetireActivePlanMode
): Promise<void> {
  if (mode === "archive") {
    await archiveOtherActivePlans(athleteId);
  } else {
    await parkOtherActivePlans(athleteId);
  }
}

/** Reactivate a PARKED plan; park the current ACTIVE plan. */
export async function restoreParkedPlan(params: {
  athleteId: string;
  parkedPlanId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parked = await prisma.training_plans.findFirst({
    where: {
      id: params.parkedPlanId,
      athleteId: params.athleteId,
      lifecycleStatus: TrainingPlanLifecycle.PARKED,
    },
    select: { id: true },
  });
  if (!parked) {
    return { ok: false, error: "Parked plan not found" };
  }

  const outgoingActive = await prisma.training_plans.findMany({
    where: {
      athleteId: params.athleteId,
      lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
      NOT: { id: params.parkedPlanId },
    },
    select: { id: true },
  });

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.training_plans.updateMany({
      where: {
        athleteId: params.athleteId,
        lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
        NOT: { id: params.parkedPlanId },
      },
      data: {
        lifecycleStatus: TrainingPlanLifecycle.PARKED,
        updatedAt: now,
      },
    });
    await tx.training_plans.update({
      where: { id: params.parkedPlanId },
      data: {
        lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
        updatedAt: now,
      },
    });
  });

  await Promise.all(
    outgoingActive.map(async (p) => {
      await cleanupFutureGarminSchedulesForPlan({
        planId: p.id,
        athleteId: params.athleteId,
      });
      await cleanupFutureWorkoutsForRetiredPlan({
        planId: p.id,
        athleteId: params.athleteId,
      });
    })
  );

  return { ok: true };
}

/** Copy Athlete.fiveKPace onto the single ACTIVE training plan (if any). */
export async function syncAthleteFiveKPaceToActivePlan(athleteId: string): Promise<void> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { fiveKPace: true },
  });
  if (!athlete) return;

  const pace = athlete.fiveKPace?.trim() || null;

  const active = await prisma.training_plans.findFirst({
    where: { athleteId, lifecycleStatus: TrainingPlanLifecycle.ACTIVE },
    select: { id: true },
  });
  if (!active) return;

  await prisma.training_plans.update({
    where: { id: active.id },
    data: {
      currentFiveKPace: pace,
      updatedAt: new Date(),
    },
  });

  if (pace) {
    try {
      await rematerializeFuturePlannedWorkoutsForPlan({
        athleteId,
        planId: active.id,
      });
    } catch (err) {
      console.error("rematerializeFuturePlannedWorkoutsForPlan after 5K sync:", err);
    }
  }
}
