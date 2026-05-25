/**
 * Shared promotion: link athlete_activity → workouts row and compute actuals/credits.
 * Used by auto-match (Garmin webhook) and manual match (user confirm).
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { applyWorkoutPaceCredit } from "./apply-workout-pace-credit";
import { applyThresholdPaceCredit } from "./apply-threshold-pace-credit";
import { applyAerobicCeilingCredit } from "./apply-aerobic-ceiling-credit";
import { applyLightAdaptiveIfEligible } from "./light-adaptive-service";
import {
  normalizePaceTargetEncodingVersion,
  storedPaceSecondsKmToSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";
import { normalizeGarminMatchText } from "./garmin-activity-match-helpers";
import { ymdFromDate } from "./plan-utils";
import { parseDetailData } from "./detail-data-parser";
import { convertLapsToDerived } from "./lap-converter";
import { writeLapsToWorkout } from "./lap-data-to-workout";
/** Max sec/mi faster than prescribed easy pace before we skip aerobic HR credit (target − actual). */
export const EASY_LONG_RUN_MAX_FAST_DRIFT_SEC_PER_MILE = 15;

function defaultRepPaceOffsetSecPerMile(workoutType: string): number | null {
  if (workoutType === "Tempo") return 15;
  if (workoutType === "Intervals") return -10;
  return null;
}

/**
 * Which pace credits apply after a successful tempo or interval match.
 * Intervals → 5K credit, Tempo → threshold credit.
 */
export function computeMatchedWorkoutPaceCredits(params: {
  workoutType: string;
  paceSecPerMile: number | null;
  paceDeltaSecPerMile: number | null;
  intervalsCatalogueOffsetSecPerMile: number | null | undefined;
}): {
  creditedFiveKPaceSecPerMile: number | null;
  creditedThresholdPaceSecPerMile: number | null;
} {
  const {
    workoutType,
    paceSecPerMile,
    paceDeltaSecPerMile,
    intervalsCatalogueOffsetSecPerMile,
  } = params;

  const paceCreditEligible =
    paceSecPerMile != null && paceDeltaSecPerMile != null && paceDeltaSecPerMile >= 0;

  let creditedFiveKPaceSecPerMile: number | null = null;
  let creditedThresholdPaceSecPerMile: number | null = null;

  if (workoutType === "Intervals" && paceCreditEligible && paceSecPerMile != null) {
    const offset =
      intervalsCatalogueOffsetSecPerMile != null &&
      Number.isFinite(intervalsCatalogueOffsetSecPerMile)
        ? intervalsCatalogueOffsetSecPerMile
        : defaultRepPaceOffsetSecPerMile("Intervals");
    if (offset != null) {
      creditedFiveKPaceSecPerMile = Math.round(paceSecPerMile - offset);
    }
  }

  if (workoutType === "Tempo" && paceCreditEligible && paceSecPerMile != null) {
    creditedThresholdPaceSecPerMile = Math.round(paceSecPerMile);
  }

  return { creditedFiveKPaceSecPerMile, creditedThresholdPaceSecPerMile };
}

/**
 * Easy/LongRun average HR as aerobic-ceiling evidence when execution was not an overly fast "easy" run.
 */
export function computeMatchedWorkoutAerobicCeilingCredit(params: {
  workoutType: string;
  averageHeartRateBpm: number | null | undefined;
  paceDeltaSecPerMile: number | null;
}): number | null {
  const { workoutType, averageHeartRateBpm, paceDeltaSecPerMile } = params;
  if (workoutType !== "Easy" && workoutType !== "LongRun") return null;
  if (averageHeartRateBpm == null || !Number.isFinite(averageHeartRateBpm)) return null;
  const hr = Math.round(averageHeartRateBpm);
  if (hr < 80 || hr > 210) return null;
  if (
    paceDeltaSecPerMile != null &&
    paceDeltaSecPerMile > EASY_LONG_RUN_MAX_FAST_DRIFT_SEC_PER_MILE
  ) {
    return null;
  }
  return hr;
}

