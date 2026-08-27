/**
 * Deep-clone rotation configs from a staff catalog preset onto athlete-owned config rows.
 * @deprecated Long Run/Easy use shared configs + ordering overlays; Tempo/Interval use athlete-owned configs.
 */

import { setupAthleteRotationsFromSource } from "@/lib/training/athlete-rotation-setup";
import { mergeCoachPlanOverview } from "@/lib/training/athlete-preset-coach-overview";
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

/** Copy generation blueprint from staff preset; merge overview fields athlete infer owns. */
export async function seedWorkoutBlueprintFromSource(params: {
  athletePresetId: string;
  sourcePresetId: string;
}): Promise<void> {
  const [source, athlete] = await Promise.all([
    prisma.training_plan_preset.findUnique({
      where: { id: params.sourcePresetId },
      select: {
        workoutStructure: true,
        coachPlanOverview: true,
        easyRunConfig: true,
      },
    }),
    prisma.athlete_presets.findUnique({
      where: { id: params.athletePresetId },
      select: { coachPlanOverview: true },
    }),
  ]);
  if (!source) {
    throw new Error("Source preset not found");
  }

  const sourceOverview =
    source.coachPlanOverview != null &&
    typeof source.coachPlanOverview === "object" &&
    !Array.isArray(source.coachPlanOverview)
      ? (source.coachPlanOverview as Record<string, unknown>)
      : null;

  const generationPatch: Record<string, unknown> = { easyConfirmed: true };
  if (sourceOverview?.weeklyWorkoutComposition != null) {
    generationPatch.weeklyWorkoutComposition = sourceOverview.weeklyWorkoutComposition;
  }

  await prisma.athlete_presets.update({
    where: { id: params.athletePresetId },
    data: {
      workoutStructure: source.workoutStructure ?? undefined,
      coachPlanOverview: mergeCoachPlanOverview(athlete?.coachPlanOverview, generationPatch),
      easyRunConfig: source.easyRunConfig ?? undefined,
      updatedAt: new Date(),
    },
  });
}
