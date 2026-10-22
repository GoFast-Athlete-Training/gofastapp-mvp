import { prisma } from "@/lib/prisma";

/** Remove run-scoped prescribe template (city_runs.plannedWorkoutId), not training plan days. */
export async function clearRunPlannedWorkoutTemplate(cityRunId: string): Promise<void> {
  const id = cityRunId.trim();
  if (!id) return;

  const run = await prisma.city_runs.findUnique({
    where: { id },
    select: { plannedWorkoutId: true },
  });
  const templateId = run?.plannedWorkoutId?.trim();
  if (!templateId) return;

  await prisma.$transaction(async (tx) => {
    const template = await tx.planned_workouts.findUnique({
      where: { id: templateId },
      select: { planId: true, athleteId: true },
    });

    if (template && template.planId == null && template.athleteId == null) {
      await tx.planned_workout_segments.deleteMany({ where: { plannedWorkoutId: templateId } });
      await tx.planned_workouts.delete({ where: { id: templateId } });
    }

    await tx.city_runs.update({
      where: { id },
      data: { plannedWorkoutId: null, updatedAt: new Date() },
    });
  });
}