/** m/s → seconds per mile */
function speedMpsToSecPerMile(mps: number | null | undefined): number | null {
  if (mps == null || mps <= 0) return null;
  return Math.round(1609.34 / mps);
}

type SegmentTarget = { type?: string; valueLow?: number; valueHigh?: number; value?: number };

function paceTargetSecPerMileFromSegment(
  targets: unknown,
  paceTargetEncodingVersion: number
): number | null {
  if (!Array.isArray(targets) || targets.length === 0) return null;
  const t = targets[0] as SegmentTarget;
  if (!t?.type || String(t.type).toUpperCase() !== "PACE") return null;
  const low = t.valueLow ?? t.value;
  if (low == null || typeof low !== "number" || low <= 0) return null;
  const enc = normalizePaceTargetEncodingVersion(paceTargetEncodingVersion);
  return Math.round(storedPaceSecondsKmToSecondsPerMile(low, enc));
}

function paceTargetHighSecPerMileFromSegment(
  targets: unknown,
  paceTargetEncodingVersion: number
): number | null {
  if (!Array.isArray(targets) || targets.length === 0) return null;
  const t = targets[0] as SegmentTarget;
  if (!t?.type || String(t.type).toUpperCase() !== "PACE") return null;
  const highRaw = t.valueHigh;
  if (highRaw == null || typeof highRaw !== "number" || highRaw <= 0) return null;
  const enc = normalizePaceTargetEncodingVersion(paceTargetEncodingVersion);
  return Math.round(storedPaceSecondsKmToSecondsPerMile(highRaw, enc));
}

function hrTargetMidpointBpmFromTargets(targets: unknown): number | null {
  if (!Array.isArray(targets) || targets.length === 0) return null;
  for (const raw of targets) {
    const t = raw as SegmentTarget;
    const typ = String(t?.type || "").toUpperCase();
    if (typ !== "HEART_RATE" && typ !== "HEARTRATE") continue;
    const low = t.valueLow ?? t.value;
    const high = t.valueHigh ?? low;
    if (low == null || typeof low !== "number") continue;
    if (high != null && typeof high === "number") {
      return Math.round((low + high) / 2);
    }
    return Math.round(low);
  }
  return null;
}

function pickMainPaceTargetSecPerMile(
  segments: {
    title: string;
    targets: unknown;
    stepOrder: number;
    paceTargetEncodingVersion: number;
  }[]
): { targetSecPerMile: number | null; targetSecPerMileHigh: number | null } {
  const sorted = [...segments].sort((a, b) => a.stepOrder - b.stepOrder);
  for (const seg of sorted) {
    const title = (seg.title || "").toLowerCase();
    if (title.includes("warmup") || title.includes("warm-up")) continue;
    if (title.includes("cooldown") || title.includes("cool-down")) continue;
    const p = paceTargetSecPerMileFromSegment(seg.targets, seg.paceTargetEncodingVersion);
    if (p != null) {
      const ph = paceTargetHighSecPerMileFromSegment(
        seg.targets,
        seg.paceTargetEncodingVersion
      );
      return { targetSecPerMile: p, targetSecPerMileHigh: ph };
    }
  }
  for (const seg of sorted) {
    const p = paceTargetSecPerMileFromSegment(seg.targets, seg.paceTargetEncodingVersion);
    if (p != null) {
      const ph = paceTargetHighSecPerMileFromSegment(
        seg.targets,
        seg.paceTargetEncodingVersion
      );
      return { targetSecPerMile: p, targetSecPerMileHigh: ph };
    }
  }
  return { targetSecPerMile: null, targetSecPerMileHigh: null };
}

function pickMainHrTargetBpm(
  segments: {
    title: string;
    targets: unknown;
    stepOrder: number;
    paceTargetEncodingVersion: number;
  }[]
): number | null {
  const sorted = [...segments].sort((a, b) => a.stepOrder - b.stepOrder);
  for (const seg of sorted) {
    const title = (seg.title || "").toLowerCase();
    if (title.includes("warmup") || title.includes("warm-up")) continue;
    if (title.includes("cooldown") || title.includes("cool-down")) continue;
    const h = hrTargetMidpointBpmFromTargets(seg.targets);
    if (h != null) return h;
  }
  for (const seg of sorted) {
    const h = hrTargetMidpointBpmFromTargets(seg.targets);
    if (h != null) return h;
  }
  return null;
}

