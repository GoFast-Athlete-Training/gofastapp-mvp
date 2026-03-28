/**
 * Deterministic Interval + Tempo segment builders for plan generation.
 * Ladder step from prior *completed* workouts of same type (matchedActivityId set).
 */

import type { WorkoutType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getTrainingPaces,
  paceTargetFromSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";
import type { ApiSegment } from "@/lib/workout-generator/templates";

const METERS_PER_MILE = 1609.34;
const INTERVAL_TOTAL_WORK_MILES = 4;
const LADDER_MAX_I = 3;

export function resolvePaceStringForWorkout(
  planCurrentFiveKPace: string | null | undefined,
  athleteFiveKPace: string | null | undefined
): string | null {
  const p = planCurrentFiveKPace?.trim();
  if (p) return p;
  const a = athleteFiveKPace?.trim();
  return a || null;
}

function intervalWorkMeters(i: number): number {
  const clamped = Math.min(Math.max(i, 0), LADDER_MAX_I);
  return 1600 / Math.pow(2, clamped);
}

function intervalRecoveryMeters(i: number): number {
  const clamped = Math.min(Math.max(i, 0), LADDER_MAX_I);
  return 400 / Math.pow(2, clamped);
}

async function priorCompletedCount(params: {
  athleteId: string;
  workoutType: WorkoutType;
  workoutId: string;
  workoutDate: Date | null;
}): Promise<number> {
  const { athleteId, workoutType, workoutId, workoutDate } = params;
  const prior = await prisma.workouts.findMany({
    where: {
      athleteId,
      workoutType,
      matchedActivityId: { not: null },
      id: { not: workoutId },
    },
    select: { id: true, date: true },
  });
  if (!workoutDate) {
    return prior.length;
  }
  const t = workoutDate.getTime();
  return prior.filter((w) => {
    if (!w.date) return true;
    const wt = w.date.getTime();
    if (wt < t) return true;
    if (wt > t) return false;
    return w.id < workoutId;
  }).length;
}

export function ladderIndexFromCompletedCount(completedBefore: number): number {
  return completedBefore % (LADDER_MAX_I + 1);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function buildIntervalApiSegments(params: {
  athleteId: string;
  workoutId: string;
  workoutDate: Date | null;
  scheduleTotalMiles: number;
  anchorSecondsPerMile: number;
}): Promise<ApiSegment[]> {
  const paces = getTrainingPaces(params.anchorSecondsPerMile);
  const completed = await priorCompletedCount({
    athleteId: params.athleteId,
    workoutType: "Intervals",
    workoutId: params.workoutId,
    workoutDate: params.workoutDate,
  });
  const i = ladderIndexFromCompletedCount(completed);
  const wM = intervalWorkMeters(i);
  const rM = intervalRecoveryMeters(i);
  const totalWorkMeters = INTERVAL_TOTAL_WORK_MILES * METERS_PER_MILE;
  const repCount = Math.max(1, Math.round(totalWorkMeters / wM));
  const workMiles = round2(wM / METERS_PER_MILE);
  const recMiles = round2(rM / METERS_PER_MILE);

  const totalM = Math.max(params.scheduleTotalMiles, workMiles + recMiles + 1);
  const warmupMiles = round2(Math.max(0.25, Math.min(1.5, totalM * 0.12)));
  const cooldownMiles = round2(Math.max(0.25, Math.min(1.5, totalM * 0.12)));

  const segs: ApiSegment[] = [];
  let step = 1;
  segs.push({
    stepOrder: step++,
    title: "Warmup",
    durationType: "DISTANCE",
    durationValue: warmupMiles,
    targets: [paceTargetFromSecondsPerMile(paces.easy)],
  });
  for (let r = 0; r < repCount; r++) {
    segs.push({
      stepOrder: step++,
      title: `Interval ${r + 1}`,
      durationType: "DISTANCE",
      durationValue: workMiles,
      targets: [paceTargetFromSecondsPerMile(paces.interval)],
    });
    segs.push({
      stepOrder: step++,
      title: "Recovery",
      durationType: "DISTANCE",
      durationValue: recMiles,
      targets: [paceTargetFromSecondsPerMile(paces.recovery)],
    });
  }
  segs.push({
    stepOrder: step++,
    title: "Cooldown",
    durationType: "DISTANCE",
    durationValue: cooldownMiles,
    targets: [paceTargetFromSecondsPerMile(paces.easy)],
  });
  return segs;
}

const TEMPO_WORK_MILES = [2, 1.5, 1, 0.75] as const;
const TEMPO_REC_MILES = [1, 0.75, 0.5, 0.35] as const;

export async function buildTempoApiSegments(params: {
  athleteId: string;
  workoutId: string;
  workoutDate: Date | null;
  scheduleTotalMiles: number;
  anchorSecondsPerMile: number;
}): Promise<ApiSegment[]> {
  const paces = getTrainingPaces(params.anchorSecondsPerMile);
  const completed = await priorCompletedCount({
    athleteId: params.athleteId,
    workoutType: "Tempo",
    workoutId: params.workoutId,
    workoutDate: params.workoutDate,
  });
  const j = completed % TEMPO_WORK_MILES.length;
  const workMiles = TEMPO_WORK_MILES[j];
  const recMiles = TEMPO_REC_MILES[j];
  const tempoSec = Math.max(1, paces.tempo - j * 5);

  const totalM = Math.max(params.scheduleTotalMiles, workMiles + recMiles + 1);
  const warmupMiles = round2(Math.max(0.25, Math.min(1.5, totalM * 0.12)));
  const cooldownMiles = round2(Math.max(0.25, Math.min(1.5, totalM * 0.12)));
  const middleBudget = Math.max(workMiles, totalM - warmupMiles - cooldownMiles);
  const rounds = Math.max(
    1,
    Math.min(3, Math.floor((middleBudget + recMiles) / (workMiles + recMiles)))
  );

  const segs: ApiSegment[] = [];
  let step = 1;
  segs.push({
    stepOrder: step++,
    title: "Warmup",
    durationType: "DISTANCE",
    durationValue: warmupMiles,
    targets: [paceTargetFromSecondsPerMile(paces.easy)],
  });
  for (let r = 0; r < rounds; r++) {
    segs.push({
      stepOrder: step++,
      title: rounds > 1 ? `Tempo ${r + 1}` : "Tempo",
      durationType: "DISTANCE",
      durationValue: workMiles,
      targets: [paceTargetFromSecondsPerMile(tempoSec)],
    });
    if (r < rounds - 1) {
      segs.push({
        stepOrder: step++,
        title: "Recovery",
        durationType: "DISTANCE",
        durationValue: recMiles,
        targets: [paceTargetFromSecondsPerMile(paces.easy)],
      });
    }
  }
  segs.push({
    stepOrder: step++,
    title: "Cooldown",
    durationType: "DISTANCE",
    durationValue: cooldownMiles,
    targets: [paceTargetFromSecondsPerMile(paces.easy)],
  });
  return segs;
}
