/**
 * SwimPlanGeneratorService — emits structured JSON schedule rows (SwimPlanWeekSchedule[]).
 * Mirrors run execute-plan-generate output shape; full week-filling logic is phase-2.
 */

import type { swim_plan_preset } from "@prisma/client";
import type {
  SwimPlanDaySchedule,
  SwimPlanWeekSchedule,
} from "@/lib/training/swim-plan-schedule-schema";
import {
  DEFAULT_TAPER_VOLUME_MULTIPLIER,
  deriveLongSwimMeters,
  parseSwimWorkoutStructure,
  parseWeeklyProgressionPattern,
  taperWeeklyMeters,
  weeklyMetersForCycleWeek,
  type SwimWorkoutTypeKey,
} from "@/lib/training/swim-plan-preset";

export type SwimPlanGeneratorInput = {
  preset: Pick<
    swim_plan_preset,
    | "cycleLen"
    | "weeklyProgressionPattern"
    | "recommendedWeeklyMeters"
    | "minWeeklyMeters"
    | "taperWeeks"
    | "taperVolumeMultiplier"
    | "longSwimShareOfWeek"
    | "longSwimMinMeters"
    | "longSwimMaxMeters"
    | "workoutStructure"
    | "enduranceIdealDow"
    | "thresholdIdealDow"
    | "powerIdealDow"
    | "longSwimIdealDow"
    | "enduranceConfigId"
    | "thresholdConfigId"
    | "powerConfigId"
    | "longSwimConfigId"
  >;
  /** Athlete target on generated plan — NOT stored on preset */
  targetWeeklyMeters: number;
  totalWeeks: number;
  /** Catalogue id per rotation slot — keyed by `${workoutType}:${cyclePosition}` */
  catalogueByRotationKey: Map<string, string>;
};

export type SwimPlanGeneratorResult = {
  planSchedule: SwimPlanWeekSchedule[];
  warnings: string[];
};

const TYPE_TO_DOW_FIELD: Record<
  SwimWorkoutTypeKey,
  keyof Pick<
    swim_plan_preset,
    "enduranceIdealDow" | "thresholdIdealDow" | "powerIdealDow" | "longSwimIdealDow"
  >
> = {
  EnduranceSwim: "enduranceIdealDow",
  ThresholdSwim: "thresholdIdealDow",
  PowerSwim: "powerIdealDow",
  LongSwim: "longSwimIdealDow",
};

/**
 * Generate swim plan schedule JSON rows for `totalWeeks`.
 * Quality days are placed from workoutStructure; meter allocation is simplified until catalogue seed exists.
 */
export function generateSwimPlanSchedule(
  input: SwimPlanGeneratorInput
): SwimPlanGeneratorResult {
  const warnings: string[] = [];
  const structure = parseSwimWorkoutStructure(input.preset.workoutStructure);
  const progression = parseWeeklyProgressionPattern(input.preset.weeklyProgressionPattern);
  const baseWeekly =
    input.targetWeeklyMeters ||
    input.preset.recommendedWeeklyMeters ||
    input.preset.minWeeklyMeters;

  const taperWeeks = Math.max(0, input.preset.taperWeeks ?? 0);
  const taperMult =
    input.preset.taperVolumeMultiplier ?? DEFAULT_TAPER_VOLUME_MULTIPLIER;
  const planSchedule: SwimPlanWeekSchedule[] = [];

  for (let weekNumber = 1; weekNumber <= input.totalWeeks; weekNumber++) {
    const weeksFromEnd = input.totalWeeks - weekNumber + 1;
    const isTaperWeek = taperWeeks > 0 && weeksFromEnd <= taperWeeks;

    const cycleIndex = (weekNumber - 1) % Math.max(1, input.preset.cycleLen);
    let weeklyMeters = weeklyMetersForCycleWeek(baseWeekly, cycleIndex, progression);
    if (isTaperWeek) {
      weeklyMeters = taperWeeklyMeters(weeklyMeters, taperMult);
    }

    const days = buildWeekDays({
      preset: input.preset,
      structure,
      weeklyMeters,
      cycleIndex,
      catalogueByRotationKey: input.catalogueByRotationKey,
      warnings,
    });

    planSchedule.push({
      weekNumber,
      weeklyMeters,
      isTaperWeek,
      days,
    });
  }

  if (!structure) {
    warnings.push(
      "workoutStructure missing or invalid — generated schedule has no quality days"
    );
  }

  return { planSchedule, warnings };
}

function buildWeekDays(params: {
  preset: SwimPlanGeneratorInput["preset"];
  structure: ReturnType<typeof parseSwimWorkoutStructure>;
  weeklyMeters: number;
  cycleIndex: number;
  catalogueByRotationKey: Map<string, string>;
  warnings: string[];
}): SwimPlanDaySchedule[] {
  const days: SwimPlanDaySchedule[] = [];
  if (!params.structure) return days;

  const longSwimMeters = deriveLongSwimMeters({
    weeklyMeters: params.weeklyMeters,
    longSwimShareOfWeek: params.preset.longSwimShareOfWeek,
    longSwimMinMeters: params.preset.longSwimMinMeters,
    longSwimMaxMeters: params.preset.longSwimMaxMeters,
  });

  let allocated = 0;

  for (const workoutType of Object.keys(params.structure.weeklyCounts) as SwimWorkoutTypeKey[]) {
    const count = params.structure.weeklyCounts[workoutType] ?? 0;
    if (count <= 0) continue;

    const dowField = TYPE_TO_DOW_FIELD[workoutType];
    const dow = params.preset[dowField] ?? 1;
    const cyclePosition = params.cycleIndex + 1;
    const rotationKey = `${workoutType}:${cyclePosition}`;
    const catalogueWorkoutId = params.catalogueByRotationKey.get(rotationKey) ?? null;

    if (!catalogueWorkoutId) {
      params.warnings.push(
        `No catalogue for rotation ${rotationKey} — day will materialize as placeholder`
      );
    }

    const meters =
      workoutType === "LongSwim"
        ? longSwimMeters
        : Math.round((params.weeklyMeters - longSwimMeters) / Math.max(1, count));

    allocated += meters * count;

    for (let i = 0; i < count; i++) {
      days.push({
        dow: count > 1 ? ((dow + i - 1) % 7) + 1 : dow,
        workoutType,
        meters,
        catalogueWorkoutId,
        planCycleIndex: cyclePosition,
      });
    }
  }

  if (allocated < params.weeklyMeters * 0.9) {
    params.warnings.push(
      `Week meter allocation (${allocated}) is below weekly target (${params.weeklyMeters}) — endurance filler phase-2`
    );
  }

  return days.sort((a, b) => a.dow - b.dow);
}

// TODO(phase-2): rotation-apply equivalent for swim configs (mirror lib/training/rotation-apply.ts).
// TODO(phase-2): integrate with swim_training_plans table + POST generate route.
