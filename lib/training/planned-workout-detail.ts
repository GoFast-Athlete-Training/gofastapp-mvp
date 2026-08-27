/**
 * Hub/day GET: load planned prescribe tree; merge spawned instance actuals when present.
 */

import { prisma } from "@/lib/prisma";
import { ensurePlannedWorkoutPrescriptionNarrative } from "./prescription-narrative-service";
import { materializeWorkoutForPlanDay } from "./workout-materializer";
import { ymdFromDate } from "./plan-utils";
import { goalBenchmarkFromSegmentSnapshot } from "./workout-segment-snapshot";

const plannedDetailInclude = {
  segments: { orderBy: { stepOrder: "asc" as const } },
  workout_catalogue: true,
  training_plans: {
    select: {
      id: true,
      name: true,
      totalWeeks: true,
      currentFiveKPace: true,
      goalRaceTime: true,
      goalRacePace: true,
      lifecycleStatus: true,
      planSchedule: true,
      easyRunConfig: true,
      athlete_race: {
        select: {
          goalTime: true,
          goalRacePace: true,
          goalDistance: true,
        },
      },
      race_registry: {
        select: {
          distanceMeters: true,
          distanceLabel: true,
        },
      },
      training_plan_preset: {
        select: { athletePersonaCapability: true },
      },
    },
  },
} as const;

const instanceDetailInclude = {
  segments: {
    orderBy: { stepOrder: "asc" as const },
    include: {
      segment_laps: { orderBy: { lapIndex: "asc" as const } },
    },
  },
  matched_activity: {
    select: {
      id: true,
      activityName: true,
      activityType: true,
      startTime: true,
      ingestionStatus: true,
      distance: true,
      duration: true,
      averageSpeed: true,
      detailData: true,
      hydratedAt: true,
    },
  },
  city_runs: {
    select: { id: true, date: true, createdAt: true },
    orderBy: { createdAt: "desc" as const },
    take: 3,
  },
} as const;

export async function loadPlannedWorkoutDetailForAthlete(params: {
  plannedWorkoutId: string;
  athleteId: string;
}) {
  let planned = await prisma.planned_workouts.findFirst({
    where: { id: params.plannedWorkoutId, athleteId: params.athleteId },
    include: plannedDetailInclude,
  });

  if (!planned) return null;

  if (planned.segments.length === 0 && planned.planId && planned.date) {
    try {
      await materializeWorkoutForPlanDay({
        planId: planned.planId,
        athleteId: params.athleteId,
        dateParam: ymdFromDate(planned.date),
      });
      planned = await prisma.planned_workouts.findFirst({
        where: { id: params.plannedWorkoutId, athleteId: params.athleteId },
        include: plannedDetailInclude,
      });
    } catch (e) {
      console.warn("loadPlannedWorkoutDetail rematerialize:", e);
    }
  }

  if (!planned) return null;

  const instance = await prisma.workouts.findFirst({
    where: {
      plannedWorkoutId: planned.id,
      athleteId: params.athleteId,
    },
    include: instanceDetailInclude,
    orderBy: { updatedAt: "desc" },
  });

  const prescribeSegments =
    instance?.segments.length
      ? instance.segments
      : planned.segments.map((s) => ({
          ...s,
          workoutId: instance?.id ?? planned.id,
          actualPaceSecPerMile: null,
          actualDistanceMiles: null,
          actualDurationSeconds: null,
          segment_laps: [] as [],
        }));

  void ensurePlannedWorkoutPrescriptionNarrative({
    plannedWorkoutId: planned.id,
    athleteId: params.athleteId,
  }).catch((e) => console.warn("ensurePlannedWorkoutPrescriptionNarrative:", e));

  const tempoGoalBenchmark = goalBenchmarkFromSegmentSnapshot(planned.segmentSnapshotJson);

  return {
    id: instance?.id ?? planned.id,
    plannedWorkoutId: planned.id,
    title: planned.title,
    workoutType: planned.workoutType,
    description: instance?.description ?? null,
    athleteId: planned.athleteId,
    planId: planned.planId,
    catalogueWorkoutId: planned.catalogueWorkoutId,
    date: planned.date,
    estimatedDistanceInMeters: planned.estimatedDistanceInMeters,
    nOffset: planned.nOffset,
    weekNumber: planned.weekNumber,
    dayAssigned: planned.dayAssigned,
    planCycleIndex: planned.planCycleIndex,
    garminWorkoutId: planned.garminWorkoutId,
    garminScheduleId: planned.garminScheduleId,
    matchedActivityId: instance?.matchedActivityId ?? null,
    skippedAt: instance?.skippedAt ?? null,
    skipReason: instance?.skipReason ?? null,
    actualDistanceMeters: instance?.actualDistanceMeters ?? null,
    actualAvgPaceSecPerMile: instance?.actualAvgPaceSecPerMile ?? null,
    actualAverageHeartRate: instance?.actualAverageHeartRate ?? null,
    actualDurationSeconds: instance?.actualDurationSeconds ?? null,
    actualMaxHeartRate: instance?.actualMaxHeartRate ?? null,
    actualElevationGain: instance?.actualElevationGain ?? null,
    actualCalories: instance?.actualCalories ?? null,
    actualSteps: instance?.actualSteps ?? null,
    paceDeltaSecPerMile: instance?.paceDeltaSecPerMile ?? null,
    targetPaceSecPerMile: instance?.targetPaceSecPerMile ?? null,
    targetPaceSecPerMileHigh: instance?.targetPaceSecPerMileHigh ?? null,
    hrDeltaBpm: instance?.hrDeltaBpm ?? null,
    creditedFiveKPaceSecPerMile: instance?.creditedFiveKPaceSecPerMile ?? null,
    creditedThresholdPaceSecPerMile: instance?.creditedThresholdPaceSecPerMile ?? null,
    creditedAerobicCeilingBpm: instance?.creditedAerobicCeilingBpm ?? null,
    evaluationEligibleFlag: instance?.evaluationEligibleFlag ?? false,
    segmentExecutionStatus: instance?.segmentExecutionStatus ?? null,
    segmentExecutionLapCount: instance?.segmentExecutionLapCount ?? null,
    segmentExecutionSegmentCount: instance?.segmentExecutionSegmentCount ?? null,
    segmentSnapshotJson: planned.segmentSnapshotJson ?? instance?.segmentSnapshotJson ?? null,
    completedActivitySummaryJson: instance?.completedActivitySummaryJson ?? null,
    completedActivityDetailJson: instance?.completedActivityDetailJson ?? null,
    analysisJson: instance?.analysisJson ?? null,
    runContextTags: instance?.runContextTags ?? [],
    runContextNote: instance?.runContextNote ?? null,
    runContextUpdatedAt: instance?.runContextUpdatedAt ?? null,
    prescriptionNarrative:
      planned.prescriptionNarrative ?? instance?.prescriptionNarrative ?? null,
    tempoGoalBenchmark,
    segments: prescribeSegments,
    workout_catalogue: planned.workout_catalogue,
    training_plans: planned.training_plans,
    matched_activity: instance?.matched_activity ?? null,
    city_runs: instance?.city_runs ?? [],
    isPlannedOnly: !instance?.matchedActivityId,
  };
}

export type PlannedWorkoutDetailRow = NonNullable<
  Awaited<ReturnType<typeof loadPlannedWorkoutDetailForAthlete>>
>;
