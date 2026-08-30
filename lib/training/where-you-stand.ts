/**
 * Live "Where you stand" snapshot — computed from Athlete anchors + this week's matched sessions.
 */

import type { WorkoutType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import {
  ADAPTIVE_PERFORMANCE_CONFIG,
  nudgeSecPerMileFromBeat,
  proposedPaceSecPerMile,
} from "@/lib/training/adaptive-performance-config";
import {
  deriveKCoefficient,
  formatSecPerMile,
  parsePaceStringToSecPerMile,
  projectRaceGoFast,
} from "@/lib/training/race-projection";
import { effectiveTrainingWeekCount } from "@/lib/training/plan-utils";
import { weekBoundsFromPlan } from "@/lib/training/plan-schedule";

const METERS_PER_MILE = 1609.34;

export type WhereYouStandPaceRow = {
  currentPace: string | null;
  currentSecPerMile: number | null;
  proposedPace: string | null;
  proposedSecPerMile: number | null;
  nudgeSecPerMile: number;
  beatSec: number | null;
  sourceWorkoutId: string | null;
  sourceTitle: string | null;
  reason: string | null;
};

export type WhereYouStandDurabilityRow = {
  currentMiles: number | null;
  currentPaceSecPerMile: number | null;
  currentPace: string | null;
  proposedMiles: number | null;
  proposedPaceSecPerMile: number | null;
  proposedPace: string | null;
  sourceWorkoutId: string | null;
  sourceTitle: string | null;
  reason: string | null;
};

export type WhereYouStandPredictedRow = {
  currentFinish: string | null;
  proposedFinish: string | null;
  goalRaceMiles: number | null;
  goalRaceName: string | null;
};

export type WhereYouStandSnapshot = {
  threshold: WhereYouStandPaceRow;
  fiveK: WhereYouStandPaceRow;
  durability: WhereYouStandDurabilityRow;
  predicted: WhereYouStandPredictedRow | null;
};

type WeekWorkoutRow = {
  id: string;
  title: string;
  workoutType: WorkoutType | string;
  paceDeltaSecPerMile: number | null;
  actualAvgPaceSecPerMile: number | null;
  actualDistanceMeters: number | null;
  targetPaceSecPerMile: number | null;
  date: Date | null;
};

function secToPaceString(sec: number | null): string | null {
  if (sec == null || !Number.isFinite(sec)) return null;
  return formatSecPerMile(sec);
}

function computeBeatSec(row: WeekWorkoutRow): number | null {
  if (row.paceDeltaSecPerMile != null && Number.isFinite(row.paceDeltaSecPerMile)) {
    return row.paceDeltaSecPerMile;
  }
  if (
    row.actualAvgPaceSecPerMile != null &&
    row.targetPaceSecPerMile != null &&
    Number.isFinite(row.actualAvgPaceSecPerMile) &&
    Number.isFinite(row.targetPaceSecPerMile)
  ) {
    return Math.round(row.targetPaceSecPerMile - row.actualAvgPaceSecPerMile);
  }
  return null;
}

function bestPaceRow(
  rows: WeekWorkoutRow[],
  types: string[],
  currentSec: number | null
): WhereYouStandPaceRow {
  const base: WhereYouStandPaceRow = {
    currentPace: secToPaceString(currentSec),
    currentSecPerMile: currentSec,
    proposedPace: null,
    proposedSecPerMile: null,
    nudgeSecPerMile: 0,
    beatSec: null,
    sourceWorkoutId: null,
    sourceTitle: null,
    reason: null,
  };

  const candidates = rows.filter((r) => types.includes(String(r.workoutType)));
  let best: { row: WeekWorkoutRow; beat: number; nudge: number } | null = null;

  for (const row of candidates) {
    const beat = computeBeatSec(row);
    if (beat == null) continue;
    const nudge = nudgeSecPerMileFromBeat(beat);
    if (nudge <= 0) continue;
    if (!best || beat > best.beat || (beat === best.beat && nudge > best.nudge)) {
      best = { row, beat, nudge };
    }
  }

  if (!best || currentSec == null) {
    return base;
  }

  const proposed = proposedPaceSecPerMile({
    currentSecPerMile: currentSec,
    beatSec: best.beat,
  });

  if (proposed == null || proposed >= currentSec) {
    return base;
  }

  return {
    ...base,
    proposedSecPerMile: proposed,
    proposedPace: secToPaceString(proposed),
    nudgeSecPerMile: best.nudge,
    beatSec: best.beat,
    sourceWorkoutId: best.row.id,
    sourceTitle: best.row.title,
    reason: `Based on ${best.row.title} — beat target by ${best.beat}s/mi.`,
  };
}

function longRunHeldPace(row: WeekWorkoutRow): boolean {
  const beat = computeBeatSec(row);
  if (beat == null) return true;
  if (beat < -ADAPTIVE_PERFORMANCE_CONFIG.heldPaceMaxSlowSecPerMile) return false;
  if (beat > ADAPTIVE_PERFORMANCE_CONFIG.heldPaceMaxFastDriftSecPerMile) return false;
  return true;
}

function computeDurabilityRow(
  rows: WeekWorkoutRow[],
  currentMiles: number | null,
  currentPaceSec: number | null
): WhereYouStandDurabilityRow {
  const base: WhereYouStandDurabilityRow = {
    currentMiles,
    currentPaceSecPerMile: currentPaceSec,
    currentPace: secToPaceString(currentPaceSec),
    proposedMiles: null,
    proposedPaceSecPerMile: null,
    proposedPace: null,
    sourceWorkoutId: null,
    sourceTitle: null,
    reason: null,
  };

  const longRuns = rows.filter((r) => {
    const t = String(r.workoutType);
    return t === "LongRun" || t === "Race";
  });

  let best: WeekWorkoutRow | null = null;
  let bestMiles = 0;

  for (const row of longRuns) {
    const meters = row.actualDistanceMeters;
    if (meters == null || !Number.isFinite(meters) || meters <= 0) continue;
    const miles = meters / METERS_PER_MILE;
    if (miles < ADAPTIVE_PERFORMANCE_CONFIG.minLongRunCapabilityMiles) continue;
    if (!longRunHeldPace(row)) continue;
    if (miles > bestMiles) {
      best = row;
      bestMiles = miles;
    }
  }

  if (!best) return base;

  const proposedMiles = Math.round(bestMiles * 10) / 10;
  const proposedPaceSec = best.actualAvgPaceSecPerMile ?? null;

  const shouldPropose =
    currentMiles == null ||
    proposedMiles > currentMiles ||
    (proposedMiles === currentMiles &&
      proposedPaceSec != null &&
      currentPaceSec != null &&
      proposedPaceSec < currentPaceSec);

  if (!shouldPropose) return base;

  return {
    ...base,
    proposedMiles,
    proposedPaceSecPerMile: proposedPaceSec,
    proposedPace: secToPaceString(proposedPaceSec),
    sourceWorkoutId: best.id,
    sourceTitle: best.title,
    reason: `Long run held pace — ${proposedMiles.toFixed(1)} mi.`,
  };
}

function computePredictedRow(params: {
  currentFiveKSec: number | null;
  proposedFiveKSec: number | null;
  currentMiles: number | null;
  currentPaceSec: number | null;
  proposedMiles: number | null;
  proposedPaceSec: number | null;
  goalRaceMiles: number | null;
  goalRaceName: string | null;
  goalPaceSec: number | null;
}): WhereYouStandPredictedRow | null {
  if (params.goalRaceMiles == null || params.goalRaceMiles <= 0) return null;

  const currentK = deriveKCoefficient(
    params.currentMiles,
    params.currentPaceSec,
    params.goalPaceSec
  );
  const proposedK = deriveKCoefficient(
    params.proposedMiles ?? params.currentMiles,
    params.proposedPaceSec ?? params.currentPaceSec,
    params.goalPaceSec
  );

  const currentProj =
    params.currentFiveKSec != null
      ? projectRaceGoFast(params.currentFiveKSec, params.goalRaceMiles, currentK)
      : null;
  const proposedFiveK = params.proposedFiveKSec ?? params.currentFiveKSec;
  const proposedProj =
    proposedFiveK != null
      ? projectRaceGoFast(proposedFiveK, params.goalRaceMiles, proposedK)
      : null;

  return {
    currentFinish: currentProj?.projectedFinish ?? null,
    proposedFinish: proposedProj?.projectedFinish ?? null,
    goalRaceMiles: params.goalRaceMiles,
    goalRaceName: params.goalRaceName,
  };
}

export async function loadWhereYouStandSnapshot(params: {
  athleteId: string;
  planId: string | null;
  planStartDate: Date | null;
  weekNumber: number | null;
  storedTotalWeeks: number | null;
  raceDate: Date | null;
  raceDistanceMiles: number | null;
  raceName: string | null;
  goalRaceTime: string | null;
}): Promise<WhereYouStandSnapshot> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: params.athleteId },
    select: {
      fiveKPace: true,
      thresholdPace: true,
      longRunCapabilityMiles: true,
      longRunCapabilityPaceSecPerMile: true,
    },
  });

  let currentFiveKSec: number | null = null;
  let currentThresholdSec: number | null = null;
  try {
    if (athlete?.fiveKPace?.trim()) {
      currentFiveKSec = parsePaceToSecondsPerMile(athlete.fiveKPace.trim());
    }
    if (athlete?.thresholdPace?.trim()) {
      currentThresholdSec = parsePaceToSecondsPerMile(athlete.thresholdPace.trim());
    }
  } catch {
    /* ignore parse errors */
  }

  const emptyPace = (currentSec: number | null): WhereYouStandPaceRow => ({
    currentPace: secToPaceString(currentSec),
    currentSecPerMile: currentSec,
    proposedPace: null,
    proposedSecPerMile: null,
    nudgeSecPerMile: 0,
    beatSec: null,
    sourceWorkoutId: null,
    sourceTitle: null,
    reason: null,
  });

  if (!params.planId || params.weekNumber == null || !params.planStartDate) {
    const durability = computeDurabilityRow([], athlete?.longRunCapabilityMiles ?? null, athlete?.longRunCapabilityPaceSecPerMile ?? null);
    return {
      threshold: emptyPace(currentThresholdSec),
      fiveK: emptyPace(currentFiveKSec),
      durability,
      predicted: null,
    };
  }

  const effectiveWeeks = effectiveTrainingWeekCount(
    params.planStartDate,
    params.storedTotalWeeks ?? 1,
    params.raceDate
  );
  const { weekStart, weekEnd } = weekBoundsFromPlan(
    params.planStartDate,
    params.weekNumber,
    { raceDate: params.raceDate, totalWeeks: effectiveWeeks }
  );
  const gte = new Date(weekStart);
  gte.setUTCHours(0, 0, 0, 0);
  const lte = new Date(weekEnd);
  lte.setUTCHours(23, 59, 59, 999);

  const weekRows = await prisma.workouts.findMany({
    where: {
      athleteId: params.athleteId,
      planId: params.planId,
      matchedActivityId: { not: null },
      date: { gte, lte },
    },
    select: {
      id: true,
      title: true,
      workoutType: true,
      paceDeltaSecPerMile: true,
      actualAvgPaceSecPerMile: true,
      actualDistanceMeters: true,
      targetPaceSecPerMile: true,
      date: true,
    },
    orderBy: { date: "desc" },
  });

  const threshold = bestPaceRow(weekRows, ["Tempo"], currentThresholdSec);
  const fiveK = bestPaceRow(weekRows, ["Intervals", "Race"], currentFiveKSec);
  const durability = computeDurabilityRow(
    weekRows,
    athlete?.longRunCapabilityMiles ?? null,
    athlete?.longRunCapabilityPaceSecPerMile ?? null
  );

  let goalPaceSec: number | null = null;
  if (params.goalRaceTime?.trim() && params.raceDistanceMiles != null && params.raceDistanceMiles > 0) {
    try {
      const { parseRaceTimeToSeconds } = await import("@/lib/workout-generator/pace-calculator");
      const finishSec = parseRaceTimeToSeconds(params.goalRaceTime.trim());
      if (Number.isFinite(finishSec) && finishSec > 0) {
        goalPaceSec = Math.round(finishSec / params.raceDistanceMiles);
      }
    } catch {
      goalPaceSec = null;
    }
  }

  const predicted = computePredictedRow({
    currentFiveKSec,
    proposedFiveKSec: fiveK.proposedSecPerMile,
    currentMiles: athlete?.longRunCapabilityMiles ?? null,
    currentPaceSec: athlete?.longRunCapabilityPaceSecPerMile ?? null,
    proposedMiles: durability.proposedMiles,
    proposedPaceSec: durability.proposedPaceSecPerMile,
    goalRaceMiles: params.raceDistanceMiles,
    goalRaceName: params.raceName,
    goalPaceSec,
  });

  return { threshold, fiveK, durability, predicted };
}

