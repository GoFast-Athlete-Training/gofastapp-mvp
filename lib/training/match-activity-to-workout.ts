/**
 * Promotion engine: raw athlete_activity → matched workouts row (source of truth).
 * Primary match: garminWorkoutId from webhook payload ↔ workouts.garminWorkoutId
 * Fallback: same athlete, same UTC calendar day, unmatched workout (plan or standalone)
 */

import { prisma } from "@/lib/prisma";
import { extractGarminWorkoutIdFromSummary } from "./extract-garmin-workout-id";
import { applyWorkoutPaceCredit } from "./apply-workout-pace-credit";
import { applyThresholdPaceCredit } from "./apply-threshold-pace-credit";
import { applyAerobicCeilingCredit } from "./apply-aerobic-ceiling-credit";
import { RUNNING_ACTIVITY_TYPES } from "./activity-type-sets";
import {
  normalizePaceTargetEncodingVersion,
  storedPaceSecondsKmToSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";
/** m/s → seconds per mile */
function speedMpsToSecPerMile(mps: number | null | undefined): number | null {
  if (mps == null || mps <= 0) return null;
  return Math.round(1609.34 / mps);
}

function utcDayBounds(d: Date): { start: Date; end: Date } {
  const start = new Date(d);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

function isRunningActivityType(activityType: string | null | undefined): boolean {
  if (!activityType) return true; // allow unknown — many payloads omit; treat as eligible for match
  return RUNNING_ACTIVITY_TYPES.has(activityType.toUpperCase());
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

/** Upper bound of PACE target from segment `valueHigh` (same encoding as low). */
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

/** When no catalogue row: same defaults as pace-calculator OFFSETS_SEC_PER_MILE (tempo / interval). */
function defaultRepPaceOffsetSecPerMile(workoutType: string): number | null {
  if (workoutType === "Tempo") return 15;
  if (workoutType === "Intervals") return -10;
  return null;
}

/**
 * Which pace credits apply after a successful quality match (mirrors tryMatchActivityToTrainingWorkout).
 * Exported for verification; Intervals → 5K credit, Tempo → threshold credit.
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

  const qualityOk =
    paceSecPerMile != null && paceDeltaSecPerMile != null && paceDeltaSecPerMile >= 0;

  let creditedFiveKPaceSecPerMile: number | null = null;
  let creditedThresholdPaceSecPerMile: number | null = null;

  if (workoutType === "Intervals" && qualityOk && paceSecPerMile != null) {
    const offset =
      intervalsCatalogueOffsetSecPerMile != null &&
      Number.isFinite(intervalsCatalogueOffsetSecPerMile)
        ? intervalsCatalogueOffsetSecPerMile
        : defaultRepPaceOffsetSecPerMile("Intervals");
    if (offset != null) {
      creditedFiveKPaceSecPerMile = Math.round(paceSecPerMile - offset);
    }
  }

  if (workoutType === "Tempo" && qualityOk && paceSecPerMile != null) {
    creditedThresholdPaceSecPerMile = Math.round(paceSecPerMile);
  }

  return { creditedFiveKPaceSecPerMile, creditedThresholdPaceSecPerMile };
}

/** Max sec/mi faster than prescribed easy pace before we skip aerobic HR credit (target − actual). */
export const EASY_LONG_RUN_MAX_FAST_DRIFT_SEC_PER_MILE = 15;

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

const workoutMatchInclude = {
  segments: { orderBy: { stepOrder: "asc" as const } },
  workout_catalogue: { select: { workBasePaceOffsetSecPerMile: true } },
};

/**
 * Match activity to at most one workout; promote summary fields onto workouts.
 */
export async function tryMatchActivityToTrainingWorkout(
  athleteActivityId: string
): Promise<{ matched: boolean; workoutId?: string }> {
  const activity = await prisma.athlete_activities.findUnique({
    where: { id: athleteActivityId },
  });

  if (!activity) {
    return { matched: false };
  }

  const setIngestion = async (status: string) => {
    await prisma.athlete_activities.update({
      where: { id: athleteActivityId },
      data: { ingestionStatus: status },
    });
  };

  if (!activity.startTime) {
    await setIngestion("UNMATCHED");
    return { matched: false };
  }

  if (!isRunningActivityType(activity.activityType)) {
    await setIngestion("INELIGIBLE");
    return { matched: false };
  }

  const summaryBlob = activity.summaryData as Record<string, unknown> | null;
  const garminWorkoutId = extractGarminWorkoutIdFromSummary(summaryBlob);

  let candidate = null;

  if (garminWorkoutId != null) {
    candidate = await prisma.workouts.findFirst({
      where: {
        athleteId: activity.athleteId,
        garminWorkoutId,
        matchedActivityId: null,
      },
      include: workoutMatchInclude,
    });
  }

  if (!candidate) {
    const { start, end } = utcDayBounds(activity.startTime);
    candidate = await prisma.workouts.findFirst({
      where: {
        athleteId: activity.athleteId,
        date: { gte: start, lte: end },
        matchedActivityId: null,
      },
      orderBy: { date: "asc" },
      include: workoutMatchInclude,
    });
  }

  if (!candidate) {
    await setIngestion("UNMATCHED");
    return { matched: false };
  }

  const distanceMeters =
    activity.distance != null && activity.distance > 0
      ? activity.distance
      : null;

  const paceSecPerMile = speedMpsToSecPerMile(activity.averageSpeed);

  const {
    targetSecPerMile: targetPaceSecPerMile,
    targetSecPerMileHigh: targetPaceSecPerMileHigh,
  } = pickMainPaceTargetSecPerMile(candidate.segments);

  let paceDeltaSecPerMile: number | null = null;
  let evaluationEligible = false;

  if (targetPaceSecPerMile != null && paceSecPerMile != null) {
    paceDeltaSecPerMile = targetPaceSecPerMile - paceSecPerMile;
    evaluationEligible = true;
  }

  let hrDeltaBpm: number | null = null;
  const hrTargetMid = pickMainHrTargetBpm(candidate.segments);
  if (hrTargetMid != null && activity.averageHeartRate != null) {
    hrDeltaBpm = Math.round(hrTargetMid - activity.averageHeartRate);
  }

  let creditedFiveKPaceSecPerMile: number | null = null;
  let creditedThresholdPaceSecPerMile: number | null = null;

  const qualityOk =
    paceSecPerMile != null && paceDeltaSecPerMile != null && paceDeltaSecPerMile >= 0;

  if (qualityOk) {
    const matched = computeMatchedWorkoutPaceCredits({
      workoutType: candidate.workoutType,
      paceSecPerMile,
      paceDeltaSecPerMile,
      intervalsCatalogueOffsetSecPerMile:
        candidate.workout_catalogue?.workBasePaceOffsetSecPerMile ?? null,
    });
    creditedFiveKPaceSecPerMile = matched.creditedFiveKPaceSecPerMile;
    creditedThresholdPaceSecPerMile = matched.creditedThresholdPaceSecPerMile;
  }

  const creditedAerobicCeilingBpm = computeMatchedWorkoutAerobicCeilingCredit({
    workoutType: candidate.workoutType,
    averageHeartRateBpm: activity.averageHeartRate,
    paceDeltaSecPerMile,
  });

  await prisma.workouts.update({
    where: { id: candidate.id },
    data: {
      matchedActivityId: activity.id,
      completedActivitySummaryJson:
        summaryBlob != null && typeof summaryBlob === "object"
          ? (summaryBlob as object)
          : undefined,
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

  await setIngestion("MATCHED");

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
          planId: candidate.planId ?? null,
          weekNumber: candidate.weekNumber ?? null,
          workoutId: candidate.id,
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
        creditedFiveKPaceSecPerMile: creditedFiveKPaceSecPerMile,
        planId: candidate.planId ?? null,
        weekNumber: candidate.weekNumber ?? null,
      });
    } catch (err) {
      console.error("applyWorkoutPaceCredit after match:", err);
    }
  }

  if (creditedThresholdPaceSecPerMile != null) {
    try {
      await applyThresholdPaceCredit({
        athleteId: activity.athleteId,
        creditedThresholdPaceSecPerMile: creditedThresholdPaceSecPerMile,
        planId: candidate.planId ?? null,
        weekNumber: candidate.weekNumber ?? null,
        workoutId: candidate.id,
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
        planId: candidate.planId ?? null,
        weekNumber: candidate.weekNumber ?? null,
        workoutId: candidate.id,
      });
    } catch (err) {
      console.error("applyAerobicCeilingCredit after match:", err);
    }
  }

  return { matched: true, workoutId: candidate.id };
}
