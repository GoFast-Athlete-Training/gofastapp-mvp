import { prisma } from "@/lib/prisma";

export type WorkoutAdherence = {
  planned: number;
  completed: number;
};

/** Planned-workout totals for staff roster rows. One grouped query, not per plan. */
export async function workoutAdherenceByPlanIds(
  planIds: string[],
): Promise<Map<string, WorkoutAdherence>> {
  const map = new Map<string, WorkoutAdherence>();
  for (const id of planIds) map.set(id, { planned: 0, completed: 0 });
  if (planIds.length === 0) return map;

  const groups = await prisma.planned_workouts.groupBy({
    by: ["planId", "workoutCompleted"],
    where: { planId: { in: planIds } },
    _count: { id: true },
  });

  for (const group of groups) {
    if (!group.planId) continue;
    const row = map.get(group.planId) ?? { planned: 0, completed: 0 };
    row.planned += group._count.id;
    if (group.workoutCompleted) row.completed += group._count.id;
    map.set(group.planId, row);
  }

  return map;
}
