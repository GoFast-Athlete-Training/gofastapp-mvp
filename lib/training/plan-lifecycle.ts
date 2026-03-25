import { prisma } from "@/lib/prisma";
import { TrainingPlanLifecycle } from "@prisma/client";

/** Archive every ACTIVE plan for this athlete except the given id (if provided). */
export async function archiveOtherActivePlans(
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
      lifecycleStatus: TrainingPlanLifecycle.ARCHIVED,
      updatedAt: new Date(),
    },
  });
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
