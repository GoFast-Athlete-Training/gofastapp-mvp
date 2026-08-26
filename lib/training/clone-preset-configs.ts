/**
 * Deep-clone rotation configs from a staff catalog preset onto athlete-owned config rows.
 * @deprecated Long Run/Easy use shared configs + ordering overlays; Tempo/Interval use athlete-owned configs.
 */

import { setupAthleteRotationsFromSource } from "@/lib/training/athlete-rotation-setup";
import { prisma } from "@/lib/prisma";

/** @deprecated use setupAthleteRotationsFromSource */
export async function cloneRotationsFromSourcePreset(params: {
  athletePresetId: string;
  sourcePresetId: string;
}): Promise<{
  longRunConfigId: string | null;
  easyConfigId: string | null;
  intervalsConfigId: string | null;
  tempoConfigId: string | null;
}> {
  await setupAthleteRotationsFromSource(params);
  const row = await import("@/lib/prisma").then(({ prisma }) =>
    prisma.athlete_presets.findUnique({
      where: { id: params.athletePresetId },
      select: {
        longRunConfigId: true,
        easyConfigId: true,
        tempoConfigId: true,
        intervalsConfigId: true,
      },
    })
  );
  return {
    longRunConfigId: row?.longRunConfigId ?? null,
    easyConfigId: row?.easyConfigId ?? null,
    intervalsConfigId: row?.intervalsConfigId ?? null,
    tempoConfigId: row?.tempoConfigId ?? null,
  };
}

export { setupAthleteRotationsFromSource };

/** Copy workoutStructure, coachPlanOverview, easyRunConfig from source catalog preset. */
export async function seedWorkoutBlueprintFromSource(params: {
  athletePresetId: string;
  sourcePresetId: string;
}): Promise<void> {
  const source = await prisma.training_plan_preset.findUnique({
    where: { id: params.sourcePresetId },
    select: {
      workoutStructure: true,
      coachPlanOverview: true,
      easyRunConfig: true,
    },
  });
  if (!source) {
    throw new Error("Source preset not found");
  }

  await prisma.athlete_presets.update({
    where: { id: params.athletePresetId },
    data: {
      workoutStructure: source.workoutStructure ?? undefined,
      coachPlanOverview: source.coachPlanOverview ?? undefined,
      easyRunConfig: source.easyRunConfig ?? undefined,
      updatedAt: new Date(),
    },
  });
}
