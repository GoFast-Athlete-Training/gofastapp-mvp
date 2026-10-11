import type { AthletePresetFitnessPhase } from "@prisma/client";
import type { ResolvedPlanBlueprint } from "@/lib/training/resolve-plan-blueprint";
import type { TrainingManagePresetForGenerate } from "@/lib/training/fetch-training-manage-preset-for-generate";
import type { RotationBlueprintSource } from "@/lib/training/plan-generate-presets-loader";

function rotationConfigFromPhase(
  config: NonNullable<TrainingManagePresetForGenerate["build"]>["longRunConfig"],
): RotationBlueprintSource["longRunConfig"] {
  if (!config) return null;
  return {
    id: config.id,
    name: config.name,
    positions: config.positions.map((p) => ({
      cyclePosition: p.cyclePosition,
      catalogueWorkoutId: p.catalogueWorkoutId,
      distributionWeight: p.distributionWeight,
    })),
  } as RotationBlueprintSource["longRunConfig"];
}

/** Map Training Manage for-generate payload → prod generator blueprint (no prod catalog row). */
export function resolvedBlueprintFromTrainingManage(
  tm: TrainingManagePresetForGenerate,
): ResolvedPlanBlueprint {
  const build = tm.build;
  if (!build) {
    throw new Error("Training Manage preset has no build phase or rotations");
  }

  const peakPool =
    build.peakLongRunMiles != null && Number.isFinite(build.peakLongRunMiles)
      ? build.peakLongRunMiles * 4
      : 0;

  const rotationPreset = {
    longRunConfig: rotationConfigFromPhase(build.longRunConfig),
    intervalsConfig: rotationConfigFromPhase(build.intervalsConfig),
    tempoConfig: rotationConfigFromPhase(build.tempoConfig),
    easyConfig: rotationConfigFromPhase(build.easyConfig),
    coachPlanOverview: tm.coachPlanOverview,
    workoutStructure: tm.workoutStructure,
    easyRunConfig: tm.easyRunConfig,
    slug: tm.slug,
    title: tm.title,
  } as RotationBlueprintSource;

  const volumePreset = {
    minWeeklyMiles: tm.minWeeklyMiles,
    maxWeeklyMiles: tm.maxWeeklyMiles,
    baseLongRunPoolMiles: peakPool > 0 ? peakPool * 0.6 : 24,
    peakLongRunPoolMiles: peakPool > 0 ? peakPool : 32,
    taperLongRunPoolMiles: peakPool > 0 ? peakPool * 0.5 : 16,
    tempoIdealDow: tm.tempoIdealDow,
    intervalIdealDow: tm.intervalIdealDow,
    longRunDefaultDow: tm.longRunDefaultDow,
    slug: tm.slug,
    title: tm.title,
  };

  return {
    kind: "catalog",
    presetId: tm.id,
    athletePresetId: null,
    rotationPreset,
    volumePreset,
    label: tm.title,
    fitnessPhase: "BASE" as AthletePresetFitnessPhase,
  };
}
