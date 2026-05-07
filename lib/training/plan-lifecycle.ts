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
 * When a plan is archived: if it still points at an ACTIVE goal, set goal to COMPLETED
 * (race day is in the past) or ARCHIVED (mid-plan / future race).
 */
export async function cascadeLinkedGoalAfterPlanArchived(
  planId: string,
  athleteId: string
): Promise<void> {
  const plan = await prisma.training_plans.findFirst({
    where: { id: planId, athleteId },
    select: {
      athleteGoalId: true,
      race_registry: { select: { raceDate: true } },
    },
  });
  if (!plan?.athleteGoalId) return;

  let raceDate = plan.race_registry?.raceDate ?? null;
  const goalRow = await prisma.athleteGoal.findFirst({
    where: { id: plan.athleteGoalId, athleteId },
    include: { race_registry: { select: { raceDate: true } } },
  });
  if (!goalRow || goalRow.status !== "ACTIVE") return;

  if (raceDate == null) {
    raceDate = goalRow.race_registry?.raceDate ?? null;
  }

  const racePast = isRaceCalendarBeforeTodayUtc(raceDate);

  await prisma.athleteGoal.update({
    where: { id: goalRow.id },
    data: {
      status: racePast ? "COMPLETED" : "ARCHIVED",
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
