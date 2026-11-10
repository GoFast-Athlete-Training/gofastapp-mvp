/**
 * Resolve catalog or athlete-owned blueprint for plan generation.
 */

import { prisma } from "@/lib/prisma";
import {
  athletePresetInclude,
  presetToPlanGenConfig,
  type LoadedAthletePresetInclude,
  type PlanVolumePreset,
  type RotationBlueprintSource,
} from "@/lib/training/plan-generate-presets-loader";
import {
  athletePresetAsRotationSource,
  isAthletePresetBlueprintComplete,
} from "@/lib/training/athlete-preset-blueprint";
import type { AthletePresetFitnessPhase } from "@prisma/client";
import { loadPresetForGenerateFromProd } from "@/lib/training/load-preset-for-generate-prod";
import { resolvedBlueprintFromTrainingManage } from "@/lib/training/training-manage-blueprint";

export type ResolvedPlanBlueprint = {
  kind: "catalog" | "athlete";
  presetId: string | null;
  athletePresetId: string | null;
  /** Rotation + strategy source for generate / materialize. */
  rotationPreset: RotationBlueprintSource;
  volumePreset: PlanVolumePreset;
  label: string;
  fitnessPhase: AthletePresetFitnessPhase;
};

export async function loadPlanBlueprintForGenerate(params: {
  athleteId: string;
  planId: string;
}): Promise<ResolvedPlanBlueprint | null> {
  const plan = await prisma.training_plans.findFirst({
    where: { id: params.planId, athleteId: params.athleteId },
    select: { presetId: true, athletePresetId: true },
  });
  if (!plan) return null;

  if (plan.athletePresetId) {
    const athletePreset = await prisma.athlete_presets.findFirst({
      where: { id: plan.athletePresetId, athleteId: params.athleteId },
      include: athletePresetInclude,
    });
    if (!athletePreset) return null;

    if (!isAthletePresetBlueprintComplete(athletePreset)) {
      return null;
    }

    const rotationPreset = athletePresetAsRotationSource(
      athletePreset as LoadedAthletePresetInclude
    ) as unknown as RotationBlueprintSource;

    const volumePreset = {
      minWeeklyMiles: athletePreset.minWeeklyMiles,
      maxWeeklyMiles: athletePreset.maxWeeklyMiles,
      baseLongRunPoolMiles: athletePreset.baseLongRunPoolMiles,
      peakLongRunPoolMiles: athletePreset.peakLongRunPoolMiles,
      taperLongRunPoolMiles: athletePreset.taperLongRunPoolMiles,
      tempoIdealDow: athletePreset.tempoIdealDow,
      intervalIdealDow: athletePreset.intervalIdealDow,
      longRunDefaultDow: athletePreset.longRunDefaultDow,
      slug: rotationPreset.slug ?? `athlete-${athletePreset.id}`,
      title: athletePreset.title,
    };

    return {
      kind: "athlete",
      presetId: null,
      athletePresetId: athletePreset.id,
      rotationPreset,
      volumePreset,
      label: athletePreset.title,
      fitnessPhase: athletePreset.fitnessPhase,
    };
  }

  if (plan.presetId) {
    const preset = await prisma.training_plan_preset.findUnique({
      where: { id: plan.presetId },
      select: {
        minWeeklyMiles: true,
        maxWeeklyMiles: true,
        tempoIdealDow: true,
        intervalIdealDow: true,
        longRunDefaultDow: true,
        slug: true,
        title: true,
      },
    });
    const phase = await loadPresetForGenerateFromProd(plan.presetId);
    if (!preset || !phase?.build) return null;

    const base = resolvedBlueprintFromTrainingManage(phase);
    return {
      ...base,
      volumePreset: {
        ...base.volumePreset,
        minWeeklyMiles: preset.minWeeklyMiles,
        maxWeeklyMiles: preset.maxWeeklyMiles,
        tempoIdealDow: preset.tempoIdealDow,
        intervalIdealDow: preset.intervalIdealDow,
        longRunDefaultDow: preset.longRunDefaultDow,
        slug: preset.slug,
        title: preset.title,
      },
    };
  }

  return null;
}

export function blueprintToPlanGenConfig(blueprint: ResolvedPlanBlueprint) {
  return presetToPlanGenConfig(blueprint.volumePreset);
}
