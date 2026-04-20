/**
 * Promotion engine: raw athlete_activity → matched workouts row (source of truth).
 * Primary match: garminWorkoutId from webhook payload ↔ workouts.garminWorkoutId
 * Fallback: same athlete, same UTC calendar day, unmatched workout (plan or standalone)
 */

import { prisma } from "@/lib/prisma";
import { extractGarminWorkoutIdFromSummary } from "./extract-garmin-workout-id";
import { applyWorkoutPaceCredit } from "./apply-workout-pace-credit";
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

const RUNNING_ACTIVITY_TYPES = new Set(
  [
    "RUNNING",
    "TRACK_RUNNING",
    "TREADMILL_RUNNING",
    "INDOOR_TRACK",
    "TRAIL_RUNNING",
    "VIRTUAL_RUNNING",
    "STREET_RUNNING",
  ].map((s) => s.toUpperCase())
);

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

const workoutMatchInclude = {
  segments: { orderBy: { stepOrder: "asc" as const } },
  workout_catalogue: { select: { repPaceOffsetSecPerMile: true } },
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

  let creditedFiveKPace: number | null = null;
  if (
    (candidate.workoutType === "Tempo" || candidate.workoutType === "Intervals") &&
    paceSecPerMile != null &&
    paceDeltaSecPerMile != null &&
    paceDeltaSecPerMile >= 0
  ) {
    const catalogueOff = candidate.workout_catalogue?.repPaceOffsetSecPerMile;
    const offset =
      catalogueOff != null && Number.isFinite(catalogueOff)
        ? catalogueOff
        : defaultRepPaceOffsetSecPerMile(candidate.workoutType);
    if (offset != null) {
      creditedFiveKPace = Math.round(paceSecPerMile - offset);
    }
  }

  await prisma.workouts.update({
    where: { id: candidate.id },
    data: {
      matchedActivityId: activity.id,
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
      creditedFiveKPaceSecPerMile: creditedFiveKPace,
      evaluationEligibleFlag: evaluationEligible,
      updatedAt: new Date(),
    },
  });

  await setIngestion("MATCHED");

  if (creditedFiveKPace != null) {
    try {
      await applyWorkoutPaceCredit({
        athleteId: activity.athleteId,
        creditedFiveKPaceSecPerMile: creditedFiveKPace,
        planId: candidate.planId ?? null,
        weekNumber: candidate.weekNumber ?? null,
      });
    } catch (err) {
      console.error("applyWorkoutPaceCredit after match:", err);
    }
  }

  return { matched: true, workoutId: candidate.id };
}