export type WorkoutForActivityApply = {
  id: string;
  planId: string | null;
  weekNumber: number | null;
  workoutType: string;
  segments: {
    title: string;
    targets: unknown;
    stepOrder: number;
    paceTargetEncodingVersion: number;
  }[];
  workout_catalogue: { workBasePaceOffsetSecPerMile: number | null } | null;
};

export type ActivityForWorkoutApply = {
  id: string;
  athleteId: string;
  distance: number | null;
  averageSpeed: number | null;
  averageHeartRate: number | null;
  duration: number | null;
  maxHeartRate: number | null;
  elevationGain: number | null;
  calories: number | null;
  steps: number | null;
  summaryData: unknown;
  detailData?: unknown;
};

/** Clear lap rows and segment-level actuals for a workout (derived match state only). */
export async function clearWorkoutDerivedActuals(workoutId: string): Promise<void> {
  await prisma.workout_segment_laps.deleteMany({
    where: { segment: { workoutId } },
  });
  await prisma.workout_segments.updateMany({
    where: { workoutId },
    data: {
      actualPaceSecPerMile: null,
      actualDistanceMiles: null,
      actualDurationSeconds: null,
      updatedAt: new Date(),
    },
  });
}

async function syncActivityDetailToLinkedWorkout(activityId: string): Promise<void> {
  const activity = await prisma.athlete_activities.findUnique({
    where: { id: activityId },
    select: { id: true, detailData: true },
  });
  if (!activity?.detailData || typeof activity.detailData !== "object") return;

  await prisma.workouts.updateMany({
    where: { matchedActivityId: activity.id },
    data: { completedActivityDetailJson: activity.detailData as object },
  });

  try {
    const parsed = parseDetailData(activity.detailData);
    const derived = convertLapsToDerived(parsed.laps, parsed.samples);
    await writeLapsToWorkout(activity.id, derived);
  } catch (lapErr) {
    console.warn("lap pipeline after activity match:", lapErr);
  }
}

/**
 * Link activity to workout, compute actuals, apply credits, mark activity MATCHED.
 */
