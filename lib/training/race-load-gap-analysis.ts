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

const MS_PER_DAY = 86400000;
const DEFAULT_WINDOW_DAYS = 28;

function roundMi(n: number): number {
  return Math.round(n * 100) / 100;
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
  gapLines: string[];
}> {
  const windowDays =
    typeof params.windowDays === "number" && params.windowDays > 0
      ? Math.min(90, Math.floor(params.windowDays))
      : DEFAULT_WINDOW_DAYS;
  const end = new Date();
  const start = new Date(end.getTime() - windowDays * MS_PER_DAY);

  const plan = await prisma.training_plans.findFirst({
    where: { id: params.planId, athleteId: params.athleteId },
    select: { id: true },
  });
  if (!plan) {
    throw new Error("Plan not found");
  }

  const [workouts, bikeRows, swimActivities] = await Promise.all([
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
