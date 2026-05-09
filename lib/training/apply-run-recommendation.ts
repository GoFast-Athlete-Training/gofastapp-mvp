/**
 * Apply user-confirmed values from workouts.analysisJson AI recommendation.
 */

import { prisma } from "@/lib/prisma";
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import { applyAerobicCeilingCredit } from "@/lib/training/apply-aerobic-ceiling-credit";
import { applyWorkoutPaceCredit } from "@/lib/training/apply-workout-pace-credit";
import { syncAthleteFiveKPaceToActivePlan } from "@/lib/training/plan-lifecycle";
import type { RunAnalysisJsonV1 } from "@/lib/training/run-analysis-types";

const MAX_SLOW_ADJUST_SEC = 10;

function secondsPerMileToPaceString(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${minutes}:${s.toString().padStart(2, "0")}`;
}

function valuesMatchRecommendation(
  analysis: RunAnalysisJsonV1,
  field: "aerobicCeilingBpm" | "fiveKPaceSecPerMile",
  suggestedValue: number
): boolean {
  const rec = analysis.recommendation;
  if (!rec || rec.field !== field) return false;
  if (field === "aerobicCeilingBpm") {
    return Math.abs(rec.suggestedValue - Math.round(suggestedValue)) <= 2;
  }
  return Math.abs(rec.suggestedValue - Math.round(suggestedValue)) <= 3;
}

export type ApplyRunRecommendationResult = {
  ok: boolean;
  error?: string;
  updatedField?: string;
  summary?: string;
};

export async function applyRunRecommendationFromWorkout(params: {
  workoutId: string;
  athleteId: string;
  field: "aerobicCeilingBpm" | "fiveKPaceSecPerMile";
  suggestedValue: number;
}): Promise<ApplyRunRecommendationResult> {
  const workout = await prisma.workouts.findFirst({
    where: { id: params.workoutId, athleteId: params.athleteId },
    select: {
      planId: true,
      weekNumber: true,
      analysisJson: true,
    },
  });

  if (!workout) {
    return { ok: false, error: "Workout not found" };
  }

  const raw = workout.analysisJson;
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "No AI assessment on this workout yet" };
  }

  const analysis = raw as RunAnalysisJsonV1;
  if (analysis.v !== 1) {
    return { ok: false, error: "Unsupported assessment format" };
  }

  if (analysis.recommendationAppliedAt) {
    return { ok: false, error: "Recommendation already applied" };
  }

  if (!valuesMatchRecommendation(analysis, params.field, params.suggestedValue)) {
    return { ok: false, error: "Suggestion does not match the latest assessment — refresh and try again" };
  }

  if (params.field === "aerobicCeilingBpm") {
    const bpm = Math.round(params.suggestedValue);
    if (bpm < 80 || bpm > 210) {
      return { ok: false, error: "Invalid HR value" };
    }
    const result = await applyAerobicCeilingCredit({
      athleteId: params.athleteId,
      creditedAerobicCeilingBpm: bpm,
      planId: workout.planId ?? null,
      weekNumber: workout.weekNumber ?? null,
      workoutId: params.workoutId,
    });
    if (!result.updatedAthleteAerobicCeiling) {
      return {
        ok: true,
        updatedField: "aerobicCeilingBpm",
        summary: "No change needed — already at or near that aerobic ceiling.",
      };
    }
    await markRecommendationApplied(params.workoutId, workout.analysisJson as object | null);
    return {
      ok: true,
      updatedField: "aerobicCeilingBpm",
      summary: result.summary ?? "Aerobic ceiling updated.",
    };
  }

  // fiveKPaceSecPerMile
  const suggestedSec = Math.round(params.suggestedValue);
  if (suggestedSec < 240 || suggestedSec > 840) {
    return { ok: false, error: "Invalid pace value" };
  }

  const athlete = await prisma.athlete.findUnique({
    where: { id: params.athleteId },
    select: { fiveKPace: true },
  });

  if (!athlete?.fiveKPace?.trim()) {
    const newPaceStr = secondsPerMileToPaceString(suggestedSec);
    const summaryMessage = `From your run assessment, 5K pace is set to ${newPaceStr}/mi.`;
    await prisma.$transaction(async (tx) => {
      await tx.athlete.update({
        where: { id: params.athleteId },
        data: { fiveKPace: newPaceStr, updatedAt: new Date() },
      });
      await tx.pace_adjustment_log.create({
        data: {
          athleteId: params.athleteId,
          planId: workout.planId ?? undefined,
          weekNumber: workout.weekNumber ?? undefined,
          workoutId: params.workoutId,
          notificationType: "PACE_UPDATE",
          previousPaceSecPerMile: null,
          newPaceSecPerMile: suggestedSec,
          adjustmentSecPerMile: null,
          qualityWorkoutsCount: 1,
          summaryMessage,
        },
      });
    });
    await syncAthleteFiveKPaceToActivePlan(params.athleteId);
    await markRecommendationApplied(params.workoutId, workout.analysisJson as object | null);
    return {
      ok: true,
      updatedField: "fiveKPaceSecPerMile",
      summary: summaryMessage,
    };
  }

  const previousSec = parsePaceToSecondsPerMile(athlete.fiveKPace.trim());

  if (suggestedSec < previousSec) {
    await applyWorkoutPaceCredit({
      athleteId: params.athleteId,
      creditedFiveKPaceSecPerMile: suggestedSec,
      planId: workout.planId ?? null,
      weekNumber: workout.weekNumber ?? null,
    });
    await markRecommendationApplied(params.workoutId, workout.analysisJson as object | null);
    return {
      ok: true,
      updatedField: "fiveKPaceSecPerMile",
      summary: "5K pace nudged faster using the same safety rules as quality workouts.",
    };
  }

  if (suggestedSec > previousSec) {
    const capped = Math.min(suggestedSec, previousSec + MAX_SLOW_ADJUST_SEC);
    const newPaceStr = secondsPerMileToPaceString(capped);
    const summaryMessage = `From your run assessment, 5K pace eased to ${newPaceStr}/mi (capped for safety).`;
    await prisma.$transaction(async (tx) => {
      await tx.athlete.update({
        where: { id: params.athleteId },
        data: { fiveKPace: newPaceStr, updatedAt: new Date() },
      });
      await tx.pace_adjustment_log.create({
        data: {
          athleteId: params.athleteId,
          planId: workout.planId ?? undefined,
          weekNumber: workout.weekNumber ?? undefined,
          workoutId: params.workoutId,
          notificationType: "PACE_UPDATE",
          previousPaceSecPerMile: previousSec,
          newPaceSecPerMile: capped,
          adjustmentSecPerMile: capped - previousSec,
          qualityWorkoutsCount: 1,
          summaryMessage,
        },
      });
    });
    await syncAthleteFiveKPaceToActivePlan(params.athleteId);
    await markRecommendationApplied(params.workoutId, workout.analysisJson as object | null);
    return {
      ok: true,
      updatedField: "fiveKPaceSecPerMile",
      summary: summaryMessage,
    };
  }

  return { ok: false, error: "Already at suggested 5K pace" };
}

async function markRecommendationApplied(
  workoutId: string,
  previousAnalysis: object | null
): Promise<void> {
  const prev =
    previousAnalysis && typeof previousAnalysis === "object"
      ? (previousAnalysis as RunAnalysisJsonV1)
      : null;
  if (!prev || prev.v !== 1) return;
  const next = {
    ...prev,
    recommendationAppliedAt: new Date().toISOString(),
  };
  await prisma.workouts.update({
    where: { id: workoutId },
    data: { analysisJson: next as object, updatedAt: new Date() },
  });
}
