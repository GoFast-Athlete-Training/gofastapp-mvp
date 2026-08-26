import { prisma } from "@/lib/prisma";

/** Delete athlete-owned preset and any rotation configs only referenced by this row. */
export async function deleteAthletePresetForAthlete(params: {
  athleteId: string;
  presetId: string;
}): Promise<{ deleted: true } | { deleted: false; reason: "not_found" | "linked_to_plan" }> {
  const row = await prisma.athlete_presets.findFirst({
    where: { id: params.presetId, athleteId: params.athleteId },
    select: {
      id: true,
      longRunConfigId: true,
      easyConfigId: true,
      tempoConfigId: true,
      intervalsConfigId: true,
    },
  });
  if (!row) return { deleted: false, reason: "not_found" };

  const linkedPlan = await prisma.training_plans.findFirst({
    where: { athletePresetId: row.id },
    select: { id: true },
  });
  if (linkedPlan) return { deleted: false, reason: "linked_to_plan" };

  const configIds = [
    row.longRunConfigId,
    row.easyConfigId,
    row.tempoConfigId,
    row.intervalsConfigId,
  ].filter((id): id is string => Boolean(id));

  await prisma.athlete_presets.delete({ where: { id: row.id } });

  for (const configId of configIds) {
    const stillUsedByPreset = await prisma.training_plan_preset.count({
      where: {
        OR: [
          { longRunConfigId: configId },
          { easyConfigId: configId },
          { tempoConfigId: configId },
          { intervalsConfigId: configId },
        ],
      },
    });
    const stillUsedByAthlete = await prisma.athlete_presets.count({
      where: {
        OR: [
          { longRunConfigId: configId },
          { easyConfigId: configId },
          { tempoConfigId: configId },
          { intervalsConfigId: configId },
        ],
      },
    });
    if (stillUsedByPreset > 0 || stillUsedByAthlete > 0) continue;

    await prisma.long_run_config.deleteMany({ where: { id: configId } }).catch(() => {});
    await prisma.easy_config.deleteMany({ where: { id: configId } }).catch(() => {});
    await prisma.tempo_config.deleteMany({ where: { id: configId } }).catch(() => {});
    await prisma.intervals_config.deleteMany({ where: { id: configId } }).catch(() => {});
  }

  return { deleted: true };
}
