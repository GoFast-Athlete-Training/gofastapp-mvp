/**
 * Stub — documents plan-generate rules for the new preset core.
 * Not wired into execute-plan-generate.ts in this pass.
 */

import { buildLongRunSchedule, type LongRunRotationSlot } from "@/lib/training/long-run-builder";
import { presetCoreFromPreset, type PresetCoreSource } from "@/lib/training/preset-core";

export type PlanGenerateCoreStubResult = {
  presetCore: ReturnType<typeof presetCoreFromPreset>;
  rules: {
    longRunSource: "long_run_builder";
    weeklyVolumeSource: "weekly_volume_peak_not_flat_preference";
    qualityCountsAreAwarenessOnly: true;
    qualityIsTempoPlusIntervalsLongRunExcluded: true;
    dropWeekdayQualityWhenFastLongRun: "mvp3_not_implemented";
  };
  longRunPreview: ReturnType<typeof buildLongRunSchedule> | null;
};

export function stubPlanGenerateRulesFromPreset(
  preset: PresetCoreSource & {
    totalWeeks?: number;
    longRunRotationSlots?: LongRunRotationSlot[];
  },
): PlanGenerateCoreStubResult {
  const presetCore = presetCoreFromPreset(preset);
  const totalWeeks = Math.max(1, Math.floor(preset.totalWeeks ?? 16));

  let longRunPreview: PlanGenerateCoreStubResult["longRunPreview"] = null;
  if (
    presetCore.longRunPeakMiles != null &&
    presetCore.longRunPeakMiles > 0 &&
    preset.longRunRotationSlots &&
    preset.longRunRotationSlots.length > 0
  ) {
    longRunPreview = buildLongRunSchedule({
      totalWeeks,
      peakLongRunMiles: presetCore.longRunPeakMiles,
      slots: preset.longRunRotationSlots,
    });
  }

  return {
    presetCore,
    rules: {
      longRunSource: "long_run_builder",
      weeklyVolumeSource: "weekly_volume_peak_not_flat_preference",
      qualityCountsAreAwarenessOnly: true,
      qualityIsTempoPlusIntervalsLongRunExcluded: true,
      dropWeekdayQualityWhenFastLongRun: "mvp3_not_implemented",
    },
    longRunPreview,
  };
}
