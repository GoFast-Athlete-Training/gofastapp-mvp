/**
 * Resolve catalog or athlete-owned blueprint for plan generation.
 */

import { prisma } from "@/lib/prisma";
import {
  presetToPlanGenConfig,
  trainingPlanPresetInclude,
  type LoadedPresetInclude,
} from "@/lib/training/plan-generate-presets-loader";
import type { training_plan_preset } from "@prisma/client";

export type ResolvedPlanBlueprint = {
  kind: "catalog" | "athlete";
  presetId: string | null;
  athletePresetId: string | null;
  /** Rotation source — always a staff catalog row when available. */
  rotationPreset: LoadedPresetInclude;
  volumePreset: Pick<
    training_plan_preset,
    | "cycleLen"
    | "minWeeklyMiles"
    | "maxWeeklyMiles"
    | "baseMiles"
    | "peakMiles"
    | "taperMiles"
    | "tempoIdealDow"
    | "intervalIdealDow"
    | "longRunDefaultDow"
    | "slug"
    | "title"
  >;
  label: string;
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
    });
    if (!athletePreset) return null;

    const rotationPresetId = athletePreset.sourcePresetId;
    if (!rotationPresetId) {
      return null;
    }

    const rotationPreset = await prisma.training_plan_preset.findUnique({
      where: { id: rotationPresetId },
      include: trainingPlanPresetInclude,
    });
    if (!rotationPreset) return null;

    const volumePreset = {
      cycleLen: athletePreset.cycleLen,
      minWeeklyMiles: athletePreset.minWeeklyMiles,
      maxWeeklyMiles: athletePreset.maxWeeklyMiles,
      baseMiles: athletePreset.baseMiles,
      peakMiles: athletePreset.peakMiles,
      taperMiles: athletePreset.taperMiles,
      tempoIdealDow: athletePreset.tempoIdealDow,
      intervalIdealDow: athletePreset.intervalIdealDow,
      longRunDefaultDow: athletePreset.longRunDefaultDow,
      slug: rotationPreset.slug,
      title: athletePreset.title,
    };

    return {
      kind: "athlete",
      presetId: null,
      athletePresetId: athletePreset.id,
      rotationPreset: rotationPreset as LoadedPresetInclude,
      volumePreset,
      label: athletePreset.title,
    };
  }

  if (plan.presetId) {
    const rawPreset = await prisma.training_plan_preset.findUnique({
      where: { id: plan.presetId },
      include: trainingPlanPresetInclude,
    });
    if (!rawPreset) return null;

    return {
      kind: "catalog",
      presetId: plan.presetId,
      athletePresetId: null,
      rotationPreset: rawPreset as LoadedPresetInclude,
      volumePreset: rawPreset,
      label: rawPreset.title,
    };
  }

  return null;
}

export function blueprintToPlanGenConfig(blueprint: ResolvedPlanBlueprint) {
  return presetToPlanGenConfig(blueprint.volumePreset);
}
