import { prisma } from "@/lib/prisma";
import {
  estimateMpCapacityFromRollingVolume,
  loadCapacityImpactOnMpSim,
} from "@/lib/training/load-capacity-impact-on-mp-sim";
import { isSwimmingActivityType } from "@/lib/training/activity-type-sets";
import {
  bikeMetersToRunEquivalentMiles,
  RUN_MILES_PER_100M_SWIM,
  RUN_MILES_PER_BIKE_MILE,
  swimMetersToRunEquivalentMiles,
} from "@/lib/training/cross-training-volume-equivalents";
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";

const MS_PER_DAY = 86400000;
const DEFAULT_WINDOW_DAYS = 28;
/** Sec/mi headroom from goal MP above threshold; at or below this feels "on the redline." */
export const THRESHOLD_HEADROOM_COMFORT_SEC = 15;

function roundMi(n: number): number {
  return Math.round(n * 100) / 100;
}

function paceSecSafe(raw: string | null | undefined): number | null {
  const t = raw?.trim();
  if (!t) return null;
  try {
    const s = parsePaceToSecondsPerMile(t);
    return Number.isFinite(s) ? Math.round(s) : null;
  } catch {
    return null;
  }
}

function formatPaceMinSec(secPerMile: number): string {
  const r = Math.round(secPerMile);
  const m = Math.floor(r / 60);
  const s = r % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Pure deltas + readiness copy for 5K → threshold → goal MP (sec/mi: lower = faster).
 * Used by gap analysis and by verification scripts (no DB).
 */
export function paceAnchorReadinessNarratives(input: {
  athleteFiveKPaceSecPerMile: number | null;
  athleteThresholdPaceSecPerMile: number | null;
  goalRacePaceSecPerMile: number | null;
}): {
  thresholdVsFiveKSec: number | null;
  goalRaceVsThresholdSec: number | null;
  fiveKAnchorStaleVsThreshold: boolean;
  goalPaceTooCloseToThreshold: boolean;
  narratives: string[];
} {
  const fk = input.athleteFiveKPaceSecPerMile;
  const thr = input.athleteThresholdPaceSecPerMile;
  const gr = input.goalRacePaceSecPerMile;

  let thresholdVsFiveKSec: number | null = null;
  if (fk != null && thr != null) {
    thresholdVsFiveKSec = Math.round(thr - fk);
  }

  let goalRaceVsThresholdSec: number | null = null;
  if (gr != null && thr != null) {
    goalRaceVsThresholdSec = Math.round(gr - thr);
  }

  const fiveKAnchorStaleVsThreshold =
    fk != null && thr != null && thr <= fk;

  const goalPaceTooCloseToThreshold =
    goalRaceVsThresholdSec != null &&
    goalRaceVsThresholdSec <= THRESHOLD_HEADROOM_COMFORT_SEC;

  const narratives: string[] = [];

  if (fiveKAnchorStaleVsThreshold) {
    narratives.push(
      "5K anchor looks stale; speed anchor should be rechecked or lowered."
    );
  }

  if (thr == null && fk != null && gr != null) {
    narratives.push(
      "Complete tempo workouts on target to establish threshold pace between your 5K speed and marathon goal."
    );
  }

  if (thr != null && gr != null && goalRaceVsThresholdSec != null) {
    if (goalRaceVsThresholdSec >= THRESHOLD_HEADROOM_COMFORT_SEC) {
      narratives.push(
        `Your tempo work suggests threshold pace around ${formatPaceMinSec(thr)}/mi. Goal marathon pace is ${formatPaceMinSec(gr)}/mi, giving about ${goalRaceVsThresholdSec} sec/mi of threshold headroom — goal pace sits below redline.`
      );
    } else {
      narratives.push(
        "Goal pace is too close to threshold — limited headroom versus redline."
      );
    }
  }

  return {
    thresholdVsFiveKSec,
    goalRaceVsThresholdSec,
    fiveKAnchorStaleVsThreshold,
    goalPaceTooCloseToThreshold,
    narratives,
  };
}

/** Readiness copy when athlete has an aerobic ceiling estimate (no DB). */
export function aerobicCeilingGapLines(
  aerobicCeilingBpm: number | null | undefined
): string[] {
  if (aerobicCeilingBpm == null || !Number.isFinite(aerobicCeilingBpm)) return [];
  const b = Math.round(Number(aerobicCeilingBpm));
  if (b < 60 || b > 230) return [];
  return [
    `Easy/long-run aerobic ceiling is estimated around ${b} bpm; sustained averages above that often drift out of easy aerobic work.`,
  ];
}

function milesFromWorkout(w: { actualDistanceMeters: number | null }): number {
  const m = w.actualDistanceMeters;
  if (m == null || !Number.isFinite(m) || m <= 0) return 0;
  return m / 1609.34;
}

/**
 * Aggregates canonical run volume from `workouts` (plan + promoted standalone),
 * plus conservative bike / swim credits from `bike_workout` and swim-typed `athlete_activities`.
 */
export async function computeRaceLoadGapAnalysis(params: {
  athleteId: string;
  planId: string;
  windowDays?: number;
}): Promise<{
  windowDays: number;
  windowStart: string;
  actualRunMiles: number;
  actualBikeMilesRidden: number;
  actualBikeEquivalentRunMiles: number;
  actualSwimMeters: number;
  actualSwimEquivalentRunMiles: number;
  actualAerobicEquivalentMiles: number;
  estimatedMpCapacityMiles: number;
  mpSegmentMilesEstimate: number;
  mpLoadPctOfRun: number | null;
  athleteFiveKPaceSecPerMile: number | null;
  athleteThresholdPaceSecPerMile: number | null;
  goalRacePaceSecPerMile: number | null;
  thresholdVsFiveKSec: number | null;
  goalRaceVsThresholdSec: number | null;
  fiveKAnchorStaleVsThreshold: boolean;
  goalPaceTooCloseToThreshold: boolean;
  athleteAerobicCeilingBpm: number | null;
  gapLines: string[];
}> {
  const windowDays =
    typeof params.windowDays === "number" && params.windowDays > 0
      ? Math.min(90, Math.floor(params.windowDays))
      : DEFAULT_WINDOW_DAYS;
  const end = new Date();
  const start = new Date(end.getTime() - windowDays * MS_PER_DAY);

  const [plan, athleteRow, workouts, bikeRows, swimActivities] = await Promise.all([
    prisma.training_plans.findFirst({
      where: { id: params.planId, athleteId: params.athleteId },
      select: { id: true, goalRacePace: true },
    }),
    prisma.athlete.findUnique({
      where: { id: params.athleteId },
      select: { fiveKPace: true, thresholdPace: true, aerobicCeilingBpm: true },
    }),
    prisma.workouts.findMany({
      where: {
        athleteId: params.athleteId,
        OR: [{ planId: params.planId }, { planId: null }],
        date: { gte: start, lte: end },
        workoutType: { in: ["Easy", "LongRun", "Tempo", "Intervals", "Race"] },
        actualDistanceMeters: { not: null },
      },
      select: {
        id: true,
        actualDistanceMeters: true,
        segments: {
          select: {
            title: true,
            actualDistanceMiles: true,
            durationType: true,
            durationValue: true,
          },
        },
      },
    }),
    prisma.bike_workout.findMany({
      where: {
        athleteId: params.athleteId,
        date: { gte: start, lte: end },
        actualDistanceMeters: { not: null, gt: 0 },
      },
      select: { actualDistanceMeters: true },
    }),
    prisma.athlete_activities.findMany({
      where: {
        athleteId: params.athleteId,
        startTime: { gte: start, lte: end },
        distance: { not: null, gt: 0 },
      },
      select: { activityType: true, distance: true },
    }),
  ]);

  if (!plan) {
    throw new Error("Plan not found");
  }

  const athleteFiveKPaceSecPerMile = paceSecSafe(athleteRow?.fiveKPace);
  const athleteThresholdPaceSecPerMile = paceSecSafe(athleteRow?.thresholdPace);
  const athleteAerobicCeilingBpm =
    athleteRow?.aerobicCeilingBpm != null &&
    Number.isFinite(athleteRow.aerobicCeilingBpm)
      ? Math.round(athleteRow.aerobicCeilingBpm)
      : null;
  const goalRacePaceSecPerMile = paceSecSafe(plan.goalRacePace);

  const {
    thresholdVsFiveKSec,
    goalRaceVsThresholdSec,
    fiveKAnchorStaleVsThreshold,
    goalPaceTooCloseToThreshold,
    narratives: paceAnchorNarratives,
  } = paceAnchorReadinessNarratives({
    athleteFiveKPaceSecPerMile,
    athleteThresholdPaceSecPerMile,
    goalRacePaceSecPerMile,
  });

  let actualRunMiles = 0;
  let mpSegmentMilesEstimate = 0;

  for (const w of workouts) {
    actualRunMiles += milesFromWorkout(w);
    for (const s of w.segments) {
      const t = (s.title || "").toLowerCase();
      if (!t.includes("marathon")) continue;
      if (s.actualDistanceMiles != null && s.actualDistanceMiles > 0) {
        mpSegmentMilesEstimate += s.actualDistanceMiles;
      } else if (s.durationType === "DISTANCE" && s.durationValue != null && s.durationValue > 0) {
        mpSegmentMilesEstimate += s.durationValue;
      }
    }
  }

  let actualBikeMilesRidden = 0;
  let actualBikeEquivalentRunMiles = 0;
  for (const b of bikeRows) {
    const dm = b.actualDistanceMeters;
    if (dm == null || !Number.isFinite(dm) || dm <= 0) continue;
    actualBikeMilesRidden += dm / 1609.34;
    actualBikeEquivalentRunMiles += bikeMetersToRunEquivalentMiles(dm);
  }

  let actualSwimMeters = 0;
  let actualSwimEquivalentRunMiles = 0;
  for (const a of swimActivities) {
    if (!isSwimmingActivityType(a.activityType)) continue;
    const dm = a.distance;
    if (dm == null || !Number.isFinite(dm) || dm <= 0) continue;
    actualSwimMeters += dm;
    actualSwimEquivalentRunMiles += swimMetersToRunEquivalentMiles(dm);
  }

  actualRunMiles = roundMi(actualRunMiles);
  actualBikeMilesRidden = roundMi(actualBikeMilesRidden);
  actualBikeEquivalentRunMiles = roundMi(actualBikeEquivalentRunMiles);
  actualSwimMeters = Math.round(actualSwimMeters);
  actualSwimEquivalentRunMiles = roundMi(actualSwimEquivalentRunMiles);
  mpSegmentMilesEstimate = roundMi(mpSegmentMilesEstimate);

  const actualAerobicEquivalentMiles = roundMi(
    actualRunMiles + actualBikeEquivalentRunMiles + actualSwimEquivalentRunMiles
  );

  const estimatedMpCapacityMiles = estimateMpCapacityFromRollingVolume(actualRunMiles);
  const mpLoadPctOfRun =
    actualRunMiles > 0 ? roundMi((mpSegmentMilesEstimate / actualRunMiles) * 100) : null;

  const gapLines: string[] = [];
  gapLines.push(
    `Last ${windowDays} days: about ${actualRunMiles} mi recorded on the watch across plan and off-plan runs.`
  );
  if (actualBikeMilesRidden > 0 || actualSwimMeters > 0) {
    gapLines.push(
      `Hybrid training in the same window: ~${actualBikeMilesRidden} mi ridden; ~${actualSwimMeters} m swim (from activities with distance).`
    );
    gapLines.push(
      `Conservative aerobic equivalents for context only: ~${actualBikeEquivalentRunMiles} run-mi from bike (${RUN_MILES_PER_BIKE_MILE}× per bike mi) and ~${actualSwimEquivalentRunMiles} run-mi from swim (${RUN_MILES_PER_100M_SWIM}× per 100 m). Combined with runs: ~${actualAerobicEquivalentMiles} “aerobic equivalent” mi — not a substitute for run durability.`
    );
  }
  for (const line of paceAnchorNarratives) {
    gapLines.push(line);
  }
  for (const line of aerobicCeilingGapLines(athleteAerobicCeilingBpm)) {
    gapLines.push(line);
  }
  gapLines.push(
    `Goal-pace / “marathon pace” segment distance (when lap data lines up) is about ${mpSegmentMilesEstimate} mi in that window.`
  );
  if (mpLoadPctOfRun != null) {
    gapLines.push(
      `That is roughly ${mpLoadPctOfRun}% of run volume — many marathon builds aim for ~5–10% once durability is solid.`
    );
  }
  gapLines.push(
    `Coarse MP-specific capacity from run volume alone (not proof of race readiness): about ${estimatedMpCapacityMiles} mi at a time.`
  );
  gapLines.push(
    "Speed vs goal, injury history, and execution on the day still dominate — this is a volume-and-specificity gap read, not a prediction."
  );

  return {
    windowDays,
    windowStart: start.toISOString(),
    actualRunMiles,
    actualBikeMilesRidden,
    actualBikeEquivalentRunMiles,
    actualSwimMeters,
    actualSwimEquivalentRunMiles,
    actualAerobicEquivalentMiles,
    estimatedMpCapacityMiles,
    mpSegmentMilesEstimate,
    mpLoadPctOfRun,
    athleteFiveKPaceSecPerMile,
    athleteThresholdPaceSecPerMile,
    goalRacePaceSecPerMile,
    thresholdVsFiveKSec,
    goalRaceVsThresholdSec,
    fiveKAnchorStaleVsThreshold,
    goalPaceTooCloseToThreshold,
    athleteAerobicCeilingBpm,
    gapLines,
  };
}

export function attachMpSimAdvisory<
  T extends Awaited<ReturnType<typeof computeRaceLoadGapAnalysis>>,
>(
  analysis: T,
  scheduledMpMiles: number | null | undefined
): T & { mpSimAdvisory: ReturnType<typeof loadCapacityImpactOnMpSim> | null } {
  if (scheduledMpMiles == null || !Number.isFinite(scheduledMpMiles) || scheduledMpMiles <= 0) {
    return { ...analysis, mpSimAdvisory: null };
  }
  return {
    ...analysis,
    mpSimAdvisory: loadCapacityImpactOnMpSim({
      scheduledMpMiles,
      estimatedCapacityMiles: analysis.estimatedMpCapacityMiles,
    }),
  };
}