export async function applyActivityToWorkout(params: {
  workout: WorkoutForActivityApply;
  activity: ActivityForWorkoutApply;
}): Promise<{ workoutId: string }> {
  const { workout, activity } = params;
  const summaryBlob = activity.summaryData as Record<string, unknown> | null;

  const distanceMeters =
    activity.distance != null && activity.distance > 0 ? activity.distance : null;

  const paceSecPerMile = speedMpsToSecPerMile(activity.averageSpeed);

  const {
    targetSecPerMile: targetPaceSecPerMile,
    targetSecPerMileHigh: targetPaceSecPerMileHigh,
  } = pickMainPaceTargetSecPerMile(workout.segments);

  let paceDeltaSecPerMile: number | null = null;
  let evaluationEligible = false;

  if (targetPaceSecPerMile != null && paceSecPerMile != null) {
    paceDeltaSecPerMile = targetPaceSecPerMile - paceSecPerMile;
    evaluationEligible = true;
  }

  let hrDeltaBpm: number | null = null;
  const hrTargetMid = pickMainHrTargetBpm(workout.segments);
  if (hrTargetMid != null && activity.averageHeartRate != null) {
    hrDeltaBpm = Math.round(hrTargetMid - activity.averageHeartRate);
  }

  let creditedFiveKPaceSecPerMile: number | null = null;
  let creditedThresholdPaceSecPerMile: number | null = null;

  const paceCreditEligible =
    paceSecPerMile != null && paceDeltaSecPerMile != null && paceDeltaSecPerMile >= 0;

  if (paceCreditEligible) {
    const matched = computeMatchedWorkoutPaceCredits({
      workoutType: workout.workoutType,
      paceSecPerMile,
      paceDeltaSecPerMile,
      intervalsCatalogueOffsetSecPerMile:
        workout.workout_catalogue?.workBasePaceOffsetSecPerMile ?? null,
    });
    creditedFiveKPaceSecPerMile = matched.creditedFiveKPaceSecPerMile;
    creditedThresholdPaceSecPerMile = matched.creditedThresholdPaceSecPerMile;
  }

  const creditedAerobicCeilingBpm = computeMatchedWorkoutAerobicCeilingCredit({
    workoutType: workout.workoutType,
    averageHeartRateBpm: activity.averageHeartRate,
    paceDeltaSecPerMile,
  });

  const detailBlob =
    activity.detailData != null && typeof activity.detailData === "object"
      ? (activity.detailData as object)
      : undefined;

  await prisma.workouts.update({
    where: { id: workout.id },
    data: {
      matchedActivityId: activity.id,
      skippedAt: null,
      skipReason: null,
      completedActivitySummaryJson:
        summaryBlob != null && typeof summaryBlob === "object"
          ? (summaryBlob as object)
          : undefined,
      completedActivityDetailJson: detailBlob,
      actualDistanceMeters: distanceMeters,
      actualAvgPaceSecPerMile: paceSecPerMile,
      actualAverageHeartRate: activity.averageHeartRate,
      actualDurationSeconds: activity.duration ?? null,
      actualMaxHeartRate: activity.maxHeartRate ?? null,
      actualElevationGain: activity.elevationGain ?? null,
      actualCalories: activity.calories ?? null,
      actualSteps: activity.steps ?? null,
      paceDeltaSecPerMile,
      targetPaceSecPerMile,
      targetPaceSecPerMileHigh,
      hrDeltaBpm,
      creditedFiveKPaceSecPerMile,
      creditedThresholdPaceSecPerMile,
      creditedAerobicCeilingBpm,
      evaluationEligibleFlag: evaluationEligible,
      updatedAt: new Date(),
    },
  });

  await prisma.athlete_activities.update({
    where: { id: activity.id },
    data: { ingestionStatus: "MATCHED" },
  });

  if (paceDeltaSecPerMile != null && paceSecPerMile != null) {
    try {
      const absD = Math.abs(Math.round(paceDeltaSecPerMile));
      const direction =
        paceDeltaSecPerMile > 0.5
          ? `${absD} sec/mi faster than target`
          : paceDeltaSecPerMile < -0.5
            ? `${absD} sec/mi slower than target`
            : "right on target pace";
      const miDisplay =
        distanceMeters != null
          ? `${(distanceMeters / 1609.34).toFixed(1)} mi @ `
          : "";
      const paceMin = Math.floor(paceSecPerMile / 60);
      const paceSec = String(paceSecPerMile % 60).padStart(2, "0");
      await prisma.pace_adjustment_log.create({
        data: {
          athleteId: activity.athleteId,
          planId: workout.planId ?? null,
          weekNumber: workout.weekNumber ?? null,
          workoutId: workout.id,
          notificationType: "WORKOUT_MATCH",
          summaryMessage: `${miDisplay}${paceMin}:${paceSec}/mi — ${direction}.`,
        },
      });
    } catch (err) {
      console.error("pace_adjustment_log WORKOUT_MATCH insert:", err);
    }
  }

  if (creditedFiveKPaceSecPerMile != null) {
    try {
      await applyWorkoutPaceCredit({
        athleteId: activity.athleteId,
        creditedFiveKPaceSecPerMile,
        planId: workout.planId ?? null,
        weekNumber: workout.weekNumber ?? null,
      });
    } catch (err) {
      console.error("applyWorkoutPaceCredit after match:", err);
    }
  }

  if (creditedThresholdPaceSecPerMile != null) {
    try {
      await applyThresholdPaceCredit({
        athleteId: activity.athleteId,
        creditedThresholdPaceSecPerMile,
        planId: workout.planId ?? null,
        weekNumber: workout.weekNumber ?? null,
        workoutId: workout.id,
      });
    } catch (err) {
      console.error("applyThresholdPaceCredit after match:", err);
    }
  }

  if (creditedAerobicCeilingBpm != null) {
    try {
      await applyAerobicCeilingCredit({
        athleteId: activity.athleteId,
        creditedAerobicCeilingBpm,
        planId: workout.planId ?? null,
        weekNumber: workout.weekNumber ?? null,
        workoutId: workout.id,
      });
    } catch (err) {
      console.error("applyAerobicCeilingCredit after match:", err);
    }
  }

  if (
    (workout.workoutType === "LongRun" || workout.workoutType === "Race") &&
    workout.planId
  ) {
    try {
      await applyLightAdaptiveIfEligible({
        athleteId: activity.athleteId,
        planId: workout.planId,
        weekNumber: workout.weekNumber ?? null,
        workoutId: workout.id,
      });
    } catch (err) {
      console.error("applyLightAdaptiveIfEligible after long run match:", err);
    }
  }

  if (detailBlob) {
    await syncActivityDetailToLinkedWorkout(activity.id);
  }

  return { workoutId: workout.id };
}

