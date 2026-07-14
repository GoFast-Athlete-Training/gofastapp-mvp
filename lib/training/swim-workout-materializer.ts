/**
 * Swim workout materializer contract — schedule row + catalogue → swim_workout / swim_workout_step.
 * Implementation deferred to phase-2; this module defines the canonical input/output shape.
 */

import type { swim_plan_preset, swim_workout_catalogue } from "@prisma/client";
import type { SwimPlanDaySchedule } from "@/lib/training/swim-plan-schedule-schema";
import type { ResolvedSwimPaceTargets } from "@/lib/training/swim-pace-resolver";
import { resolveSwimPaceTargets } from "@/lib/training/swim-pace-resolver";
import type { SwimCatalogueSegmentPattern } from "@/lib/training/swim-catalogue-schema";
import { parseSwimCatalogueSegmentPattern } from "@/lib/training/swim-catalogue-schema";

export type SwimMaterializerAthleteContext = {
  athleteId: string;
  fourHunMSwPace: number;
  poolLengthMeters?: number | null;
};

export type SwimMaterializerStepDraft = {
  stepOrder: number;
  title: string;
  intensity: string;
  durationType: "DISTANCE" | "TIME" | "OPEN";
  durationMeters?: number | null;
  durationSeconds?: number | null;
  repeatCount?: number | null;
  restSeconds?: number | null;
  paceSecPer100mLow?: number | null;
  paceSecPer100mHigh?: number | null;
  paceNote?: string | null;
  strokeType?: string | null;
  equipment?: string | null;
  drillType?: string | null;
  targetZone?: string | null;
  notes?: string | null;
};

export type SwimMaterializerWorkoutDraft = {
  athleteId: string;
  title: string;
  description?: string | null;
  date?: Date | null;
  poolLengthMeters?: number | null;
  cssSecPer100m?: number | null;
  notes?: string | null;
  steps: SwimMaterializerStepDraft[];
};

export type SwimMaterializeDayInput = {
  preset: Pick<swim_plan_preset, "paceProfile">;
  day: SwimPlanDaySchedule;
  catalogue: swim_workout_catalogue;
  athlete: SwimMaterializerAthleteContext;
  workoutDate?: Date | null;
};

/**
 * Build canonical swim_workout_step drafts from a schedule day + catalogue row.
 * Does not persist — caller writes via Prisma in phase-2 materializer route.
 */
export function buildSwimWorkoutDraftFromScheduleDay(
  input: SwimMaterializeDayInput
): SwimMaterializerWorkoutDraft {
  const paceProfile =
    input.preset.paceProfile && typeof input.preset.paceProfile === "object"
      ? (input.preset.paceProfile as Record<string, unknown>)
      : null;

  const paceTargets: ResolvedSwimPaceTargets = resolveSwimPaceTargets({
    fourHunMSwPace: input.athlete.fourHunMSwPace,
    workoutType: input.catalogue.workoutType,
    paceProfile: paceProfile as Parameters<typeof resolveSwimPaceTargets>[0]["paceProfile"],
    catalogueOffsetSecPer100m: input.catalogue.paceOffsetSecPer100m,
  });

  const segmentPattern = parseSwimCatalogueSegmentPattern(input.catalogue.segmentPattern);
  const steps = segmentPattern
    ? stepsFromSegmentPattern(segmentPattern, paceTargets)
    : stepsFromCatalogueScalars(input.catalogue, paceTargets);

  return {
    athleteId: input.athlete.athleteId,
    title: input.catalogue.name,
    description: input.catalogue.description,
    date: input.workoutDate ?? null,
    poolLengthMeters: input.athlete.poolLengthMeters ?? null,
    cssSecPer100m: input.athlete.fourHunMSwPace,
    notes: paceTargets.paceNote,
    steps,
  };
}

