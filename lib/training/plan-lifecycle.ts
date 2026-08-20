import { prisma } from "@/lib/prisma";
import { TrainingPlanLifecycle } from "@prisma/client";
import { utcDateOnly } from "@/lib/training/plan-utils";

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

/** Mark every ACTIVE plan for this athlete as OLD_PLAN_UNUSED (explicit replace, not archive). */
export async function markOtherActivePlansAsUnused(
  athleteId: string,
  exceptPlanId?: string | null
): Promise<void> {
  await prisma.training_plans.updateMany({
    where: {
      athleteId,
      lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
      ...(exceptPlanId ? { NOT: { id: exceptPlanId } } : {}),
    },
    data: {
      lifecycleStatus: TrainingPlanLifecycle.OLD_PLAN_UNUSED,
      updatedAt: new Date(),
    },
  });
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
    toArchive.map((p) => cascadeLinkedGoalAfterPlanArchived(p.id, athleteId))
  );
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
}
