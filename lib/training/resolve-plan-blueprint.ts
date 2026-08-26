/**
 * Resolve catalog or athlete-owned blueprint for plan generation.
 */

import { prisma } from "@/lib/prisma";
import {
  athletePresetInclude,
  presetToPlanGenConfig,
  trainingPlanPresetInclude,
  type LoadedAthletePresetInclude,
  type LoadedPresetInclude,
  type RotationBlueprintSource,
} from "@/lib/training/plan-generate-presets-loader";
import {
  athletePresetAsRotationSource,
  isAthletePresetBlueprintComplete,
} from "@/lib/training/athlete-preset-blueprint";
import type { training_plan_preset } from "@prisma/client";

export type ResolvedPlanBlueprint = {
  kind: "catalog" | "athlete";
  presetId: string | null;
  athletePresetId: string | null;
  /** Rotation + strategy source for generate / materialize. */
  rotationPreset: RotationBlueprintSource;
  volumePreset: Pick<
    training_plan_preset,
    | "minWeeklyMiles"
    | "maxWeeklyMiles"
    | "baseLongRunPoolMiles"
    | "peakLongRunPoolMiles"
    | "taperLongRunPoolMiles"
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
