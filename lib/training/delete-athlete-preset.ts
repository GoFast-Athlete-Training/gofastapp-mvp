import { prisma } from "@/lib/prisma";

/** Delete athlete-owned preset. Shared catalog configs are never deleted. */
export async function deleteAthletePresetForAthlete(params: {
  athleteId: string;
  presetId: string;
}): Promise<{ deleted: true } | { deleted: false; reason: "not_found" | "linked_to_plan" }> {
  const row = await prisma.athlete_presets.findFirst({
    where: { id: params.presetId, athleteId: params.athleteId },
    select: { id: true },
  });
  if (!row) return { deleted: false, reason: "not_found" };

  const linkedPlan = await prisma.training_plans.findFirst({
    where: { athletePresetId: row.id },
    select: { id: true },
  });
  if (linkedPlan) return { deleted: false, reason: "linked_to_plan" };

  await prisma.athlete_presets.delete({ where: { id: row.id } });

  return { deleted: true };
}
