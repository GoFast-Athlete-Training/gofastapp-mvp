import { prisma } from '@/lib/prisma';

export type StampPlannedCityRunResult =
  | { ok: true; plannedWorkoutId: string }
  | { ok: false; code: 'not_found' | 'already_stamped'; message: string };

/** Athlete plan day ↔ meetup link: planned_workouts.cityRunId (not city_runs.workoutId). */
export async function stampPlannedWorkoutCityRun(
  plannedWorkoutId: string,
  athleteId: string,
  cityRunId: string
): Promise<StampPlannedCityRunResult> {
  const row = await prisma.planned_workouts.findFirst({
    where: { id: plannedWorkoutId, athleteId },
    select: { id: true, cityRunId: true },
  });

  if (!row) {
    return {
      ok: false,
      code: 'not_found',
      message: 'Planned workout not found for this athlete.',
    };
  }

  if (row.cityRunId && row.cityRunId !== cityRunId) {
    return {
      ok: false,
      code: 'already_stamped',
      message: 'This plan day already has a meetup linked.',
    };
  }

  if (row.cityRunId === cityRunId) {
    return { ok: true, plannedWorkoutId: row.id };
  }

  await prisma.planned_workouts.update({
    where: { id: row.id },
    data: { cityRunId, updatedAt: new Date() },
  });

  return { ok: true, plannedWorkoutId: row.id };
}