export function paceStringFromSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export async function confirmWhereYouStand(params: {
  athleteId: string;
  planId?: string | null;
  weekNumber?: number | null;
  fiveKPaceSecPerMile?: number | null;
  thresholdPaceSecPerMile?: number | null;
  longRunCapabilityMiles?: number | null;
  longRunCapabilityPaceSecPerMile?: number | null;
  sourceWorkoutId?: string | null;
}): Promise<{ ok: boolean; reason: string }> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: params.athleteId },
    select: { fiveKPace: true, thresholdPace: true },
  });
  if (!athlete) return { ok: false, reason: "Athlete not found." };

  const data: Record<string, unknown> = { updatedAt: new Date() };
  const logs: Array<{ type: string; prev: number | null; next: number; msg: string }> = [];

  if (params.fiveKPaceSecPerMile != null && Number.isFinite(params.fiveKPaceSecPerMile)) {
    const prev = parsePaceStringToSecPerMile(athlete.fiveKPace);
    const next = Math.round(params.fiveKPaceSecPerMile);
    data.fiveKPace = paceStringFromSec(next);
    logs.push({
      type: "FIVE_K_UPDATE",
      prev,
      next,
      msg: `5K pace updated to ${paceStringFromSec(next)}/mi.`,
    });
  }

  if (params.thresholdPaceSecPerMile != null && Number.isFinite(params.thresholdPaceSecPerMile)) {
    const prev = parsePaceStringToSecPerMile(athlete.thresholdPace);
    const next = Math.round(params.thresholdPaceSecPerMile);
    data.thresholdPace = paceStringFromSec(next);
    logs.push({
      type: "THRESHOLD_UPDATE",
      prev,
      next,
      msg: `Threshold pace updated to ${paceStringFromSec(next)}/mi.`,
    });
  }

  if (params.longRunCapabilityMiles != null && Number.isFinite(params.longRunCapabilityMiles)) {
    data.longRunCapabilityMiles = Math.round(params.longRunCapabilityMiles * 10) / 10;
    if (
      params.longRunCapabilityPaceSecPerMile != null &&
      Number.isFinite(params.longRunCapabilityPaceSecPerMile)
    ) {
      data.longRunCapabilityPaceSecPerMile = Math.round(params.longRunCapabilityPaceSecPerMile);
    }
    data.longRunCapabilityDate = new Date();
  }

  if (Object.keys(data).length <= 1) {
    return { ok: false, reason: "Nothing to update." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.athlete.update({ where: { id: params.athleteId }, data });
    for (const log of logs) {
      await tx.pace_adjustment_log.create({
        data: {
          athleteId: params.athleteId,
          planId: params.planId ?? undefined,
          weekNumber: params.weekNumber ?? undefined,
          workoutId: params.sourceWorkoutId ?? undefined,
          notificationType: log.type,
          previousPaceSecPerMile: log.prev ?? undefined,
          newPaceSecPerMile: log.next,
          adjustmentSecPerMile:
            log.prev != null ? log.prev - log.next : undefined,
          summaryMessage: log.msg,
        },
      });
    }
  });

  if (params.fiveKPaceSecPerMile != null) {
    const { syncAthleteFiveKPaceToActivePlan } = await import("@/lib/training/plan-lifecycle");
    await syncAthleteFiveKPaceToActivePlan(params.athleteId);
  }

  return { ok: true, reason: "Updated." };
}