/** Clear manual/auto match from a workout and reset linked activity ingestion status. */
export async function clearActivityFromWorkout(params: {
  workoutId: string;
  athleteId: string;
}): Promise<{ cleared: boolean; previousActivityId?: string }> {
  const workout = await prisma.workouts.findFirst({
    where: { id: params.workoutId, athleteId: params.athleteId },
    select: { id: true, matchedActivityId: true },
  });

  if (!workout?.matchedActivityId) {
    return { cleared: false };
  }

  const previousActivityId = workout.matchedActivityId;

  await clearWorkoutDerivedActuals(workout.id);

  await prisma.workouts.update({
    where: { id: workout.id },
    data: {
      matchedActivityId: null,
      completedActivitySummaryJson: Prisma.DbNull,
      completedActivityDetailJson: Prisma.DbNull,
      actualDistanceMeters: null,
      actualAvgPaceSecPerMile: null,
      actualAverageHeartRate: null,
      actualDurationSeconds: null,
      actualMaxHeartRate: null,
      actualElevationGain: null,
      actualCalories: null,
      actualSteps: null,
      paceDeltaSecPerMile: null,
      targetPaceSecPerMile: null,
      targetPaceSecPerMileHigh: null,
      hrDeltaBpm: null,
      creditedFiveKPaceSecPerMile: null,
      creditedThresholdPaceSecPerMile: null,
      creditedAerobicCeilingBpm: null,
      evaluationEligibleFlag: false,
      analysisJson: Prisma.DbNull,
      runContextTags: [],
      runContextNote: null,
      runContextUpdatedAt: null,
      updatedAt: new Date(),
    },
  });

  await prisma.athlete_activities.updateMany({
    where: { id: previousActivityId, athleteId: params.athleteId },
    data: { ingestionStatus: "UNMATCHED" },
  });

  return { cleared: true, previousActivityId };
}

export type ActivityLinkConflictType =
  | "same_workout"
  | "standalone_workout"
  | "sibling_planned_workout"
  | "unrelated_planned_workout";

export type ActivityLinkConflict = {
  type: ActivityLinkConflictType;
  workoutId: string;
  workoutTitle: string;
};

const reassignWorkoutInclude = {
  segments: { orderBy: { stepOrder: "asc" as const } },
  workout_catalogue: { select: { workBasePaceOffsetSecPerMile: true } },
};

function datesOnSameCalendarDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return ymdFromDate(a) === ymdFromDate(b);
}

