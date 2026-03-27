/**
 * Promotion engine: raw athlete_activity → matched workouts row (source of truth).
 * Primary match: garminWorkoutId from webhook payload ↔ workouts.garminWorkoutId
 * Fallback: same athlete, same UTC calendar day, unmatched workout (plan or standalone)
 */

import { prisma } from "@/lib/prisma";
import { extractGarminWorkoutIdFromSummary } from "./extract-garmin-workout-id";
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

function paceTargetSecPerMileFromSegment(targets: unknown): number | null {
  if (!Array.isArray(targets) || targets.length === 0) return null;
  const t = targets[0] as SegmentTarget;
  if (!t?.type || String(t.type).toUpperCase() !== "PACE") return null;
  const low = t.valueLow ?? t.value;
  if (low == null || typeof low !== "number" || low <= 0) return null;
  // Stored as sec/km (Garmin) → sec/mile
  return Math.round(low * 1.60934);
}

function pickMainPaceTargetSecPerMile(
  segments: { title: string; targets: unknown; stepOrder: number }[]
): { targetSecPerMile: number | null } {
  const sorted = [...segments].sort((a, b) => a.stepOrder - b.stepOrder);
  for (const seg of sorted) {
    const title = (seg.title || "").toLowerCase();
    if (title.includes("warmup") || title.includes("warm-up")) continue;
    if (title.includes("cooldown") || title.includes("cool-down")) continue;
    const p = paceTargetSecPerMileFromSegment(seg.targets);
    if (p != null) return { targetSecPerMile: p };
  }
  for (const seg of sorted) {
    const p = paceTargetSecPerMileFromSegment(seg.targets);
    if (p != null) return { targetSecPerMile: p };
  }
  return { targetSecPerMile: null };
}

function deriveDirection(deltaSecPerMile: number): "positive" | "negative" | "neutral" {
  if (deltaSecPerMile > 5) return "positive";
  if (deltaSecPerMile < -5) return "negative";
  return "neutral";
}

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
      include: { segments: { orderBy: { stepOrder: "asc" } } },
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
      include: { segments: { orderBy: { stepOrder: "asc" } } },
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

  const { targetSecPerMile } = pickMainPaceTargetSecPerMile(candidate.segments);

  let derivedDelta: number | null = null;
  let derivedDirection: string | null = null;
  let evaluationEligible = false;

  if (targetSecPerMile != null && paceSecPerMile != null) {
    derivedDelta = targetSecPerMile - paceSecPerMile;
    derivedDirection = deriveDirection(derivedDelta);
    evaluationEligible = true;
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
      derivedPerformanceDeltaSeconds: derivedDelta,
      derivedPerformanceDirection: derivedDirection,
      derivedAgainstTargetPace: targetSecPerMile,
      evaluationEligibleFlag: evaluationEligible,
      updatedAt: new Date(),
    },
  });

  await setIngestion("MATCHED");

  return { matched: true, workoutId: candidate.id };
}