function stepsFromCatalogueScalars(
  catalogue: swim_workout_catalogue,
  pace: ResolvedSwimPaceTargets
): SwimMaterializerStepDraft[] {
  const steps: SwimMaterializerStepDraft[] = [];
  let order = 1;

  if (catalogue.warmupMeters && catalogue.warmupMeters > 0) {
    steps.push(scalarStep(order++, "Warm up", catalogue.warmupMeters, pace, "WARMUP"));
  }

  const workMeters =
    catalogue.totalWorkDistanceMeters ??
    (catalogue.repDistanceMeters && catalogue.repCount
      ? catalogue.repDistanceMeters * catalogue.repCount
      : inputDayMetersFallback(catalogue));

  if (workMeters > 0) {
    steps.push({
      stepOrder: order++,
      title: catalogue.name,
      intensity: "MAIN",
      durationType: "DISTANCE",
      durationMeters: workMeters,
      repeatCount: catalogue.repCount ?? null,
      restSeconds: catalogue.recoverySeconds ?? null,
      ...paceFields(pace),
    });
  }

  if (catalogue.cooldownMeters && catalogue.cooldownMeters > 0) {
    steps.push(scalarStep(order++, "Cool down", catalogue.cooldownMeters, pace, "COOLDOWN"));
  }

  if (steps.length === 0) {
    steps.push({
      stepOrder: 1,
      title: catalogue.name,
      intensity: "MAIN",
      durationType: "OPEN",
      ...paceFields(pace),
      notes: "Catalogue row has no distance fields — staff must enrich before materialize.",
    });
  }

  return steps;
}

function inputDayMetersFallback(catalogue: swim_workout_catalogue): number {
  return catalogue.repDistanceMeters ?? 0;
}

function stepsFromSegmentPattern(
  pattern: SwimCatalogueSegmentPattern,
  defaultPace: ResolvedSwimPaceTargets
): SwimMaterializerStepDraft[] {
  const steps: SwimMaterializerStepDraft[] = [];
  let order = 1;

  const blocks: Array<{ segments: SwimCatalogueSegmentPattern["warmup"]; intensity: string }> = [
    { segments: pattern.warmup, intensity: "WARMUP" },
    { segments: pattern.main, intensity: "MAIN" },
    { segments: pattern.cooldown, intensity: "COOLDOWN" },
  ];

  for (const block of blocks) {
    if (!block.segments) continue;
    for (const seg of block.segments) {
      const durationType =
        seg.distanceMeters != null
          ? "DISTANCE"
          : seg.durationSeconds != null
            ? "TIME"
            : "OPEN";
      steps.push({
        stepOrder: order++,
        title: seg.label ?? "Segment",
        intensity: block.intensity,
        durationType,
        durationMeters: seg.distanceMeters ?? null,
        durationSeconds: seg.durationSeconds ?? null,
        repeatCount: seg.repeatCount ?? null,
        restSeconds: seg.restSeconds ?? null,
        strokeType: seg.strokeType ?? null,
        equipment: seg.equipment ?? null,
        paceSecPer100mLow: defaultPace.paceSecPer100mLow,
        paceSecPer100mHigh: defaultPace.paceSecPer100mHigh,
        paceNote: defaultPace.paceNote,
      });
    }
  }

  return steps;
}

function scalarStep(
  order: number,
  title: string,
  meters: number,
  pace: ResolvedSwimPaceTargets,
  intensity: string
): SwimMaterializerStepDraft {
  return {
    stepOrder: order,
    title,
    intensity,
    durationType: "DISTANCE",
    durationMeters: meters,
    ...paceFields(pace),
  };
}

function paceFields(pace: ResolvedSwimPaceTargets): Pick<
  SwimMaterializerStepDraft,
  "paceSecPer100mLow" | "paceSecPer100mHigh" | "paceNote"
> {
  return {
    paceSecPer100mLow: pace.paceSecPer100mLow,
    paceSecPer100mHigh: pace.paceSecPer100mHigh,
    paceNote: pace.paceNote,
  };
}

// TODO(phase-2): persist drafts via prisma swim_workout.create + nested steps; link swimWorkoutId on planSchedule day.
// TODO(phase-2): optional Garmin push via assemble-garmin-swim-workout after materialize.