/** Classify how an activity's existing workout link relates to a manual match target. */
export function classifyActivityLinkConflict(params: {
  targetWorkout: {
    id: string;
    title: string;
    date: Date | null;
    weekNumber: number | null;
    planId: string | null;
  };
  existingWorkout: {
    id: string;
    title: string;
    date: Date | null;
    weekNumber: number | null;
    planId: string | null;
  };
}): ActivityLinkConflictType {
  const { targetWorkout, existingWorkout } = params;
  if (existingWorkout.id === targetWorkout.id) return "same_workout";
  if (existingWorkout.planId == null) return "standalone_workout";

  const sameDate = datesOnSameCalendarDay(existingWorkout.date, targetWorkout.date);
  const sameTitle =
    normalizeGarminMatchText(existingWorkout.title) ===
    normalizeGarminMatchText(targetWorkout.title);
  const sameWeek =
    existingWorkout.weekNumber != null &&
    targetWorkout.weekNumber != null &&
    existingWorkout.weekNumber === targetWorkout.weekNumber;

  if (sameDate || sameTitle || sameWeek) {
    return "sibling_planned_workout";
  }
  return "unrelated_planned_workout";
}

/**
 * Move an activity link from a ghost/sibling workout to the target planned workout.
 * Keeps the raw athlete_activities row; clears or deletes the old owning workout when safe.
 */
export async function reassignActivityToWorkout(params: {
  activityId: string;
  targetWorkoutId: string;
  athleteId: string;
}): Promise<
  | { success: true; workoutId: string; reassignedFrom?: string }
  | { success: false; conflict: ActivityLinkConflict }
> {
  const targetWorkout = await prisma.workouts.findFirst({
    where: { id: params.targetWorkoutId, athleteId: params.athleteId },
    include: reassignWorkoutInclude,
  });
  if (!targetWorkout) {
    throw new Error("Workout not found");
  }

  const activity = await prisma.athlete_activities.findFirst({
    where: { id: params.activityId, athleteId: params.athleteId },
  });
  if (!activity) {
    throw new Error("Activity not found");
  }

  if (targetWorkout.matchedActivityId === activity.id) {
    return { success: true, workoutId: targetWorkout.id };
  }

  const existingLink = await prisma.workouts.findFirst({
    where: {
      athleteId: params.athleteId,
      matchedActivityId: activity.id,
    },
    select: {
      id: true,
      title: true,
      date: true,
      weekNumber: true,
      planId: true,
    },
  });

  if (existingLink) {
    const conflictType = classifyActivityLinkConflict({
      targetWorkout,
      existingWorkout: existingLink,
    });

    if (conflictType === "unrelated_planned_workout") {
      return {
        success: false,
        conflict: {
          type: conflictType,
          workoutId: existingLink.id,
          workoutTitle: existingLink.title,
        },
      };
    }

    if (conflictType === "standalone_workout") {
      await prisma.workouts.delete({ where: { id: existingLink.id } });
    } else if (conflictType === "sibling_planned_workout") {
      await clearActivityFromWorkout({
        workoutId: existingLink.id,
        athleteId: params.athleteId,
      });
    }
  }

  if (
    targetWorkout.matchedActivityId &&
    targetWorkout.matchedActivityId !== activity.id
  ) {
    await clearActivityFromWorkout({
      workoutId: targetWorkout.id,
      athleteId: params.athleteId,
    });
  }

  const { workoutId } = await applyActivityToWorkout({ workout: targetWorkout, activity });

  return {
    success: true,
    workoutId,
    reassignedFrom: existingLink?.id,
  };
}

/** Hard-delete a GoFast activity row (not Garmin). Clears any owning workout link first. */
export async function deleteAthleteActivity(params: {
  activityId: string;
  athleteId: string;
}): Promise<{ deleted: boolean }> {
  const activity = await prisma.athlete_activities.findFirst({
    where: { id: params.activityId, athleteId: params.athleteId },
    select: { id: true },
  });
  if (!activity) {
    return { deleted: false };
  }

  const owningWorkout = await prisma.workouts.findFirst({
    where: { matchedActivityId: activity.id, athleteId: params.athleteId },
    select: { id: true },
  });
  if (owningWorkout) {
    await clearActivityFromWorkout({
      workoutId: owningWorkout.id,
      athleteId: params.athleteId,
    });
  }

  await prisma.athlete_activities.delete({ where: { id: activity.id } });
  return { deleted: true };
}
