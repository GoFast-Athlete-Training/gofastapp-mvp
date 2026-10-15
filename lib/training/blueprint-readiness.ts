import { prisma } from "@/lib/prisma";
import { calendarTrainingWeekCount } from "@/lib/training/plan-utils";
import { loadPresetForGenerateFromProd } from "@/lib/training/load-preset-for-generate-prod";
import { loadPlanBlueprintForGenerate } from "@/lib/training/resolve-plan-blueprint";
import { rotationMissingCatalogueWorkout } from "@/lib/training/run-type-config-validation";
import { mapPositionRow } from "@/lib/training/plan-generate-presets-loader";
import { positionsFromPhaseRotation } from "@/lib/training/apply-phase-preset-generate";
import { splitPlanWeekPhases } from "@/lib/training/plan-week-phase-split";
import { presetTaperHasVolumeCaps } from "@/lib/training/phase-week-pins";

const MIN_WEEKS_BY_DISTANCE: Record<string, number> = {
  marathon: 12,
  "half marathon": 10,
  "10k": 8,
  "5k": 6,
};

function minWeeksWarningThreshold(targetDistanceLabel: string | null | undefined): number {
  const key = (targetDistanceLabel ?? "").trim().toLowerCase();
  for (const [label, weeks] of Object.entries(MIN_WEEKS_BY_DISTANCE)) {
    if (key.includes(label)) return weeks;
  }
  return 10;
}

export type BlueprintReadinessResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  presetId: string | null;
  presetTitle: string | null;
  presetSlug: string | null;
  totalWeeks: number;
  weeksToGoal: number;
  buildWeekCount: number;
  taperWeekCount: number;
  hasBuild: boolean;
  hasTaper: boolean;
  hasRaceWeek: boolean;
  hasEasyRotation: boolean;
  taperUsesPresetCaps: boolean;
  targetDistanceLabel: string | null;
  shortPlanWarning: string | null;
};

export async function computeBlueprintReadiness(input: {
  athleteId: string;
  planId: string;
}): Promise<BlueprintReadinessResult | null> {
  const planRow = await prisma.training_plans.findFirst({
    where: { id: input.planId, athleteId: input.athleteId },
    include: {
      athlete_race: { select: { raceDate: true } },
    },
  });
  if (!planRow) return null;

  const blueprint = await loadPlanBlueprintForGenerate(input);
  const presetId = planRow.presetId ?? null;
  const phasePreset =
    presetId != null ? await loadPresetForGenerateFromProd(presetId) : null;

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!presetId) {
    errors.push("No training preset is linked on this plan.");
  }
  if (presetId && !phasePreset) {
    errors.push("Preset is not synced to prod — re-save in Training Manage.");
  }

  const start = planRow.startDate;
  const raceDate = planRow.athlete_race?.raceDate;
  const totalWeeks =
    start && raceDate
      ? calendarTrainingWeekCount(start, raceDate)
      : planRow.totalWeeks ?? 0;
  const phaseSplit = splitPlanWeekPhases(totalWeeks);

  const hasBuild = Boolean(phasePreset?.build?.longRunConfig?.positions?.length);
  const hasTaper = Boolean(phasePreset?.taper?.weeks?.length);
  const hasRaceWeek = Boolean(phasePreset?.raceWeek?.slots?.length);
  const taperUsesPresetCaps = presetTaperHasVolumeCaps(phasePreset?.taper?.weeks);

  if (phaseSplit.buildWeekNumbers.length > 0 && !hasBuild) {
    errors.push("This plan has build weeks but the preset has no build phase.");
  }
  if (!hasTaper) {
    warnings.push("Preset has no taper phase configured.");
  }
  if (!hasRaceWeek) {
    warnings.push("Preset has no race week slots — goal race day may use rotation defaults.");
  }

  const rotationPreset = blueprint?.rotationPreset ?? null;
  const easyPositions = phasePreset?.build?.easyConfig
    ? positionsFromPhaseRotation(phasePreset.build.easyConfig)
    : (rotationPreset &&
      "easyConfig" in rotationPreset &&
      rotationPreset.easyConfig?.positions
        ? rotationPreset.easyConfig.positions.map(mapPositionRow)
        : []);
  const hasEasyRotation = !rotationMissingCatalogueWorkout(easyPositions);
  if (!hasEasyRotation) {
    errors.push("Easy run rotation is not configured on this preset.");
  }

  if (!blueprint && presetId) {
    warnings.push(
      "Blueprint loader could not hydrate full rotation (often missing build phase on prod). Generate may fail until Training Manage re-syncs.",
    );
  }

  const threshold = minWeeksWarningThreshold(phasePreset?.targetDistanceLabel ?? null);
  let shortPlanWarning: string | null = null;
  if (totalWeeks > 0 && totalWeeks < threshold) {
    shortPlanWarning = `Only ${totalWeeks} training weeks to your goal — expect mostly taper/race unless you move the start date earlier.`;
    warnings.push(shortPlanWarning);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    presetId,
    presetTitle: phasePreset?.title ?? blueprint?.label ?? null,
    presetSlug: phasePreset?.slug ?? null,
    totalWeeks,
    weeksToGoal: totalWeeks,
    buildWeekCount: phaseSplit.buildWeekNumbers.length,
    taperWeekCount: phaseSplit.taperWeekNumbers.length,
    hasBuild,
    hasTaper,
    hasRaceWeek,
    hasEasyRotation,
    taperUsesPresetCaps,
    targetDistanceLabel: phasePreset?.targetDistanceLabel ?? null,
    shortPlanWarning,
  };
}
